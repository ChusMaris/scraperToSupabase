# Federation Import API

This Express API receives the match payload captured by the Chrome extension, validates it, normalizes it with the canonical federation normalizer, and writes the result into Supabase.

## Environment

Create a `.env` file in this folder with:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
COMPLEMENTARY_STATS_API_TOKEN=replace-with-a-long-random-secret
PORT=4000
```

## Local development

```bash
npm install
npm run dev
```

Run the API unit tests and strict TypeScript check with:

```bash
npm test
npm run build
```

## Deploy to Render

Use the repository root `render.yaml` file with a `rootDir: api` configuration, or create a Render web service pointing to the `api` directory and use these build/start commands:

```bash
npm install
npm run build
npm start
```

## Endpoint

Interactive OpenAPI documentation is served at `/api-docs`; the raw OpenAPI document is available at `/openapi.json`. The API currently exposes health, federation options/import, and complementary-statistics options/import operations.

The extension loads its editable catalog suggestions from the existing legacy tables through:

```http
GET /api/federation/options
```

This reads `temporadas`, `categorias`, `competiciones`, and `partidos` from the existing database.

Federation imports are normalized and persisted to the existing legacy tables. No additional tables or SQL migration are required.

```http
POST /api/federation/import
Content-Type: application/json
```

Example body:

```json
{
  "statsPayload": { "header": {}, "boxscore": [] },
  "pbpPayload": { "playByPlay": [] }
}
```

## Complementary player statistics

The Chrome extension uses a separate endpoint. Catalog options are returned at the requested level and filtered by their selected parents:

```http
GET /api/complementary-stats/options?type=seasons
GET /api/complementary-stats/options?type=categories&seasonId=...
GET /api/complementary-stats/options?type=competitions&seasonId=...&categoryId=...
GET /api/complementary-stats/options?type=matchdays&competitionId=...
GET /api/complementary-stats/options?type=matches&competitionId=...&matchday=...
GET /api/complementary-stats/options?type=teams&matchId=...
```

Writes require `COMPLEMENTARY_STATS_API_TOKEN` and a Bearer authorization header:

```http
POST /api/complementary-stats/import
Authorization: Bearer <configured-token>
Content-Type: application/json
```

```json
{
  "context": {
    "seasonId": "1",
    "categoryId": "2",
    "competitionId": "3",
    "matchday": 1,
    "matchId": "4",
    "teamId": "5",
    "includedMatchCount": 1,
    "confirmedSingleMatch": true
  },
  "rows": [
    {
      "jerseyNumber": "2",
      "playerName": "Victor",
      "t2Made": 6,
      "t2Attempted": 16,
      "t3Made": 0,
      "t3Attempted": 0,
      "tlMade": 5,
      "tlAttempted": 12,
      "rebounds": 4,
      "assists": 0,
      "steals": 1,
      "turnovers": 5
    }
  ]
}
```

The endpoint validates the selected relationships and resolves each dorsal against that team's roster and the selected match before writing. It updates only the ten complementary statistics and never creates a missing match-statistics row. The extension stores the API base URL and token in its local Chrome storage; configure the token only for trusted installations.

**Security limitation:** the existing database RLS policy grants `UPDATE` to the Supabase `anon` role. The Bearer token protects this API route but does not make that existing direct database policy private; review RLS separately before treating the database as restricted to trusted users.
