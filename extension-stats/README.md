# Estad-stiques Complementary Statistics Extension

This Manifest V3 extension reads the visible Plantilla table on `https://pinetys.github.io/Estad-stiques-/`, lets the operator review/edit player rows, and submits complementary statistics to the Scraper API.

## Install for local use

1. Start the API from `api/` and set `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `COMPLEMENTARY_STATS_API_TOKEN`, and `PORT` in its environment.
2. Open `chrome://extensions`, enable Developer mode, and choose **Load unpacked**.
3. Select the `extension-stats/` directory.
4. Open the target statistics page, click the extension icon, and configure the API URL and the same Bearer token under **Configuración de API**.
5. Filter the source page to exactly one included match. In the extension, select the matching season, category, competition, matchday, match and team, extract the table, review the values, confirm the match, and submit.

The extension ignores PJ, MIN, PTS and VAL. For T2, T3 and TL it imports only made/attempted values from cells such as `6/16 (38%)`; the percentage is discarded. A table with zero or multiple included matches, an unknown header, or an unparseable value cannot be submitted.

## API configuration

The default API base URL is `http://localhost:4000`. Set the deployed API base URL in the extension settings after the new routes have been deployed. The configured API host must be present in `manifest.json` under `host_permissions` before it can be used.

The shared token is stored in the local Chrome profile, not in the extension source. Install this extension only for trusted operators. The API's Bearer check protects its import route; it does not change the existing public Supabase RLS policies.

## Tests

From the repository root:

```bash
node --test extension-stats/*.test.js
```

From `api/`:

```bash
npm test
npm run build
```