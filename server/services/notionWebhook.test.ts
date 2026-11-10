import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { verifyNotionSignature, parseNotionEvent } from './notionWebhook';

test('webhook verification covers the exact raw bytes and rejects malformed signatures', () => {
  const raw = Buffer.from('{ "id": "event" }');
  const signature = 'sha256=' + createHmac('sha256', 'secret-test').update(raw).digest('hex');
  assert.equal(verifyNotionSignature(raw, signature, 'secret-test'), true);
  assert.equal(verifyNotionSignature(Buffer.from('{"id":"event"}'), signature, 'secret-test'), false);
  assert.equal(verifyNotionSignature(raw, 'sha256=bad', 'secret-test'), false);
  assert.equal(verifyNotionSignature(raw, signature, ''), false);
});

test('webhook parsing retains lifecycle events and rejects invalid timestamps and unrelated subscriptions', () => {
  const event = { id: 'evt', type: 'page.deleted', timestamp: '2026-10-23T01:00:00Z', entity: { id: 'a'.repeat(32), type: 'page' }, integration_id: 'integration', data: { parent: { id: 'db', type: 'database' } } };
  assert.equal(parseNotionEvent(event, 'integration')?.kind, 'page.deleted');
  assert.equal(parseNotionEvent(event, 'different'), null);
  assert.equal(parseNotionEvent({ ...event, timestamp: 'bad' }, 'integration'), null);
});

test('HTTP receiver protects setup, verifies raw signatures, and requests retries when persistence fails', async () => {
  const { default: express } = await import('express');
  const { createNotionWebhookRouter } = await import('./notionWebhook');
  const settings = new Map<string, string>();
  const recorded = new Set<string>();
  let fail = false;
  const env = { ...process.env };
  process.env.NOTION_WEBHOOK_SETUP_SECRET = 'test-setup-key';
  delete process.env.NOTION_WEBHOOK_VERIFICATION_TOKEN;
  delete process.env.NOTION_WEBHOOK_INTEGRATION_ID;
  const store = {
    setting: async (key: string) => settings.get(key) || null,
    setSetting: async (key: string, value: string, onlyIfMissing: boolean) => { if (!onlyIfMissing || !settings.has(key)) settings.set(key, value); },
    record: async (event: { event_id: string }) => { if (fail) throw new Error('Persistence unavailable'); recorded.add(event.event_id); },
  } as any;
  const app = express(); app.use('/events', createNotionWebhookRouter(store)); app.use(express.json());
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as any).port}/events`;
  const token = 'secret_webhook_test_token';
  const post = (body: string, signature = '', query = '') => fetch(base + query, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Notion-Signature': signature }, body });
  try {
    const verification = JSON.stringify({ verification_token: token });
    assert.equal((await post(verification)).status, 401);
    assert.equal((await post(verification, '', '?setup=test-setup-key')).status, 200);
    assert.equal(settings.get('verification_token'), token);
    assert.equal((await post(JSON.stringify({ verification_token: 'secret_attacker_other' }), '', '?setup=test-setup-key')).status, 200);
    assert.equal(settings.get('verification_token'), token, 'handshake cannot overwrite an existing token');
    const raw = JSON.stringify({ id: 'event-1', type: 'page.deleted', timestamp: '2026-10-23T00:00:00Z', entity: { type: 'page', id: 'a'.repeat(32) } });
    const signature = 'sha256=' + createHmac('sha256', token).update(raw).digest('hex');
    assert.equal((await post(raw)).status, 401);
    assert.equal((await post(raw + ' ', signature)).status, 401);
    assert.equal((await post(raw, signature)).status, 200);
    assert.equal((await post(raw, signature)).status, 200);
    assert.equal(recorded.size, 1);
    assert.ok(settings.get('last_received_at'));
    fail = true;
    assert.equal((await post(raw, signature)).status, 503);
  } finally {
    server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve()));
    for (const key of Object.keys(process.env)) if (!(key in env)) delete process.env[key];
    Object.assign(process.env, env);
  }
});
