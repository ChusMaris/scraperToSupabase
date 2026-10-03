import assert from 'node:assert/strict';
import test from 'node:test';
import { openApiDocument } from './openapi.js';

test('documents current health, federation and complementary statistics routes', () => {
  assert.equal(openApiDocument.openapi, '3.0.3');
  assert.deepEqual(Object.keys(openApiDocument.paths).sort(), [
    '/api/complementary-stats/import',
    '/api/complementary-stats/options',
    '/api/federation/import',
    '/api/federation/options',
    '/health'
  ]);
});

test('uses the same unauthenticated access model as the existing federation import', () => {
  const operation = openApiDocument.paths['/api/complementary-stats/import'].post as { security?: unknown };
  const components = openApiDocument.components as { securitySchemes?: unknown };
  assert.equal(operation.security, undefined);
  assert.equal(components.securitySchemes, undefined);
});