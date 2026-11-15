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

test('does not use a player UUID as the event UUID when the event UUID is missing', () => {
  const playerUuid = '2fc6dcd9-a5ce-4d4d-a066-3655c936345b';
  const normalized = normalizeFederationMatch(stats, {
    playByPlay: [
      {
        eventTypeId: 524,
        eventTypeCode: 'D2',
        period: 1,
        minute: 9,
        second: 43,
        localScore: 0,
        visitorScore: 2,
        uuid: playerUuid,
        actorName: 'YAGO WERLIK MIRAVET',
        dorsal: '17'
      },
      {
        eventTypeId: 531,
        eventTypeCode: 'P',
        period: 1,
        minute: 8,
        second: 32,
        localScore: 0,
        visitorScore: 2,
        uuid: playerUuid,
        actorName: 'YAGO WERLIK MIRAVET',
        dorsal: '17'
      }
    ]
  });

  assert.equal(normalized.events.length, 2);
  assert.notEqual(normalized.events[0].eventUuid, normalized.events[1].eventUuid);
  assert.notEqual(normalized.events[0].eventUuid, playerUuid);
  assert.equal(normalized.events[0].playerId, normalized.events[1].playerId);
});

test('does not use a player UUID as the shot UUID when the shot identifier is missing', () => {
  const playerUuid = '2fc6dcd9-a5ce-4d4d-a066-3655c936345b';
  const normalized = normalizeFederationMatch({
    ...stats,
    shotChart: {
      local: [
        { uuid: playerUuid, actorName: 'YAGO WERLIK MIRAVET', period: 1, x: 10, y: 20, made: true, type: '2pt' },
        { uuid: playerUuid, actorName: 'YAGO WERLIK MIRAVET', period: 1, x: 30, y: 40, made: true, type: '2pt' }
      ],
      visitor: []
    }
  }, { playByPlay: [] });

  assert.equal(normalized.shots.length, 2);
  assert.notEqual(normalized.shots[0].eventUuid, normalized.shots[1].eventUuid);
  assert.ok(normalized.shots.every(shot => shot.eventUuid !== playerUuid));
  assert.equal(normalized.shots[0].playerId, normalized.shots[1].playerId);
});
