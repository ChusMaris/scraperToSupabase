import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeFederationMatch } from '../src/services/federationNormalizer.js';
import {
  getLiveMatchId,
  validateFederationImportBody,
  validateLiveScoreUpdateBody
} from './federationImport.js';

const localTeamUuid = 'f0da967b-481f-41a6-a06e-aa6e6bd21b01';
const visitorTeamUuid = 'a9f80760-ac96-4c2a-96b5-ede73f32149a';
const playerUuid = '4cb759d9-14ad-4411-b6c6-9d0a8b0a2010';

const statsPayload = {
  header: {
    date: '2026-11-09T18:00:00.000+0000',
    localTeam: { uuid: localTeamUuid, name: 'CBT ARRABASSADA', shortName: 'CBT' },
    visitorTeam: { uuid: visitorTeamUuid, name: 'PLOMS SALLE REUS PIMU13', shortName: 'PLO' },
    score: { local: 2, visitor: 0 }
  },
  boxscore: [{
    period: 0,
    local: { uuid: localTeamUuid, name: 'CBT ARRABASSADA', players: [{ uuid: playerUuid }] },
    visitor: { uuid: visitorTeamUuid, name: 'PLOMS SALLE REUS PIMU13', players: [] }
  }],
  shotChart: { local: [], visitor: [] }
};

const pbpPayload = {
  playByPlay: [
    {
      eventTypeId: 524,
      eventSubTypeId: 93,
      eventTypeCode: 'D2',
      period: 1,
      minute: 5,
      second: 2,
      localScore: 2,
      visitorScore: 0,
      eventUuid: '9a64cc1c-3241-4e1c-ab2e-ace6dfd5b44a',
      uuid: playerUuid,
      dorsal: '7',
      actorName: 'Player One',
      teamUuid: localTeamUuid
    },
    {
      eventTypeId: 121,
      eventSubTypeId: 121,
      eventTypeCode: 'INIPER',
      period: 1,
      minute: 6,
      localScore: 2,
      visitorScore: 0,
      eventUuid: 'dd094f70-b39c-454a-b948-697216859f90'
    }
  ]
};

test('validates complete direct-match snapshots and keeps legacy aliases compatible', () => {
  assert.equal(validateFederationImportBody({
    liveMatchId: '302113',
    statsPayload,
    pbpPayload
  }), null);

  assert.equal(validateFederationImportBody({
    mainJson: {},
    movesJson: {}
  }), null);
});

test('keeps live snapshots off the legacy endpoint and requires the ID on the live endpoint', () => {
  assert.equal(validateFederationImportBody({
    mainJson: {},
    movesJson: {}
  }, 'legacy'), null);
  assert.match(validateFederationImportBody({
    liveMatchId: '302113',
    statsPayload,
    pbpPayload
  }, 'legacy') ?? '', /live-import/);
  assert.match(validateFederationImportBody({
    statsPayload,
    pbpPayload
  }, 'live') ?? '', /require liveMatchId/);
  assert.equal(validateFederationImportBody({
    liveMatchId: '302113',
    statsPayload,
    pbpPayload
  }, 'live'), null);
});

test('rejects invalid direct-match IDs and incomplete live payloads', () => {
  assert.match(validateFederationImportBody({
    liveMatchId: '30/2113',
    statsPayload,
    pbpPayload
  }) ?? '', /positive numeric ID/);
  assert.match(validateFederationImportBody({
    liveMatchId: '302113',
    statsPayload: { ...statsPayload, header: { ...statsPayload.header, score: undefined } },
    pbpPayload
  }) ?? '', /header\.score/);
  assert.match(validateFederationImportBody({
    liveMatchId: '302113',
    statsPayload,
    pbpPayload: { playByPlay: null }
  }) ?? '', /playByPlay arrays/);
  assert.throws(() => getLiveMatchId({ liveMatchId: '9223372036854775808' }), /legacy database range/);
});

test('validates incremental live-score updates without requiring a full snapshot', () => {
  assert.equal(validateLiveScoreUpdateBody({
    liveMatchId: '302113',
    localScore: 63,
    visitorScore: 34
  }), null);
  assert.match(validateLiveScoreUpdateBody({
    liveMatchId: '302113',
    localScore: -1,
    visitorScore: 34
  }) ?? '', /localScore must be a non-negative safe integer/);
  assert.match(validateLiveScoreUpdateBody({
    liveMatchId: '302113',
    localScore: 63.5,
    visitorScore: 34
  }) ?? '', /localScore must be a non-negative safe integer/);
  assert.match(validateLiveScoreUpdateBody({
    liveMatchId: 'bad',
    localScore: 63,
    visitorScore: 34
  }) ?? '', /positive numeric ID/);
});

test('uses play-by-play actor identity for players and retains events without actors', () => {
  const normalized = normalizeFederationMatch(statsPayload, pbpPayload);
  const player = normalized.players.find(item => item.externalUuid === playerUuid);

  assert.equal(normalized.players.length, 1);
  assert.equal(normalized.playerStats.length, 0);
  assert.equal(player?.name, 'Player One');
  assert.equal(player?.dorsal, '7');
  assert.equal(player?.teamId, normalized.teams[0].id);
  assert.equal(normalized.events[0].playerId, player?.id);
  assert.equal(normalized.events[0].externalEventTypeId, 524);
  assert.equal(normalized.events[0].eventTypeCode, 'D2');
  assert.equal(normalized.events[1].playerId, null);
  assert.equal(normalized.events[1].externalEventTypeId, 121);
  assert.equal(normalized.events[1].eventTypeCode, 'INIPER');
  assert.deepEqual(normalized.scoreEvolution, [{
    period: 1,
    minute: 5,
    second: 2,
    localScore: 2,
    visitorScore: 0
  }]);
});

test('links named PBP actors by name, dorsal, and team when a UUID is absent', () => {
  const normalized = normalizeFederationMatch(statsPayload, {
    playByPlay: [{
      eventTypeId: 115,
      eventTypeCode: 'OUT',
      period: 1,
      minute: 4,
      second: 0,
      eventUuid: '9a64cc1c-3241-4e1c-ab2e-ace6dfd5b44b',
      actorName: 'Player Without UUID',
      dorsal: '12',
      teamUuid: localTeamUuid
    }]
  });

  assert.equal(normalized.players[0].name, 'Player Without UUID');
  assert.equal(normalized.players[0].dorsal, '12');
  assert.equal(normalized.players[0].teamId, normalized.teams[0].id);
  assert.equal(normalized.players[0].externalUuid, null);
  assert.equal(normalized.events[0].playerId, normalized.players[0].id);
});
