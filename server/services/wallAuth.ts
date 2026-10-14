import { Router } from 'express';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export function wallAuth() {
  const router = Router();
  const sessions = new Map<string, number>();
  const attempts = new Map<string, {count:number; until:number}>();
  const secure = process.env.NODE_ENV === 'production';
  const cookie = 'wall_editor';
  const options = {httpOnly:true, secure, sameSite:'strict' as const, path:'/api/shared-wall'};
  router.use((req,res,next) => {
    const now = Date.now();
    for (const [key, expiry] of sessions) if (expiry <= now) sessions.delete(key);
    for (const [key, value] of attempts) if (value.until <= now) attempts.delete(key);
    const token = req.headers.cookie?.split(';').map(s=>s.trim()).find(s=>s.startsWith(cookie+'='))?.slice(cookie.length+1) || '';
    const authenticated = sessions.has(token);
    if (req.method === 'GET') {
      if (req.path === '/session') {res.json({authenticated});return;}
      next();return;
    }
    const origin = process.env.SHARED_WALL_ORIGIN || process.env.BASE_URL || (!secure ? `http://${req.headers.host}` : '');
    if (!origin || req.headers.origin !== new URL(origin).origin) {res.status(403).json({error:'不允許的來源'});return;}
    if (req.path === '/login' && req.method === 'POST') {
      const password = process.env.SHARED_WALL_PASSWORD;
      if (!password) {res.status(503).json({error:'尚未設定編輯密碼'});return;}
      const key = req.ip || 'unknown';
      const attempt = attempts.get(key) || {count:0,until:now+15*60*1000};
      if (attempt.count >= 10 || (!attempts.has(key) && attempts.size >= 1000)) {res.status(429).json({error:'嘗試次數過多，請稍後再試'});return;}
      attempt.count++;attempts.set(key,attempt);
      const hash = (s:string)=>createHash('sha256').update(s).digest();
      if (typeof req.body?.password !== 'string' || !timingSafeEqual(hash(req.body.password),hash(password))) {res.status(401).json({error:'密碼不正確'});return;}
      attempts.delete(key);
      if (sessions.size >= 1000) sessions.delete(sessions.keys().next().value!);
      const fresh = randomBytes(32).toString('hex');sessions.set(fresh,now+8*60*60*1000);
      res.cookie(cookie,fresh,{...options,maxAge:8*60*60*1000}).json({authenticated:true});return;
    }
    if (req.path === '/logout' && req.method === 'POST') {
      sessions.delete(token);res.clearCookie(cookie,options).json({authenticated:false});return;
    }
    if (!authenticated) {res.status(401).json({error:'請先輸入編輯密碼'});return;}
    next();
  });
  return router;
}
