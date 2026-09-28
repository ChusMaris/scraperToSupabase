import assert from 'node:assert/strict';
import test from 'node:test';

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { normalizeFederationMatch } from '../federationNormalizer';
import { persistFederationMatchToLegacy } from '../federationLegacyWriter';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const stats = JSON.parse(readFileSync(resolve(__dirname, '../../../stats.json'), 'utf8'));
const pbp = JSON.parse(readFileSync(resolve(__dirname, '../../../pbp.json'), 'utf8'));

const createRecordingDatabase = () => {
  const operations: Array<{ table: string; method: string; value?: any }> = [];
  let nextId = 0;

  const from = (table: string) => {
    let data: any = [];
    const query: any = {
      upsert(value: any) {
        operations.push({ table, method: 'upsert', value });
        data = { id: `${table}-${++nextId}` };
        return query;
      },
      insert(value: any) {
        operations.push({ table, method: 'insert', value });
        data = value;
        return query;
      },
      delete() {
        operations.push({ table, method: 'delete' });
        data = [];
        return query;
      },
      select() {
        return query;
      },
      single() {
        return Promise.resolve({ data, error: null });
      },
      eq() {
        return query;
      },
      in() {
        return query;
      },
      then(resolve: (value: any) => unknown, reject: (reason: unknown) => unknown) {
        return Promise.resolve({ data, error: null }).then(resolve, reject);
      }
    };
    return query;
  };

  return { database: { from }, operations };
};

test('persists the normalized match only through existing legacy tables', async () => {
  const normalized = normalizeFederationMatch(stats, pbp);
  const { database, operations } = createRecordingDatabase();
  const result = await persistFederationMatchToLegacy(
    normalized,
    { temporada: '2026/27', categoria: normalized.category.name, competicion: normalized.competition.name },
    7,
    'https://www.basquetcatala.cat/match/95332c8d-eefc-43ed-ac9a-d9af7d4f926d',
    database
  );

  const writtenTables = new Set(operations.map(operation => operation.table));
  assert.equal(result.externalMatchId, '95332c8d-eefc-43ed-ac9a-d9af7d4f926d');
  assert.equal(result.seasonName, '2026/27');
  assert.equal(writtenTables.has('temporadas'), true);
  assert.equal(writtenTables.has('categorias'), true);
  assert.equal(writtenTables.has('competiciones'), true);
  assert.equal(writtenTables.has('partidos'), true);
  assert.equal(writtenTables.has('jugadores'), true);
  assert.equal(writtenTables.has('estadisticas_jugador_partido'), true);
  assert.equal(writtenTables.has('detalle_tiros_jugador'), true);
  assert.equal(writtenTables.has('partido_marcador_evolucion'), true);
  assert.equal(writtenTables.has('partido_movimientos'), true);
  assert.equal([...writtenTables].every(table => !table.startsWith('fed_')), true);

  const matchWrite = operations.find(operation => operation.table === 'partidos' && operation.method === 'upsert');
  assert.equal(matchWrite?.value.jornada, 7);
  assert.equal(matchWrite?.value.puntos_local, normalized.match.finalScoreLocal);
  assert.equal(matchWrite?.value.puntos_visitante, normalized.match.finalScoreVisitor);
});
