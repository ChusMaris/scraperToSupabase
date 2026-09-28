## 1. Import contract and URL resolution

- [ ] 1.1 Update match ID extraction to accept both legacy Mongo IDs and UUIDs.
- [ ] 1.2 Add federation URL builders for the `/matches/{uuid}/stats` and `/matches/{uuid}/pbp` endpoints.
- [ ] 1.3 Keep the current batch URL input and `matchday;url` parsing behavior intact.

## 2. Data fetching and validation

- [ ] 2.1 Replace legacy fetch logic with the new federation stats and PBP fetch flow.
- [ ] 2.2 Validate the payload structure before normalization begins.
- [ ] 2.3 Handle failures and message reporting per match in the same job pipeline.

## 3. Federation normalization layer

- [ ] 3.1 Define canonical entities for season, category, competition, group, club, team, player, roster, match, score evolution, events, and shots.
- [ ] 3.2 Map `header` and `boxscore` into the canonical domain model.
- [ ] 3.3 Map `playByPlay` entries into canonical `match_events` records with UUID deduplication.
- [ ] 3.4 Map `scoreEvolution` and `shotChart` into the canonical relational model.

## 4. Persistence and idempotence

- [ ] 4.1 Add upsert logic keyed by external UUIDs and business keys.
- [ ] 4.2 Prevent duplicate inserts for repeated imports of the same match.
- [ ] 4.3 Ensure team/player/roster relationships are recreated consistently.
- [ ] 4.4 Validate the final imported match against the normalized relational schema.

## 5. Integration and verification

- [ ] 5.1 Wire the new federation adapter into the existing import pipeline.
- [ ] 5.2 Run a real sample import using a UUID-based match URL.
- [ ] 5.3 Verify the logged result matches the expected stats and event data.
- [ ] 5.4 Run the project build to confirm no TypeScript regressions.
