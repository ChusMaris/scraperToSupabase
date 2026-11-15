## 1. Confirm the direct-match payload

- [x] 1.1 Compare the supplied live JSON example with the normalizer's required stats and play-by-play fields; document the verified field and actor mapping in API tests.

## 2. Add stable live-match identity

- [x] 2.1 Extend `POST /api/federation/import` validation and request handling to accept an optional numeric `liveMatchId` while preserving existing request aliases.
- [x] 2.2 Pass the direct-match ID to persistence and prioritize it when deriving `sourceMatchId` and the legacy match ID.
- [x] 2.3 Resolve PBP players from actor UUID/name/dorsal/team when available, preserve non-player events and event type identifiers, derive score evolution from PBP when absent, and reject incomplete payloads without fabricating player statistics.

## 3. Verify repeated snapshot persistence

- [x] 3.1 Add API/persistence tests proving repeated snapshots retain one match and replace its movements, score evolution, shots, and player statistics.
- [x] 3.2 Add tests for a later snapshot with new movements, invalid IDs, incomplete payloads, and compatibility with requests without `liveMatchId`.
- [x] 3.3 Add an additive Supabase RPC migration that atomically upserts a live match and replaces its match-specific rows; keep requests without `liveMatchId` on the existing write path.
- [ ] 3.4 Verify against Supabase that a failed RPC replacement leaves the prior snapshot intact (legacy requests are unit-tested not to invoke the RPC).
- [x] 3.5 Keep movement UUIDs distinct from player UUIDs, namespace them by live match, and deduplicate repeated movement IDs before calling the snapshot RPC.
- [x] 3.6 Keep shot UUIDs distinct from player UUIDs, namespace them by live match, and deduplicate repeated shot IDs before calling the snapshot RPC.

## 4. Document and validate the API contract

- [x] 4.1 Update OpenAPI and API documentation with `liveMatchId`, the accepted snapshot shape, and repeated-import semantics.
- [x] 4.2 Run targeted API tests and the API TypeScript build.
