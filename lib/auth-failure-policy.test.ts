import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyTransportFailure, isAuthInvalidationError } from './auth-failure-policy.ts';

test('only verified authentication failures invalidate the session', () => {
  assert.equal(isAuthInvalidationError(401, ''), true);
  assert.equal(isAuthInvalidationError(403, JSON.stringify({ error: 'Token expired' })), true);
  assert.equal(isAuthInvalidationError(403, JSON.stringify({ error: 'Insufficient permissions' })), false);
  assert.equal(isAuthInvalidationError(500, JSON.stringify({ error: 'Authentication service unavailable' })), false);
  assert.equal(isAuthInvalidationError(503, 'Backend unavailable'), false);
});

test('transport failures preserve timeout versus availability detail', () => {
  assert.equal(classifyTransportFailure(true), 'timeout');
  assert.equal(classifyTransportFailure(false), 'backend_unavailable');
});
