## 1. Shared import flow

- [ ] 1.1 Extract the current match-import sequence into a reusable service module.
- [ ] 1.2 Keep the existing UI behavior intact while routing through the shared service.

## 2. Proxy reliability

- [ ] 2.1 Reorder the proxy provider list so allorigins-raw is tried first.
- [ ] 2.2 Improve logging and error details for each proxy attempt.

## 3. HTTP API

- [ ] 3.1 Add an Express endpoint for importing matches from an HTTP request.
- [ ] 3.2 Return structured results per match and surface invalid input errors.

## 4. Validation

- [ ] 4.1 Run the build and fix any TypeScript or runtime issues.
- [ ] 4.2 Verify the new endpoint and the UI flow with a sample import request.
