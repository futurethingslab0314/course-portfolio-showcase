import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import express, { Router } from 'express';
import { NotionEvent, NotionEventStore, notionEventStore } from './notionEventStore';
import { notionId } from './notionSnapshot';

export function verifyNotionSignature(raw: Buffer, signature: string, token: string) {
  if (!token || !/^sha256=[a-f0-9]{64}$/.test(signature)) return false;
  const actual = Buffer.from(signature.slice(7), 'hex');
  const expected = createHmac('sha256', token).update(raw).digest();
  return timingSafeEqual(actual, expected);
}
const kinds = new Set(['page.created', 'page.properties_updated', 'page.content_updated', 'page.deleted', 'page.undeleted', 'page.moved', 'database.schema_updated', 'data_source.schema_updated', 'database.deleted', 'database.undeleted', 'database.moved', 'data_source.deleted', 'data_source.undeleted', 'data_source.moved']);
export function parseNotionEvent(value: any, integrationId = ''): Omit<NotionEvent, 'seq'> | null {
  if (!value || typeof value.id !== 'string' || !kinds.has(value.type) || !/^[a-f0-9-]{32,36}$/i.test(value.entity?.id || '') || !Number.isFinite(Date.parse(value.timestamp))) return null;
  if (integrationId && notionId(value.integration_id || '') !== notionId(integrationId)) return null;
  return { event_id: value.id, page_id: notionId(value.entity.id), kind: value.type, occurred_at: value.timestamp, payload: value };
}
function equalSecret(actual: string, expected: string) {
  return Boolean(expected) && timingSafeEqual(createHash('sha256').update(actual).digest(), createHash('sha256').update(expected).digest());
}
export function createNotionWebhookRouter(store: NotionEventStore = notionEventStore) {
  const router = Router();
  router.post('/', express.raw({ type: 'application/json', limit: '1mb' }), async (req, res) => {
    try {
      if (!Buffer.isBuffer(req.body)) { res.status(400).json({ error: 'JSON body required' }); return; }
      let body: any;
      try { body = JSON.parse(req.body.toString('utf8')); } catch { res.sendStatus(400); return; }
      if (typeof body.verification_token === 'string') {
        if (!equalSecret(String(req.query.setup || ''), process.env.NOTION_WEBHOOK_SETUP_SECRET || '')) { res.sendStatus(401); return; }
        if (!/^secret_[a-zA-Z0-9_-]{10,200}$/.test(body.verification_token)) { res.sendStatus(400); return; }
        await store.setSetting('verification_token', body.verification_token, true);
        res.sendStatus(200); return;
      }
      const token = process.env.NOTION_WEBHOOK_VERIFICATION_TOKEN || await store.setting('verification_token') || '';
      if (!token) { res.status(503).json({ error: 'Webhook verification is not configured' }); return; }
      if (!verifyNotionSignature(req.body, req.get('X-Notion-Signature') || '', token)) { res.sendStatus(401); return; }
      const event = parseNotionEvent(body, process.env.NOTION_WEBHOOK_INTEGRATION_ID);
      if (event) {
        await store.record(event);
        await store.setSetting('last_received_at', new Date().toISOString());
      }
      res.sendStatus(200);
    } catch (error) {
      console.error('Notion webhook persistence failed:', error instanceof Error ? error.message : 'Unknown error');
      res.sendStatus(503);
    }
  });
  return router;
}
