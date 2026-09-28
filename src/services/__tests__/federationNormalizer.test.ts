import assert from 'node:assert/strict';
import test from 'node:test';

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { normalizeFederationMatch } from '../federationNormalizer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const stats = JSON.parse(readFileSync(resolve(__dirname, '../../../stats.json'), 'utf8'));
const pbp = JSON.parse(readFileSync(resolve(__dirname, '../../../pbp.json'), 'utf8'));

test('normalizeFederationMatch maps header and teams into canonical records', () => {
  const result = normalizeFederationMatch(stats, pbp);

  assert.equal(result.season.name, '2026/27');
  assert.equal(result.category.name, 'C.C. JÚNIOR MASCULÍ NIVELL A');
  assert.equal(result.competition.name, 'FASE REGULAR');
  assert.equal(result.match.localTeamName, 'FUNDACIÓ BRAFA A');
  assert.equal(result.match.visitorTeamName, 'ARESA SHIPYARD ARENYS BÀSQUET VERD');
  assert.equal(result.teams.length, 2);
  assert.ok(result.players.length > 0);
});

test('normalizeFederationMatch extracts score evolution and play by play events', () => {
  const result = normalizeFederationMatch(stats, pbp);

  assert.ok(result.scoreEvolution.length > 0);
  assert.ok(result.events.length > 0);
  assert.ok(result.shots.length > 0);
  assert.equal(result.events[0].eventTypeCode, 'INIPER');
  assert.equal(result.scoreEvolution[0].localScore, 0);
  assert.equal(result.scoreEvolution[0].visitorScore, 2);
  assert.ok(result.scoreEvolution.some(entry => entry.localScore === 15 && entry.visitorScore === 13));
});
