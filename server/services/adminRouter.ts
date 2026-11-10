import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import { SyncProgress } from '../../shared/adminSync';
import { createProjectJobStore } from './projectSyncJobs';

type Sync = (input: { slug: string; projectId: string; report: (p: SyncProgress) => void }) => Promise<{ warnings: unknown[] }>;

export function createAdminRouter(sync: Sync, invalidate: () => void, options: { password?: string; origin?: string; secure?: boolean; now?: () => number } = {}) {
  const router = Router();
  const password = options.password ?? process.env.ADMIN_PASSWORD;
  const origin = options.origin ?? process.env.ADMIN_ORIGIN ?? process.env.BASE_URL;
  const secure = options.secure ?? process.env.NODE_ENV === 'production';
  const now = options.now ?? Date.now;
  const sessions = new Map<string, number>();
  const attempts = new Map<string, { count: number; expires: number }>();
  const jobs = createProjectJobStore();
  const cookieName = 'portfolio_admin';
  const cookieOptions = { httpOnly: true, secure, sameSite: 'strict' as const, path: '/api/admin/session' };
  const tokenFrom = (cookie = '') => cookie.split(';').map(v => v.trim()).find(v => v.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);

  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    for (const [key, expiry] of sessions) if (expiry <= now()) sessions.delete(key);
    for (const [key, entry] of attempts) if (entry.expires <= now()) attempts.delete(key);
    if (req.method !== 'GET') {
      const allowed = origin ? new URL(origin).origin : (!secure ? `http://${req.get('host')}` : undefined);
      if (!allowed || req.get('origin') !== allowed) { res.status(403).json({ error: 'Invalid request origin' }); return; }
    }
    next();
  });
  router.get('/', (req, res) => {
    res.json({ authenticated: sessions.has(tokenFrom(req.get('cookie')) || '') });
  });
  router.post('/login', (req, res) => {
    if (!password) { res.status(503).json({ error: 'Admin login is not configured.' }); return; }
    const key = req.ip || 'unknown';
    const entry = attempts.get(key) || { count: 0, expires: now() + 15 * 60_000 };
    if (entry.count >= 10 || attempts.size >= 1000) { res.status(429).json({ error: 'Too many attempts. Try again in 15 minutes.' }); return; }
    entry.count += 1;
    attempts.set(key, entry);
    const given = typeof req.body?.password === 'string' ? req.body.password : '';
    const hash = (value: string) => createHash('sha256').update(value).digest();
    if (!timingSafeEqual(hash(given), hash(password))) { res.status(401).json({ error: 'Incorrect password' }); return; }
    attempts.delete(key);
    const old = tokenFrom(req.get('cookie'));
    if (old) sessions.delete(old);
    if (sessions.size >= 100) sessions.delete(sessions.keys().next().value!);
    const token = randomBytes(32).toString('hex');
    sessions.set(token, now() + 8 * 60 * 60_000);
    res.cookie(cookieName, token, { ...cookieOptions, maxAge: 8 * 60 * 60_000 }).json({ authenticated: true });
  });
  router.post('/logout', (req, res) => {
    sessions.delete(tokenFrom(req.get('cookie')) || '');
    res.clearCookie(cookieName, cookieOptions).json({ authenticated: false });
  });
  router.use((req, res, next) => {
    if (!sessions.has(tokenFrom(req.get('cookie')) || '')) { res.status(401).json({ error: 'Please sign in again.' }); return; }
    next();
  });
  router.post('/jobs', (req, res) => {
    const { slug, projectId } = req.body || {};
    if (typeof slug !== 'string' || !slug.trim() || slug.length > 200 || typeof projectId !== 'string' || !/^[a-f0-9-]{32,36}$/i.test(projectId)) {
      res.status(400).json({ error: 'Invalid assignment' }); return;
    }
    try {
      const job = jobs.start({ slug, projectId, projectName: projectId }, async report => {
        const result = await sync({ slug, projectId, report });
        invalidate();
        return result;
      });
      res.status(202).json(job);
    } catch (error) { res.status(429).json({ error: (error as Error).message }); }
  });
  router.get('/jobs/:id', (req, res) => {
    const job = jobs.get(req.params.id);
    if (!job) { res.status(404).json({ error: 'Sync status unavailable. The server may have restarted.' }); return; }
    res.json(job);
  });
  return router;
}
