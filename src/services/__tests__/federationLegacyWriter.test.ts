import assert from 'node:assert/strict';
import test from 'node:test';

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { normalizeFederationMatch } from '../federationNormalizer';
import { persistFederationMatchToLegacy, toLegacyBigintId } from '../federationLegacyWriter';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const stats = JSON.parse(readFileSync(resolve(__dirname, '../../../stats.json'), 'utf8'));
const pbp = JSON.parse(readFileSync(resolve(__dirname, '../../../pbp.json'), 'utf8'));

const createRecordingDatabase = (rpcError: { message: string } | null = null) => {
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

  const rpc = (name: string, value: any) => {
    operations.push({ table: name, method: 'rpc', value });
    return Promise.resolve({ data: rpcError ? null : 'live-match-row-id', error: rpcError });
  };

  return { database: { from, rpc }, operations };
};

test('persists the normalized match only through existing legacy tables', async () => {
  const normalized = normalizeFederationMatch(stats, pbp);
  const { database, operations } = createRecordingDatabase();
  const progressLogs: string[] = [];
  const result = await persistFederationMatchToLegacy(
    normalized,
    { temporada: '2026/27', categoria: normalized.category.name, competicion: normalized.competition.name },
    7,
    'https://www.basquetcatala.cat/match/95332c8d-eefc-43ed-ac9a-d9af7d4f926d',
    database,
    message => progressLogs.push(message)
  );

  const writtenTables = new Set(operations.map(operation => operation.table));
  assert.equal(operations.some(operation => operation.method === 'rpc'), false);
  assert.equal(result.sourceMatchId, '95332c8d-eefc-43ed-ac9a-d9af7d4f926d');
  assert.match(result.externalMatchId, /^\d+$/);
  assert.equal(result.externalMatchId, toLegacyBigintId(result.sourceMatchId));
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
  assert.equal(matchWrite?.value.id_match_extern, result.externalMatchId);
  assert.equal(matchWrite?.value.fecha_hora, new Date(stats.header.date).toISOString());
  assert.equal(matchWrite?.value.puntos_local, stats.header.score.local);
  assert.equal(matchWrite?.value.puntos_visitante, stats.header.score.visitor);
  assert.equal(result.fechaHora, new Date(stats.header.date).toISOString());
  assert.equal(result.puntosLocal, stats.header.score.local);
  assert.equal(result.puntosVisitante, stats.header.score.visitor);
  assert.ok(progressLogs.some(message => message.includes('Guardando temporada')));
  assert.ok(progressLogs.some(message => message.includes('Guardando estadísticas de')));
  assert.ok(progressLogs.some(message => message.includes('Guardando 276 eventos')));
  assert.ok(progressLogs.some(message => message.includes('Importación completa')));
  assert.equal(matchWrite?.value.puntos_local, normalized.match.finalScoreLocal);
  assert.equal(matchWrite?.value.puntos_visitante, normalized.match.finalScoreVisitor);

  const teamWrites = operations.filter(operation => operation.table === 'equipos' && operation.method === 'upsert');
  assert.equal(teamWrites.length, 2);
  assert.equal(teamWrites.every(operation => !('team_id_intern_fce' in operation.value)), true);

  const playerWrites = operations.filter(operation => operation.table === 'jugadores' && operation.method === 'upsert');
  assert.equal(playerWrites.length, normalized.players.length);
  assert.equal(playerWrites.every(operation => /^\d+$/.test(String(operation.value.actor_id))), true);
  assert.equal(
    playerWrites[0].value.actor_id,
    toLegacyBigintId(normalized.players[0].externalUuid ?? normalized.players[0].id)
  );
});

test('uses the direct-match ID as the stable legacy match identity when provided', async () => {
  const normalized = normalizeFederationMatch(stats, pbp);
  const { database, operations } = createRecordingDatabase();
  const result = await persistFederationMatchToLegacy(
    normalized,
    { temporada: '2026/27', categoria: normalized.category.name, competicion: normalized.competition.name },
    7,
    'https://www.basquetcatala.cat/estadistica/partit/95332c8d-eefc-43ed-ac9a-d9af7d4f926d',
    database,
    undefined,
    '302113'
  );

  assert.equal(result.sourceMatchId, '302113');
  assert.equal(result.externalMatchId, '302113');
  const rpcCall = operations.find(operation => operation.table === 'replace_live_match_snapshot' && operation.method === 'rpc');
  assert.equal(rpcCall?.value.p_match.id_match_extern, '302113');
  assert.equal(operations.some(operation => operation.table === 'partidos' && operation.method === 'upsert'), false);
  assert.equal(operations.some(operation => operation.table === 'partido_movimientos' && operation.method === 'delete'), false);
});

test('uses a separate service-role database client for the live snapshot RPC', async () => {
  const normalized = normalizeFederationMatch(stats, pbp);
  const { database: anonDatabase, operations: anonOperations } = createRecordingDatabase();
  const { database: serviceDatabase, operations: serviceOperations } = createRecordingDatabase();

  await persistFederationMatchToLegacy(
    normalized,
    { temporada: '2026/27', categoria: normalized.category.name, competicion: normalized.competition.name },
    7,
    undefined,
    anonDatabase,
    undefined,
    '302113',
    serviceDatabase
  );

  assert.equal(anonOperations.some(operation => operation.method === 'rpc'), false);
  assert.equal(
    serviceOperations.filter(operation => operation.table === 'replace_live_match_snapshot' && operation.method === 'rpc').length,
    1
  );
  assert.equal(anonOperations.some(operation => operation.table === 'jugadores' && operation.method === 'upsert'), true);
});

