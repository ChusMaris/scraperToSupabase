import assert from 'node:assert/strict';
import test from 'node:test';
import { getComplementaryStatsOptions, importComplementaryStats } from './complementaryStats.js';

type Row = Record<string, any>;

class MemoryQuery {
  private filters: Array<(row: Row) => boolean> = [];
  private action: 'select' | 'update' = 'select';
  private patch: Row = {};
  private orderColumn: string | null = null;

  constructor(private readonly database: MemoryDatabase, private readonly table: string) {}

  select() { return this; }
  order(column: string) { this.orderColumn = column; return this; }
  eq(column: string, value: unknown) { this.filters.push((row) => String(row[column]) === String(value)); return this; }
  is(column: string, value: unknown) {
    this.filters.push((row) => value === null ? row[column] == null : row[column] === value);
    return this;
  }
  in(column: string, values: unknown[]) { this.filters.push((row) => values.some((value) => String(row[column]) === String(value))); return this; }
  not(column: string, _operator: string, value: unknown) { this.filters.push((row) => row[column] !== value); return this; }
  update(patch: Row) { this.action = 'update'; this.patch = patch; return this; }

  maybeSingle() {
    const rows = this.rows();
    return Promise.resolve({ data: rows.length === 1 ? rows[0] : null, error: rows.length > 1 ? { message: 'Multiple rows' } : null });
  }

  then(resolve: (value: { data: Row[]; error: null }) => unknown, reject: (reason: unknown) => unknown) {
    return Promise.resolve().then(() => {
      const rows = this.rows();
      if (this.action === 'update') {
        if (this.database.ignoreUpdates) return { data: [], error: null };
        for (const row of rows) Object.assign(row, this.patch);
        this.database.writeCount += rows.length;
      }
      return { data: rows, error: null };
    }).then(resolve, reject);
  }

  private rows() {
    let rows = (this.database.tables[this.table] ?? []).filter((row) => this.filters.every((filter) => filter(row)));
    if (this.orderColumn) rows = [...rows].sort((first, second) => String(first[this.orderColumn!] ?? '').localeCompare(String(second[this.orderColumn!] ?? '')));
    return rows;
  }
}

class MemoryDatabase {
  writeCount = 0;
  ignoreUpdates = false;
  readonly tables: Record<string, Row[]> = {
    temporadas: [{ id: 1, nombre: '2026/2027' }],
    categorias: [{ id: 2, nombre: 'Infantil A' }],
    competiciones: [{ id: 3, nombre: 'Lliga', temporada_id: 1, categoria_id: 2, categorias: { id: 2, nombre: 'Infantil A' } }],
    partidos: [{ id: 4, competicion_id: 3, jornada: 1, equipo_local_id: 5, equipo_visitante_id: 6, fecha_hora: '2026-09-20T10:00:00Z', puntos_local: 55, puntos_visitante: 49 }],
    equipos: [{ id: 5, nombre_especifico: 'Brafa' }, { id: 6, nombre_especifico: 'Rival' }],
    plantillas: [{ equipo_id: 5, jugador_id: 7, dorsal: '2' }, { equipo_id: 5, jugador_id: 8, dorsal: '3' }],
    estadisticas_jugador_partido: [
      { id: 9, partido_id: 4, jugador_id: 7, dorsal: '2', puntos: 17, tiempo_jugado: 1710, valoracion: 0, t2_anotados: 0 },
      { id: 10, partido_id: 4, jugador_id: 8, dorsal: '3', puntos: 2, tiempo_jugado: 600, valoracion: 1 }
    ]
  };

  from(table: string) { return new MemoryQuery(this, table); }
}

const validContext = {
  seasonId: '1', categoryId: '2', competitionId: '3', matchday: 1, matchId: '4', teamId: '5',
  includedMatchCount: 1, confirmedSingleMatch: true
};
const validRow = {
  jerseyNumber: '2', playerName: 'Victor', t2Made: 6, t2Attempted: 16, t3Made: 0, t3Attempted: 0,
  tlMade: 5, tlAttempted: 12, rebounds: 4, assists: 0, steals: 1, turnovers: 5
};

test('returns only categories related to the selected season', async () => {
  const database = new MemoryDatabase();
  const options = await getComplementaryStatsOptions(database, new URLSearchParams('type=categories&seasonId=1'));
  assert.deepEqual(options, [{ id: 2, name: 'Infantil A' }]);
});

