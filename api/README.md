# Federation Import API

This Express API receives the match payload captured by the Chrome extension, validates it, normalizes it with the canonical federation normalizer, and writes the result into Supabase.

## Environment

Create a `.env` file in this folder with:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
PORT=4000
```

## Local development

```bash
npm install
npm run dev
```

## Deploy to Render

Use the repository root `render.yaml` file with a `rootDir: api` configuration, or create a Render web service pointing to the `api` directory and use these build/start commands:

```bash
npm install
npm run build
npm start
```

## Endpoint

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