test('reports live snapshot RPC failures without falling back to non-atomic writes', async () => {
  const normalized = normalizeFederationMatch(stats, pbp);
  const { database, operations } = createRecordingDatabase({ message: 'transaction failed' });

  await assert.rejects(
    persistFederationMatchToLegacy(
      normalized,
      { temporada: '2026/27', categoria: normalized.category.name, competicion: normalized.competition.name },
      7,
      undefined,
      database,
      undefined,
      '302113'
    ),
    /Sustitución transaccional del snapshot: transaction failed/
  );
  assert.equal(operations.some(operation => operation.table === 'partidos' && operation.method === 'upsert'), false);
  assert.equal(operations.some(operation => operation.table === 'partido_marcador_evolucion' && operation.method === 'delete'), false);
});

test('deduplicates movement rows by event UUID before calling the live snapshot RPC', async () => {
  const normalized = normalizeFederationMatch(stats, pbp);
  const event = normalized.events[0];
  const duplicatedSnapshot = {
    ...normalized,
    events: [...normalized.events, { ...event, localScore: 99 }]
  };
  const { database, operations } = createRecordingDatabase();

  await persistFederationMatchToLegacy(
    duplicatedSnapshot,
    { temporada: '2026/27', categoria: normalized.category.name, competicion: normalized.competition.name },
    7,
    undefined,
    database,
    undefined,
    '302113'
  );

  const rpcCall = operations.find(operation => operation.table === 'replace_live_match_snapshot');
  const movements = rpcCall?.value.p_movements as Array<{ event_uuid: string; marcador: string }>;
  assert.equal(new Set(movements.map(movement => movement.event_uuid)).size, movements.length);
  assert.equal(movements.find(movement => movement.event_uuid === event.eventUuid)?.marcador, '99-0');
});

test('replaces successive live snapshots using one identity and the newest child rows', async () => {
  const normalized = normalizeFederationMatch(stats, pbp);
  const { database, operations } = createRecordingDatabase();
  const metadata = {
    temporada: '2026/27',
    categoria: normalized.category.name,
    competicion: normalized.competition.name
  };
  const first = await persistFederationMatchToLegacy(
    normalized, metadata, 7, undefined, database, undefined, '302113'
  );
  const extraEvent = {
    ...normalized.events[normalized.events.length - 1],
    eventUuid: '9a64cc1c-3241-4e1c-ab2e-ace6dfd5b44b',
    localScore: (normalized.match.finalScoreLocal ?? 0) + 1
  };
  const laterSnapshot = {
    ...normalized,
    match: { ...normalized.match, finalScoreLocal: extraEvent.localScore },
    events: [...normalized.events, extraEvent]
  };
  const second = await persistFederationMatchToLegacy(
    laterSnapshot, metadata, 7, undefined, database, undefined, '302113'
  );
  const rpcCalls = operations.filter(operation => operation.table === 'replace_live_match_snapshot');

  assert.equal(first.sourceMatchId, second.sourceMatchId);
  assert.equal(first.externalMatchId, second.externalMatchId);
  assert.equal(rpcCalls.length, 2);
  assert.equal(rpcCalls[0].value.p_match.id_match_extern, rpcCalls[1].value.p_match.id_match_extern);
  assert.equal(rpcCalls[1].value.p_match.puntos_local, extraEvent.localScore);
  assert.ok(rpcCalls[1].value.p_movements.some((movement: { event_uuid: string }) =>
    movement.event_uuid === extraEvent.eventUuid
  ));
});

test('rejects missing match date or score before writing any database row', async () => {
  const normalized = normalizeFederationMatch(stats, pbp);
  const { database, operations } = createRecordingDatabase();

  await assert.rejects(
    persistFederationMatchToLegacy(
      { ...normalized, match: { ...normalized.match, date: null } },
      { temporada: '2026/27', categoria: normalized.category.name, competicion: normalized.competition.name },
      1,
      undefined,
      database
    ),
    /header\.date/
  );
  assert.equal(operations.length, 0);

  await assert.rejects(
    persistFederationMatchToLegacy(
      { ...normalized, match: { ...normalized.match, finalScoreVisitor: null } },
      { temporada: '2026/27', categoria: normalized.category.name, competicion: normalized.competition.name },
      1,
      undefined,
      database
    ),
    /header\.score\.visitor/
  );
  assert.equal(operations.length, 0);
});

test('keeps legacy numeric match IDs intact and hashes UUIDs deterministically', () => {
  const uuid = 'e1d84c8f-dcf4-4840-8c59-b161140248ee';
  const hashedId = toLegacyBigintId(uuid);

  assert.equal(toLegacyBigintId('20170042'), '20170042');
  assert.equal(toLegacyBigintId(uuid), hashedId);
  assert.match(hashedId, /^\d+$/);
  assert.ok(BigInt(hashedId) <= 9_223_372_036_854_775_807n);
});
