import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveSyncButtonAuth } from './syncButtonAuth';

test('authorizes with course token when token is valid', async () => {
  const result = await resolveSyncButtonAuth({
    slug: 'my-course',
    token: 'token-123',
    secret: '',
    validateCourseToken: async () => true,
    validateGlobalSecret: () => ({ ok: false, message: 'Unauthorized sync request' }),
  });

  assert.equal(result.ok, true);
  assert.equal(result.method, 'token');
});

test('authorizes with global secret when token is missing', async () => {
  const result = await resolveSyncButtonAuth({
    slug: 'my-course',
    token: '',
    secret: 'global-secret',
    validateCourseToken: async () => false,
    validateGlobalSecret: () => ({ ok: true, message: 'ok' }),
  });

  assert.equal(result.ok, true);
  assert.equal(result.method, 'secret');
});

test('falls back to global secret when token table is missing', async () => {
  const result = await resolveSyncButtonAuth({
    slug: 'my-course',
    token: 'token-123',
    secret: 'global-secret',
    validateCourseToken: async () => {
      throw new Error('course_sync_tokens table is missing');
    },
    validateGlobalSecret: () => ({ ok: true, message: 'ok' }),
  });

  assert.equal(result.ok, true);
  assert.equal(result.method, 'secret');
});

test('rejects when neither token nor secret passes', async () => {
  const result = await resolveSyncButtonAuth({
    slug: 'my-course',
    token: 'token-123',
    secret: 'wrong-secret',
    validateCourseToken: async () => false,
    validateGlobalSecret: () => ({ ok: false, message: 'Unauthorized sync request' }),
  });

  assert.equal(result.ok, false);
  assert.match(result.message || '', /Unauthorized/);
});
