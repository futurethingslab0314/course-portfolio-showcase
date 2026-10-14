import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import { LocalWallStore, mergeWall, validateWall, createSharedWallRouter, WallState } from './sharedWall';
const seed = (): WallState => ({photos:{a:{x:10,y:20,placed:true},b:{x:30,y:40,placed:true}},notes:{n:{id:'n',text:'原稿',x:50,y:50,color:'#ffffff'}},grid:{columns:10,rows:8}});
test('disjoint edits merge; conflicting edits are rejected; retries are idempotent',()=>{
  const first=seed(),next=mergeWall(first,[{collection:'photos',id:'a',before:first.photos.a,after:{x:11,y:20,placed:true}}]);
  const merged=mergeWall(next,[{collection:'photos',id:'b',before:first.photos.b,after:{x:31,y:40,placed:true}}]);
  assert.equal(merged.photos.a.x,11);assert.equal(merged.photos.b.x,31);
  assert.throws(()=>mergeWall(merged,[{collection:'photos',id:'a',before:first.photos.a,after:{x:12,y:20,placed:true}}]),/Conflict/);
  assert.deepEqual(mergeWall(merged,[{collection:'photos',id:'a',before:first.photos.a,after:merged.photos.a}]),merged);
  const deleted=mergeWall(merged,[{collection:'notes',id:'n',before:merged.notes.n,after:null}]);
  assert.throws(()=>mergeWall(deleted,[{collection:'notes',id:'n',before:merged.notes.n,after:{...merged.notes.n,text:'stale'}}]),/Conflict/);
  const restored=mergeWall(deleted,[{collection:'notes',id:'n',before:null,after:merged.notes.n}]);
  assert.deepEqual(restored.notes.n,merged.notes.n);
  const undone=mergeWall(merged,[{collection:'photos',id:'a',before:merged.photos.a,after:first.photos.a}]);
  assert.equal(undone.photos.a.x,10);assert.equal(undone.photos.b.x,31);
  assert.throws(()=>mergeWall(undone,[{collection:'photos',id:'a',before:merged.photos.a,after:{x:9,y:20,placed:true}}]),/Conflict/);
});
test('validation rejects invalid positions, missing photos, reference paths and unsafe keys',()=>{
  const ids=new Set(['a','b']);validateWall(seed(),ids);
  for(const value of [NaN,Infinity,101,-1,'10']) {const s=seed();s.photos.a.x=value;assert.throws(()=>validateWall(s,ids));}
  const s=seed();s.notes.n.sourceImage='../../secret';assert.throws(()=>validateWall(s,ids));
  assert.throws(()=>mergeWall(seed(),[{collection:'notes',id:'__proto__',before:null,after:{}}]));
});
test('API persists, detects concurrent conflicts, and restores without deleting history',async()=>{
  process.env.SHARED_WALL_PASSWORD='test-password';
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'shared-wall-test-'));
  const store=new LocalWallStore(path.join(dir,'wall.json'));
  const app=express();app.use(express.json());app.use(createSharedWallRouter(store,new Set(['a','b']),async()=>[{id:'c',image:'https://example.com/c.jpg',title:'New photo'}]));
  const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));
  const base=`http://127.0.0.1:${(server.address() as {port:number}).port}`;
  let cookie='';
  const send=(url:string,method:string,body:unknown)=>fetch(base+url,{method,headers:{'content-type':'application/json',origin:base,cookie},body:JSON.stringify(body)});
  try {
    assert.equal(await (await fetch(base)).json(),null);
    assert.equal((await send('/initialize','POST',seed())).status,401);
    assert.equal((await send('/','PATCH',{operations:[]})).status,401);
    assert.equal((await send('/restore','POST',{revision:1})).status,401);
    assert.equal((await send('/login','POST',{password:'wrong'})).status,401);
    const login=await send('/login','POST',{password:'test-password'});
    assert.equal(login.status,200);cookie=login.headers.get('set-cookie')!.split(';')[0];
    assert.equal((await fetch(base+'/initialize',{method:'POST',headers:{cookie,'content-type':'application/json'},body:JSON.stringify(seed())})).status,403);
    assert.equal((await send('/initialize','POST',seed())).status,201);
    assert.equal((await send('/initialize','POST',seed())).status,409);
    const patch=(id:string,x:number)=>({operations:[{collection:'photos',id,before:seed().photos[id],after:{...seed().photos[id],x}}]});
    const responses=await Promise.all([send('/','PATCH',patch('a',15)),send('/','PATCH',patch('b',35))]);
    assert.ok(responses.every(r=>r.status===200));
    assert.equal((await send('/','PATCH',patch('a',18))).status,409);
    assert.equal((await new LocalWallStore(path.join(dir,'wall.json')).get())?.state.photos.a.x,15);
    const revision=(await store.get())!.revision;
    assert.equal((await send('/restore','POST',{revision:1,expectedRevision:revision-1})).status,409);
    assert.equal((await send('/restore','POST',{revision:1,expectedRevision:revision})).status,200);
    assert.equal((await store.get())!.state.photos.a.x,10);
    assert.equal((await store.history()).length,4);
    const synced=await (await send('/sync-photos','POST',{})).json() as {added:number;version:{state:WallState}};
    assert.equal(synced.added,1);assert.equal(synced.version.state.photos.c.placed,false);
    assert.deepEqual(synced.version.state.notes,seed().notes);
    assert.equal((await (await send('/sync-photos','POST',{})).json() as {added:number}).added,0);
    assert.equal((await send('/','PATCH',{operations:[{collection:'photos',id:'c',before:{x:50,y:50,placed:false},after:{x:40,y:40,placed:true}}]})).status,200);
    await send('/logout','POST',{});
    assert.equal((await send('/restore','POST',{revision:1})).status,401);
  } finally {server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));fs.rmSync(dir,{recursive:true,force:true});}
});
