import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createAdminRouter } from './adminRouter';

test('admin routes enforce sessions, origin, expiry, and logout', async () => {
  let now = 1000;
  let runs = 0;
  const app = express();
  app.use(express.json());
  app.use('/api/admin/session', createAdminRouter(async () => { runs++; return { warnings: [] }; }, () => {}, {
    password: 'test-only-password', origin: 'http://test.local', secure: true, now: () => now,
  }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/admin/session`;
  let cookie = '';
  const post = (path: string, body: unknown, origin = 'http://test.local') => fetch(base + path, {
    method: 'POST', headers: { 'content-type': 'application/json', origin, cookie }, body: JSON.stringify(body),
  });
  try {
    assert.equal((await post('/jobs', {})).status, 401);
    assert.equal((await fetch(base + '/jobs/missing')).status, 401);
    assert.equal((await post('/login', { password: 'bad' })).status, 401);
    assert.equal((await post('/login', { password: 'test-only-password' }, 'http://evil.local')).status, 403);
    const login = await post('/login', { password: 'test-only-password' });
    assert.equal(login.status, 200);
    const setCookie = login.headers.get('set-cookie')!;
    assert.match(setCookie, /HttpOnly/); assert.match(setCookie, /Secure/); assert.match(setCookie, /SameSite=Strict/);
    cookie = setCookie.split(';')[0];
    const session = await (await fetch(base, { headers: { cookie } })).json() as { authenticated: boolean };
    assert.equal(session.authenticated, true);
    const started = await post('/jobs', { slug: 'course', projectId: 'a'.repeat(32) });
    assert.equal(started.status, 202);
    await new Promise(r => setImmediate(r));
    assert.equal(runs, 1);
    now += 8 * 60 * 60_000;
    assert.equal((await post('/jobs', {})).status, 401);
    const again = await post('/login', { password: 'test-only-password' });
    cookie = again.headers.get('set-cookie')!.split(';')[0];
    assert.equal((await post('/logout', {})).status, 200);
    assert.equal((await post('/jobs', {})).status, 401);
    for (let i = 0; i < 10; i++) await post('/login', { password: 'bad' });
    assert.equal((await post('/login', { password: 'test-only-password' })).status, 429);
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
});

test('missing admin password does not permit login', async () => {
  const app = express(); app.use(express.json());
  app.use(createAdminRouter(async () => ({ warnings: [] }), () => {}, { password: '', origin: 'http://test.local' }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${(server.address() as { port: number }).port}/login`, { method: 'POST', headers: { origin: 'http://test.local' } });
    assert.equal(response.status, 503);
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
});
