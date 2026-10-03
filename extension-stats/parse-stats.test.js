import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const parserContext = {};
vm.runInNewContext(readFileSync(new URL('./parse-stats.js', import.meta.url), 'utf8'), parserContext);
const parser = parserContext.ComplementaryStatsParser;

test('parses made and attempted shots and ignores the displayed percentage', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(parser.parseShooting('6/16 (38%)'))), { made: 6, attempted: 16 });
  assert.deepEqual(JSON.parse(JSON.stringify(parser.parseShooting('0/0 (0%)'))), { made: 0, attempted: 0 });
});

test('rejects malformed shooting cells and impossible made totals', () => {
  assert.equal(parser.parseShooting('6 de 16'), null);
  assert.equal(parser.parseShooting('17/16 (106%)'), null);
  assert.equal(parser.parseShooting('—'), null);
});

test('parses combined and separate dorsal values', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(parser.parsePlayerCell('#2 Victor'))), {
    jerseyNumber: '2',
    playerName: 'Victor'
  });
  assert.equal(parser.parseJersey('#02'), '02');
  assert.equal(parser.parseInteger('0'), 0);
  assert.equal(parser.parseInteger('1 (1)'), null);
});

test('maps the source screenshot headers and ignores non-imported columns', () => {
  const indexes = parser.mapHeaders([
    '# JUGADOR', 'PJ', 'MIN', 'PTS (P/P)', 'T2 (M/A %)', 'T3 (M/A %)',
    'TL (M/A %)', 'REB', 'AST', 'ROB', 'PER', 'VAL (P/P)'
  ]);
  assert.equal(indexes.combinedPlayerIndex, 0);
  assert.equal(indexes.t2, 4);
  assert.equal(indexes.t3, 5);
  assert.equal(indexes.tl, 6);
  assert.equal(indexes.rebounds, 7);
  assert.equal(indexes.turnovers, 10);
});

test('requires one unambiguous included-match count', () => {
  assert.equal(parser.parseIncludedMatchCount('Estadísticas acumuladas en los 1 partidos incluidos · 1 de 15 incluidos'), 1);
  assert.equal(parser.parseIncludedMatchCount('14 partidos incluidos'), 14);
  assert.equal(parser.parseIncludedMatchCount('sin contador de partidos'), null);
  assert.equal(parser.parseIncludedMatchCount('1 partidos incluidos; 2 de 15 incluidos'), null);
});