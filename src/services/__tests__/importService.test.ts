import assert from 'node:assert/strict';
import test from 'node:test';

import { getMatchScorePreview } from '../importService';
import { PROXY_PROVIDERS } from '../scraperService';

test('getMatchScorePreview uses the latest score from score evolution when available', () => {
  const mainJson = {
    score: [
      { local: 10, visit: 12 },
      { local: 72, visit: 68 }
    ]
  };

  assert.equal(getMatchScorePreview(mainJson), '72-68');
});

test('getMatchScorePreview falls back to player stats when score evolution is missing', () => {
  const mainJson = {
    teams: [
      {
        players: [{ teamScore: 53, oppScore: 61 }]
      }
    ]
  };

  assert.equal(getMatchScorePreview(mainJson), '53-61');
});

test('proxy list works without any local API server', () => {
  assert.ok(PROXY_PROVIDERS.every(provider => provider.name !== 'local-fetcher'));
});
