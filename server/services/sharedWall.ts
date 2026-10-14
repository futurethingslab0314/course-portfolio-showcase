import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { wallAuth } from './wallAuth';

export type WallState = { catalog?: Record<string, Record<string, unknown>>; photos: Record<string, Record<string, unknown>>; notes: Record<string, Record<string, unknown>>; grid: { columns: number; rows: number } | null };
export type WallVersion = { revision: number; state: WallState; updated_at: string };
export type WallOperation = { collection: 'photos' | 'notes' | 'grid'; id: string; before: unknown; after: unknown };
export interface WallStore {
  get(): Promise<WallVersion | null>;
  put(state: WallState, expected: number): Promise<WallVersion | null>;
  history(): Promise<WallVersion[]>;
}
const safeId = (id: string) => /^[a-zA-Z0-9_-]{1,120}$/.test(id) && !['__proto__', 'constructor', 'prototype'].includes(id);
const coordinate = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100;
export function validateWall(state: WallState, photoIds: Set<string>) {
  if (!state || typeof state !== 'object' || !state.photos || !state.notes || Object.keys(state.notes).length > 500) throw new Error('Invalid wall');
  if (Object.keys(state.photos).length !== photoIds.size) throw new Error('Missing photos');
  for (const [id, p] of Object.entries(state.photos)) {
    if (!photoIds.has(id) || !p || !coordinate(p.x) || !coordinate(p.y) || typeof p.placed !== 'boolean' || Object.keys(p).some(k => !['x','y','placed'].includes(k))) throw new Error('Invalid photo');
  }
  const allowed = new Set(['id','text','x','y','color','uncertain','useTranscript','sourceImage','sourceBounds','colorName','anchorPhotoId','anchorOffset','physicalX','physicalY']);
  for (const [id, n] of Object.entries(state.notes)) {
    if (!safeId(id) || !n || n.id !== id || !coordinate(n.x) || !coordinate(n.y) || typeof n.text !== 'string' || n.text.length > 5000 || !/^#[a-fA-F0-9]{6}$/.test(String(n.color)) || Object.keys(n).some(k => !allowed.has(k))) throw new Error('Invalid note');
    if (n.sourceImage && !/^note-originals\/note-\d{2}\.jpg$/.test(String(n.sourceImage))) throw new Error('Invalid reference');
  }
  if (state.grid !== null && (!state.grid || !Number.isInteger(state.grid.columns) || !Number.isInteger(state.grid.rows) || state.grid.columns < 1 || state.grid.rows < 1 || state.grid.columns > 100 || state.grid.rows > 100)) throw new Error('Invalid grid');
}
export function mergeWall(state: WallState, operations: WallOperation[]): WallState {
  if (!Array.isArray(operations) || !operations.length || operations.length > 700) throw new Error('Invalid operations');
  const next = structuredClone(state);
  for (const op of operations) {
    if (!op || !['photos','notes','grid'].includes(op.collection) || !safeId(op.id)) throw new Error('Invalid operation');
    const current = op.collection === 'grid' ? next.grid : next[op.collection][op.id] ?? null;
    // A retry after a lost response is harmless when the desired value is already saved.
    if (isDeepStrictEqual(current, op.after)) continue;
    if (!isDeepStrictEqual(current, op.before)) throw new Error('Conflict');
    if (op.collection === 'grid') next.grid = op.after as WallState['grid'];
    else if (op.after === null) {
      if (op.collection !== 'notes') throw new Error('Cannot delete a photo');
      delete next.notes[op.id];
    } else next[op.collection][op.id] = op.after as Record<string, unknown>;
  }
  return next;
}

export class LocalWallStore implements WallStore {
  constructor(private file: string) {}
  private read(): WallVersion[] { return fs.existsSync(this.file) ? JSON.parse(fs.readFileSync(this.file, 'utf8')) : []; }
  async get() { return this.read().at(-1) ?? null; }
  async history() { return this.read().slice(-50).reverse(); }
  async put(state: WallState, expected: number) {
    const history = this.read();
    if ((history.at(-1)?.revision ?? 0) !== expected) return null;
    const version = { revision: expected + 1, state, updated_at: new Date().toISOString() };
    history.push(version);
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file + '.tmp', JSON.stringify(history));
    fs.renameSync(this.file + '.tmp', this.file);
    return version;
  }
}

