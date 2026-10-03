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

test('documents Bearer authorization for the complementary import operation', () => {
  const operation = openApiDocument.paths['/api/complementary-stats/import'].post;
  assert.deepEqual(operation.security, [{ importToken: [] }]);
  assert.equal(openApiDocument.components.securitySchemes.importToken.scheme, 'bearer');
});