test('returns matches and teams constrained by their selected parents', async () => {
  const database = new MemoryDatabase();
  const matches = await getComplementaryStatsOptions(database, new URLSearchParams('type=matches&competitionId=3&matchday=1'));
  assert.match(matches[0].name, /Brafa 55 - 49 Rival/);
  const teams = await getComplementaryStatsOptions(database, new URLSearchParams('type=teams&matchId=4'));
  assert.deepEqual(teams.map((team) => team.id), [5, 6]);
});

test('updates only mapped complementary fields for the resolved player row', async () => {
  const database = new MemoryDatabase();
  const result = await importComplementaryStats(database, validContext, [validRow]);
  const saved = database.tables.estadisticas_jugador_partido[0];
  assert.deepEqual(result, { updatedRows: 1, updatedDorsals: ['2'], teamName: 'Brafa' });
  assert.equal(saved.puntos, 17);
  assert.equal(saved.tiempo_jugado, 1710);
  assert.deepEqual({
    t2_anotados: saved.t2_anotados,
    t2_intentados: saved.t2_intentados,
    t3_anotados: saved.t3_anotados,
    t3_intentados: saved.t3_intentados,
    t1_anotados: saved.t1_anotados,
    t1_intentados: saved.t1_intentados,
    rebotes_totales: saved.rebotes_totales,
    asistencias: saved.asistencias,
    robos: saved.robos,
    perdidas: saved.perdidas
  }, {
    t2_anotados: 6,
    t2_intentados: 16,
    t3_anotados: 0,
    t3_intentados: 0,
    t1_anotados: 5,
    t1_intentados: 12,
    rebotes_totales: 4,
    asistencias: 0,
    robos: 1,
    perdidas: 5
  });
  assert.equal(database.writeCount, 1);
});

test('reimports into the same existing match fixture without creating duplicate stats rows', async () => {
  const database = new MemoryDatabase();
  const firstResult = await importComplementaryStats(database, validContext, [validRow]);
  const secondResult = await importComplementaryStats(database, validContext, [validRow]);
  assert.deepEqual(firstResult, { updatedRows: 1, updatedDorsals: ['2'], teamName: 'Brafa' });
  assert.deepEqual(secondResult, firstResult);
  assert.equal(database.tables.estadisticas_jugador_partido.length, 2);
  assert.equal(database.tables.estadisticas_jugador_partido[0].t2_anotados, 6);
  assert.equal(database.writeCount, 2);
});

test('does not report success when RLS silently updates no rows', async () => {
  const database = new MemoryDatabase();
  database.ignoreUpdates = true;
  await assert.rejects(importComplementaryStats(database, validContext, [validRow]), /no se actualizó ninguna fila/);
  assert.equal(database.writeCount, 0);
});

const assertRejectedWithoutWrites = async (requestContext: unknown, rows: unknown, expectedMessage?: RegExp) => {
  const database = new MemoryDatabase();
  if (expectedMessage) {
    await assert.rejects(importComplementaryStats(database, requestContext, rows), expectedMessage);
  } else {
    await assert.rejects(importComplementaryStats(database, requestContext, rows));
  }
  assert.equal(database.writeCount, 0);
};

test('rejects a match aggregation that is not confirmed as exactly one match', async () => {
  await assertRejectedWithoutWrites({ ...validContext, includedMatchCount: 2 }, [validRow], /únicamente el partido/);
});

test('rejects a dorsal with no roster match before writing', async () => {
  await assertRejectedWithoutWrites(validContext, [{ ...validRow, jerseyNumber: '99' }], /no pertenece a la plantilla/);
});

test('rejects a dorsal duplicated in the selected team roster before writing', async () => {
  const database = new MemoryDatabase();
  database.tables.plantillas.push({ equipo_id: 5, jugador_id: 11, dorsal: '2' });
  await assert.rejects(importComplementaryStats(database, validContext, [validRow]), /está repetido en el equipo/);
  assert.equal(database.writeCount, 0);
});

test('rejects made totals above attempts before writing', async () => {
  await assertRejectedWithoutWrites(validContext, [{ ...validRow, t2Made: 17 }], /no pueden superar/);
});

test('rejects a mismatched competition context before writing', async () => {
  await assertRejectedWithoutWrites({ ...validContext, seasonId: '999' }, [validRow], /no pertenece a la temporada/);
});

test('rejects duplicate dorsal rows before writing', async () => {
  const database = new MemoryDatabase();
  await assert.rejects(importComplementaryStats(database, validContext, [validRow, validRow]), /Dorsal duplicado/);
  assert.equal(database.writeCount, 0);
});