export class SupabaseWallStore implements WallStore {
  private async request(endpoint: string, method = 'GET', body?: unknown): Promise<WallVersion[]> {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('Shared storage is not configured');
    const response = await fetch(url.replace(/\/$/, '') + '/rest/v1/' + endpoint, {
      method, headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type':'application/json', Prefer:'return=representation' },
      body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(10000),
    });
    if (response.status === 409) return [];
    if (!response.ok) throw new Error('Shared storage unavailable; check the wall SQL migration');
    return await response.json() as WallVersion[];
  }
  async get() { const rows = await this.request('shared_walls?id=eq.taiwan-solution&select=revision,state,updated_at'); return rows[0] ?? null; }
  async put(state: WallState, expected: number) {
    const rows = expected === 0
      ? await this.request('shared_walls', 'POST', {id:'taiwan-solution', revision:1, state})
      : await this.request(`shared_walls?id=eq.taiwan-solution&revision=eq.${expected}`, 'PATCH', {state, revision:expected+1,updated_at:new Date().toISOString()});
    return rows[0] ?? null;
  }
  async history() { return this.request('shared_wall_versions?wall_id=eq.taiwan-solution&select=revision,state,updated_at&order=revision.desc&limit=50'); }
}

export function createSharedWallRouter(store: WallStore, photoIds: Set<string>, fetchPhotos?: (existingIds:Set<string>)=>Promise<Array<{id:string;[key:string]:unknown}>>) {
  const router = Router();
  router.use((_req,res,next) => { res.set('Cache-Control','no-store'); next(); });
  router.use(wallAuth());
  router.post('/sync-photos',async (_req,res)=>{
    try{
      if(!fetchPhotos)throw new Error('同步來源未設定');
      const initial=await store.get();
      if(!initial){res.status(409).json({error:'請先建立共用牆'});return;}
      const photos=await fetchPhotos(new Set(Object.keys(initial.state.photos)));
      for(let attempt=0;attempt<4;attempt++){
        const current=await store.get();if(!current){res.status(409).json({error:'請先建立共用牆'});return;}
        const state=structuredClone(current.state);state.catalog??={};let added=0;
        for(const photo of photos){if(!safeId(photo.id)||state.photos[photo.id])continue;state.catalog[photo.id]=photo;state.photos[photo.id]={x:50,y:50,placed:false};added++;}
        if(!added){res.json({version:current,added:0});return;}
        const saved=await store.put(state,current.revision);if(saved){res.json({version:saved,added});return;}
      }
      res.status(409).json({error:'牆面正在更新，請重試'});
    }catch{res.status(503).json({error:'無法同步 Notion，請確認伺服器連線與 Notion 權限'});}
  });
  router.get('/', async (_req,res) => { try { res.json(await store.get()); } catch { res.status(503).json({error:'共用儲存尚未設定或暫時無法連線'}); } });
  router.get('/history', async (_req,res) => { try { res.json((await store.history()).map(({revision,updated_at})=>({revision,updated_at}))); } catch { res.status(503).json({error:'無法讀取版本'}); } });
  router.post('/initialize', async (req,res) => {
    try {
      validateWall(req.body,photoIds);
      if(req.body.catalog && Object.keys(req.body.catalog).length)throw new Error('請先建立牆面，再同步新照片');
      const saved=await store.put(req.body,0);
      res.status(saved?201:409).json(saved ?? {error:'共用牆已存在，請重新載入'});
    } catch(e) { res.status(400).json({error:e instanceof Error?e.message:'Invalid wall'}); }
  });
  router.patch('/', async (req,res) => {
    try {
      for (let attempt=0;attempt<4;attempt++) {
        const current=await store.get();
        if(!current) {res.status(404).json({error:'尚未建立共用牆'});return;}
        const state=mergeWall(current.state,req.body.operations);
        validateWall(state,new Set([...photoIds,...Object.keys(current.state.catalog||{})]));
        if(isDeepStrictEqual(state,current.state)) {res.json(current);return;}
        const saved=await store.put(state,current.revision);
        if(saved) {res.json(saved);return;}
      }
      res.status(409).json({error:'其他人正在編輯，請重試'});
    } catch(e) { const conflict=e instanceof Error&&e.message==='Conflict'; res.status(conflict?409:400).json({error:conflict?'同一項目已被其他人修改':(e instanceof Error?e.message:'Invalid edit')}); }
  });
  router.post('/restore', async (req,res) => {
    try {
      const {revision,expectedRevision}=req.body;
      if(!Number.isInteger(revision)||!Number.isInteger(expectedRevision)) {res.status(400).json({error:'Invalid revision'});return;}
      const selected=(await store.history()).find(v=>v.revision===revision);
      if(!selected) {res.status(404).json({error:'找不到版本'});return;}
      const current=await store.get();
      const restored=structuredClone(selected.state);
      restored.catalog={...current?.state.catalog,...restored.catalog};
      for(const [id,p] of Object.entries(current?.state.photos||{}))if(!restored.photos[id])restored.photos[id]=p;
      const saved=await store.put(restored,expectedRevision);
      res.status(saved?200:409).json(saved ?? {error:'牆面已更新，請先重新載入'});
    } catch { res.status(503).json({error:'無法還原版本'}); }
  });
  return router;
}
