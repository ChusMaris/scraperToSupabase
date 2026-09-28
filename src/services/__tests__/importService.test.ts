import assert from 'node:assert/strict';
import test from 'node:test';

import { getMatchScorePreview, parseImportUrlEntries, resolveJornadaForJob } from '../importService';
import { PROXY_PROVIDERS, buildFederationMatchUrls, buildLocalProxyUrl } from '../scraperService';
import { extractMatchId } from '../../types';

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

test('parseImportUrlEntries accepts legacy and per-line matchday formats in the same input', () => {
  const parsed = parseImportUrlEntries([
    'https://www.basquetcatala.cat/estadistiques/68d7ce4e74669700015dbd23',
    '16;https://www.basquetcatala.cat/estadistiques/68d7ce4e74669700015dbd24'
  ].join('\n'));

  assert.equal(parsed.errors.length, 0);
  assert.equal(parsed.entries.length, 2);
  assert.equal(parsed.entries[0].manualJornadaOverride, null);
  assert.equal(parsed.entries[1].manualJornadaOverride, 16);
});

test('parseImportUrlEntries reports invalid lines and ignores blanks', () => {
  const parsed = parseImportUrlEntries([
    '',
    'abc;https://www.basquetcatala.cat/estadistiques/68d7ce4e74669700015dbd25',
    '17;',
    'https://www.basquetcatala.cat/estadistiques/68d7ce4e74669700015dbd26'
  ].join('\n'));

  assert.equal(parsed.entries.length, 1);
  assert.equal(parsed.errors.length, 2);
  assert.equal(parsed.errors[0].lineNumber, 2);
  assert.equal(parsed.errors[1].lineNumber, 3);
});

test('resolveJornadaForJob applies precedence line over global over extracted', () => {
  const withLine = resolveJornadaForJob(16, 12, 9);
  assert.equal(withLine.value, 16);
  assert.equal(withLine.source, 'line');

  const withGlobal = resolveJornadaForJob(null, 12, 9);
  assert.equal(withGlobal.value, 12);
  assert.equal(withGlobal.source, 'manual');

  const withExtracted = resolveJornadaForJob(null, null, 9);
  assert.equal(withExtracted.value, 9);
  assert.equal(withExtracted.source, 'extracted');
});

test('extractMatchId accepts modern federation UUIDs', () => {
  const url = 'https://www.basquetcatala.cat/estadistica/partit/e1d84c8f-dcf4-4840-8c59-b161140248ee';
  assert.equal(extractMatchId(url), 'e1d84c8f-dcf4-4840-8c59-b161140248ee');
});

test('buildFederationMatchUrls creates the new stats and pbp endpoints from the match UUID', () => {
  const urls = buildFederationMatchUrls('e1d84c8f-dcf4-4840-8c59-b161140248ee');

  assert.equal(
    urls.stats,
    'https://msstats.optimalwayconsulting.com/v1/fcbq/matches/e1d84c8f-dcf4-4840-8c59-b161140248ee/stats?currentSeason=true'
  );
  assert.equal(
    urls.pbp,
    'https://msstats.optimalwayconsulting.com/v1/fcbq/matches/e1d84c8f-dcf4-4840-8c59-b161140248ee/pbp?currentSeason=true'
  );
});

test('buildLocalProxyUrl points the browser to the local server proxy to bypass CORS and public proxy blocks', () => {
  const target = 'https://msstats.optimalwayconsulting.com/v1/fcbq/matches/uuid/stats?currentSeason=true';
  assert.equal(
    buildLocalProxyUrl(target),
    '/api/proxy?url=https%3A%2F%2Fmsstats.optimalwayconsulting.com%2Fv1%2Ffcbq%2Fmatches%2Fuuid%2Fstats%3FcurrentSeason%3Dtrue'
  );
});
