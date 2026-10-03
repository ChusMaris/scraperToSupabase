import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const parserSource = readFileSync(new URL('./parse-stats.js', import.meta.url), 'utf8');
const contentSource = readFileSync(new URL('./content.js', import.meta.url), 'utf8');
const headers = [
  '# JUGADOR', 'PJ', 'MIN', 'PTS (P/P)', 'T2 (M/A %)', 'T3 (M/A %)',
  'TL (M/A %)', 'REB', 'AST', 'ROB', 'PER', 'VAL (P/P)'
];
const victor = ['#2 Victor', '1', '28:31 min', '17 (17)', '6/16 (38%)', '0/0 (0%)', '5/12 (42%)', '4', '0', '1', '5', '0 (0)'];

const capture = (countText, playerRows = [victor]) => {
  const rows = [headers, ...playerRows].map((values) => ({
    children: values.map((value) => ({ innerText: value, textContent: value }))
  }));
  const table = { children: [], querySelectorAll: () => rows };
  const context = {
    document: {
      body: { innerText: `Estadísticas acumuladas de los jugadores en los ${countText} partidos incluidos` },
      querySelectorAll: () => [table]
    },
    chrome: { runtime: { onMessage: { addListener: (listener) => { context.listener = listener; } } } }
  };
  vm.runInNewContext(parserSource, context);
  vm.runInNewContext(contentSource, context);
  let response;
  context.listener({ type: 'CAPTURE_COMPLEMENTARY_STATS' }, {}, (value) => { response = value; });
  return response;
};

test('extracts and maps the visible player row from the source table', () => {
  const result = capture('1 de 15 incluidos');
  assert.equal(result.ok, true);
  assert.equal(result.data.includedMatchCount, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(result.data.rows[0])), {
    jerseyNumber: '2', playerName: 'Victor', t2Made: 6, t2Attempted: 16,
    t3Made: 0, t3Attempted: 0, tlMade: 5, tlAttempted: 12,
    rebounds: 4, assists: 0, steals: 1, turnovers: 5
  });
});

test('blocks aggregate data for multiple matches', () => {
  const result = capture('2');
  assert.equal(result.ok, false);
  assert.match(result.error, /exactamente un partido|acumula 2 partidos/);
});

test('reports an unrecognized shooting value instead of guessing', () => {
  const malformed = [...victor];
  malformed[4] = '6 de 16';
  const result = capture('1', [malformed]);
  assert.equal(result.ok, false);
  assert.match(result.error, /Estadística no reconocida/);
});