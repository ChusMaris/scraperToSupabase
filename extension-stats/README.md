# Estad-stiques Complementary Statistics Extension

This Manifest V3 extension reads the visible Plantilla table on `https://pinetys.github.io/Estad-stiques-/`, lets the operator review/edit player rows, and submits complementary statistics to the Scraper API.

## Install for local use

1. Start the API from `api/` and set `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `PORT` in its environment.
2. Open `chrome://extensions`, enable Developer mode, and choose **Load unpacked**.
3. Select the `extension-stats/` directory.
4. Set `apiBaseUrl` in `config.js` if the API host differs from the deployed default.
5. Open the target statistics page and click the extension icon. The table loads automatically; filter to exactly one included match, select the matching context, review the values, confirm the match, and submit.

The extension ignores PJ, MIN, PTS and VAL. For T2, T3 and TL it imports only made/attempted values from cells such as `6/16 (38%)`; the percentage is discarded. A table with zero or multiple included matches, an unknown header, or an unparseable value cannot be submitted.

## API configuration

The API base URL is maintained in `config.js`, separately from the extension's capture and UI scripts. Update `apiBaseUrl` to the deployed API origin when deploying to another host. Chrome also requires that origin in `manifest.json` under `host_permissions`.

The complementary-statistics import uses the same access model as the existing federation import. No API token needs to be configured in Render or the extension. The existing Supabase RLS policies still allow public writes, so this is not user-level authorization.

If all selectors are disabled, read the status message in the dashboard and use **Recargar opciones**. Check the seasons endpoint directly:

```text
https://scrapertosupabase.onrender.com/api/complementary-stats/options?type=seasons
```

It should return `{ "ok": true, "options": [...] }`. A 404 means Render is running an older deployment; a 503 indicates missing Supabase configuration; an empty array means the database returned no seasons. A failed request now leaves an error in the page and in the season selector instead of leaving it on “Cargando...”.

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