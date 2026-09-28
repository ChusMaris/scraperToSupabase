# Extension: Federation Importer

This Chrome extension runs on the partido page and captures the JSON payload already loaded by the site. It then sends the payload to the API for normalization and Supabase persistence.

## Config

Open the extension background script and set the API URL you want to use:

- `http://localhost:4000/api/federation/import` for local development
- your deployed API URL for production

## Flow

1. User opens the partido page.
2. Extension inspects the page for match stats / PBP data.
3. Extension sends the payload bundle to the API.
4. API validates and normalizes the payload with the canonical middle layer.
5. API writes the canonical rows into Supabase.
