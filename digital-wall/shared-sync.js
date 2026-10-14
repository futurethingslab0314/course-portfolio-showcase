/* Local undo and password-protected shared synchronization. */
(() => {
  const shared = location.pathname.startsWith('/shared-wall/');
  let authenticated = false;
  const api = '/api/shared-wall';
  const draftKey = 'taiwan-solution-shared-draft-v1';
  const bar = document.createElement('div');
  bar.className = 'view-controls';
  const status = document.createElement('strong');
  const undo = document.createElement('button');undo.textContent='↶';undo.title='上一步';undo.setAttribute('aria-label','上一步');
  const redo = document.createElement('button');redo.textContent='↷';redo.title='下一步';redo.setAttribute('aria-label','下一步');
  const importButton = document.createElement('button'); importButton.textContent = '匯入目前版本並建立共用牆'; importButton.hidden = true;
  const upload = document.createElement('input'); upload.type = 'file'; upload.accept = '.json,application/json'; upload.hidden = true;
  const retry = document.createElement('button'); retry.textContent = '重試儲存'; retry.hidden = true;
  const remoteButton = document.createElement('button'); remoteButton.textContent = '放棄草稿，讀取共用版本'; remoteButton.hidden = true;
  const download = document.createElement('button'); download.textContent = '下載草稿備份'; download.hidden = true;
  const historyButton = document.createElement('button'); historyButton.textContent = '版本紀錄';
  const historySelect = document.createElement('select'); historySelect.hidden = true; historySelect.setAttribute('aria-label','歷史版本');
  const restore = document.createElement('button'); restore.textContent = '還原選取版本'; restore.hidden = true;
  bar.append(status,importButton,upload,retry,remoteButton,download,historyButton,historySelect,restore);
  document.querySelector('.toolbar').prepend(undo,redo);
  undo.innerHTML="<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"lucide lucide-undo2 lucide-undo-2\" aria-hidden=\"true\"><path d=\"M9 14 4 9l5-5\"></path><path d=\"M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11\"></path></svg>";
  redo.innerHTML="<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"lucide lucide-redo2 lucide-redo-2\" aria-hidden=\"true\"><path d=\"m15 14 5-5-5-5\"></path><path d=\"M20 9H9.5A5.5 5.5 0 0 0 4 14.5A5.5 5.5 0 0 0 9.5 20H13\"></path></svg>";
  undo.className=redo.className='icon-button';
  bar.classList.add('sync-controls');
  if(!shared)bar.hidden=true;
  document.querySelector('.toolbar').before(bar);
  let baseline = null, revision = 0, busy = false, dirty = false, conflict = false, timer;
  let initialized = false;
  const equal = (a,b) => JSON.stringify(a) === JSON.stringify(b);
  function lock(value) {
    value=value||!authenticated||(shared&&!initialized);
    window.wallReadOnly=value;
    wall.querySelectorAll('.wall-note').forEach(note=>{
      note.inert=false;
      note.querySelector('.note-content').contentEditable=value?'false':'plaintext-only';
      note.querySelector('.note-delete').disabled=value;
    });
    document.getElementById('pendingSection').inert = value;
    for(const id of ['addNote','noteColor','syncPhotos'])document.getElementById(id).disabled=value;
    undo.disabled=value||!past.length;redo.disabled=value||!future.length;
    restore.disabled=!authenticated;importButton.disabled=!authenticated;
  }
  function snapshot() {
    return {
      photos: Object.fromEntries(model.items.map(item=>[item.id,{x:Number(item.x.toFixed(3)),y:Number(item.y.toFixed(3)),placed:item.alignmentStatus!=='unmatched'}])),
      notes: Object.fromEntries(model.wallNotes.map(note=>[note.id,structuredClone(note)])),
      grid: model.grid || null,
    };
  }
  function changes(before,after) {
    const ops=[];
    for(const collection of ['photos','notes']) for(const id of new Set([...Object.keys(before[collection]),...Object.keys(after[collection])])) {
      const a=before[collection][id]??null,b=after[collection][id]??null;
      if(!equal(a,b)) ops.push({collection,id,before:a,after:b});
    }
    if(!equal(before.grid,after.grid))ops.push({collection:'grid',id:'grid',before:before.grid,after:after.grid});
    return ops;
  }
  function apply(state) {
    addSyncedPhotos(Object.values(state.catalog||{}));
    model.grid=state.grid;
    wall.classList.toggle('grid-layout',!!model.grid);
    wall.style.aspectRatio=model.grid?model.grid.columns+'/'+model.grid.rows:String(model.wallAspectRatio);
    for(const item of model.items) {
      const p=state.photos[item.id]; if(!p)continue;
      item.x=p.x;item.y=p.y;item.alignmentStatus=p.placed?'manual':'unmatched';
      const card=document.querySelector(`.photo[data-id="${item.id}"]`);
      card.classList.toggle('pending-photo',!p.placed);
      (p.placed?wall:document.getElementById('pendingPhotos')).appendChild(card);
      applyPosition(card,item);card.style.setProperty('--r',model.grid?0:item.rotation);
    }
    model.wallNotes=Object.values(structuredClone(state.notes));
    document.querySelectorAll('.wall-note').forEach(n=>n.remove());
    selectedNote=null;noteText.value='';document.getElementById('noteReference').hidden=true;
    model.wallNotes.forEach(renderNote);
    updatePendingCount();applyView();
    localStorage.setItem(storageKey,JSON.stringify(state.photos));
    localStorage.setItem(notesStorageKey,JSON.stringify(model.wallNotes));
    localStorage.setItem(gridStorageKey,JSON.stringify(state.grid||{disabled:true}));
    observed=snapshot();
  }
  const past=[],future=[];
  const countKey=storageKey+':edit-count-v1';
  let editCount=0,lastTextId=null,lastTextAt=0;
  try{const saved=Number(localStorage.getItem(countKey));if(!shared&&Number.isSafeInteger(saved)&&saved>=0)editCount=saved;}catch{}
  function showCount(){saveStatus.textContent=`已編輯 ${editCount} 次`;saveStatus.title=shared?'所有人的成功儲存次數':'此瀏覽器的編輯次數，自啟用記錄起計算';}
  function countEdit(ops){
    if(shared||!ops.length)return;
    const op=ops.length===1?ops[0]:null;
    const textOnly=op?.collection==='notes'&&op.before&&op.after&&op.before.text!==op.after.text&&equal({...op.before,text:null,uncertain:null,useTranscript:null},{...op.after,text:null,uncertain:null,useTranscript:null});
    const now=Date.now();
    if(!textOnly||lastTextId!==op.id||now-lastTextAt>1000)editCount++;
    lastTextId=textOnly?op.id:null;lastTextAt=now;
    localStorage.setItem(countKey,String(editCount));showCount();
  }
  showCount();
  let observed=snapshot(), replaying=false;
  function historyButtons(){undo.disabled=!authenticated||busy||!past.length;redo.disabled=!authenticated||busy||!future.length;}
  window.addEventListener('wall-edit',()=>{
    const next=snapshot(),ops=changes(observed,next);
    if(!replaying)countEdit(ops);
    if(!replaying&&ops.length){past.push(ops);if(past.length>100)past.shift();future.length=0;}
    observed=next;historyButtons();
  });
  function step(back){
    if(!authenticated||busy||conflict)return;
    const from=back?past:future,to=back?future:past,ops=from.at(-1);if(!ops)return;
    const state=snapshot();
    for(const op of ops){
      const current=op.collection==='grid'?state.grid:state[op.collection][op.id]??null;
      if(!equal(current,back?op.after:op.before)){status.textContent='此項目已被更新，無法還原以免覆蓋其他修改';return;}
    }
    for(const op of ops){
      const value=structuredClone(back?op.before:op.after);
      if(op.collection==='grid')state.grid=value;
      else if(value===null)delete state[op.collection][op.id];else state[op.collection][op.id]=value;
    }
    from.pop();to.push(ops);lastTextId=null;countEdit(ops);lastTextId=null;apply(state);replaying=true;
    window.dispatchEvent(new Event('wall-edit'));replaying=false;historyButtons();
    if(!shared)status.textContent=back?'已還原並儲存':'已重做並儲存';
  }
  undo.onclick=()=>step(true);redo.onclick=()=>step(false);historyButtons();
  document.addEventListener('keydown',e=>{
    if(!(e.ctrlKey||e.metaKey)||e.key.toLowerCase()!=='z'||e.target.closest('input,textarea,[contenteditable]'))return;
    e.preventDefault();step(!e.shiftKey);
  });
  if(!shared){
    document.getElementById('syncPhotos').onclick=async()=>{
      if(!authenticated||busy)return;
      busy=true;lock(true);
      const button=document.getElementById('syncPhotos').querySelector('span');button.textContent='同步中…';
      try{
        const endpoint=location.protocol==='file:'?'http://localhost:8788/api/wall-photos':'/api/wall-photos';
        const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({existingIds:model.items.map(item=>item.id)}),signal:AbortSignal.timeout(120000)});
        const result=await response.json();if(!response.ok)throw new Error(result.error||'同步失敗');
        const added=addSyncedPhotos(result.photos);observed=snapshot();
        button.textContent=added?`已新增 ${added} 張`:'沒有新照片';
      }catch(e){button.textContent='同步照片';alert(e.message==='Failed to fetch'?'請先啟動本機伺服器 localhost:8788，並設定 Notion 連線。':e.message);}
      finally{busy=false;lock(false);}
    };
    historyButton.hidden=true;
  }
    const toggle=document.createElement('button');toggle.type='button';toggle.className='icon-button';
    toggle.innerHTML="<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"lucide lucide-lock-keyhole\" aria-hidden=\"true\"><circle cx=\"12\" cy=\"16\" r=\"1\"></circle><rect x=\"3\" y=\"10\" width=\"18\" height=\"12\" rx=\"2\"></rect><path d=\"M7 10V7a5 5 0 0 1 10 0v3\"></path></svg>";
    const lockedIcon=toggle.innerHTML;
    const unlockedIcon="<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"lucide lucide-lock-keyhole-open\" aria-hidden=\"true\"><circle cx=\"12\" cy=\"16\" r=\"1\"></circle><rect width=\"18\" height=\"12\" x=\"3\" y=\"10\" rx=\"2\"></rect><path d=\"M7 10V7a5 5 0 0 1 9.33-2.5\"></path></svg>";
    toggle.title='解鎖編輯';toggle.setAttribute('aria-label','解鎖編輯');
    document.getElementById('saveStatus').before(toggle);
    const dialog=document.createElement('dialog');dialog.className='unlock-dialog';dialog.setAttribute('aria-labelledby','unlockTitle');
    dialog.innerHTML='<form method="dialog"><div class="preview-heading"><h2 id="unlockTitle">解鎖編輯</h2><button type="button" class="unlock-close" aria-label="關閉密碼視窗">×</button></div><label for="localWallPassword">編輯密碼</label><input id="localWallPassword" type="password" autocomplete="current-password" required><p class="unlock-error" role="alert"></p><button type="submit" class="unlock-submit">解鎖編輯</button></form>';
    document.body.append(dialog);
    const input=dialog.querySelector('input'),error=dialog.querySelector('.unlock-error');
    const refresh=()=>{
      lock(busy||(shared&&!initialized));
      toggle.innerHTML=authenticated?unlockedIcon:lockedIcon;
      toggle.title=authenticated?'目前已解鎖，點擊鎖定編輯':'目前已上鎖，點擊解鎖編輯';
      toggle.setAttribute('aria-label',authenticated?'鎖定編輯':'解鎖編輯');
      toggle.setAttribute('aria-pressed',String(authenticated));
      showCount();
    };
    let authBusy=false;
    toggle.onclick=async()=>{
      if(authBusy)return;
      if(authenticated){
        if(busy||dirty){status.textContent='請先儲存或處理尚未同步的草稿';return;}
        authBusy=true;toggle.disabled=true;
        try{if(shared)await request('/logout','POST',{});authenticated=false;refresh();}
        catch(e){status.textContent=e.message;}finally{authBusy=false;toggle.disabled=false;}
        return;
      }
      input.value='';error.textContent='';dialog.showModal();input.focus();
    };
    dialog.querySelector('.unlock-close').onclick=()=>dialog.close();
    dialog.querySelector('form').onsubmit=async event=>{
      event.preventDefault();
      if(authBusy)return;
      authBusy=true;dialog.querySelector('.unlock-submit').disabled=true;error.textContent='';
      try{
        if(shared)await request('/login','POST',{password:input.value});
        else if(input.value!=='taiwan')throw new Error('密碼不正確，請再試一次');
        authenticated=true;input.value='';dialog.close();refresh();
        if(shared){if(!initialized)await load();else if(dirty)save();else status.textContent='已解鎖編輯';}
      }catch(e){error.textContent=e.message;input.select();}
      finally{authBusy=false;dialog.querySelector('.unlock-submit').disabled=false;}
    };
    dialog.addEventListener('close',()=>{input.value='';});
    refresh();if(!shared)return;
  async function request(path='',method='GET',body) {
    const r=await fetch(api+path,{method,headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(12000)});
    const result=await r.json();
    if(!r.ok){if(r.status===401){authenticated=false;refresh();}const e=new Error(result.error||'連線失敗');e.status=r.status;throw e;}
    return result;
  }
  document.getElementById('syncPhotos').onclick=async()=>{
    if(!authenticated||busy)return;
    if(dirty){status.textContent='請先等待目前修改儲存完成';return;}
    busy=true;lock(true);status.textContent='正在同步 Notion 照片…';
    try{
      const response=await fetch(api+'/sync-photos',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(120000)});
      const result=await response.json();if(!response.ok)throw new Error(result.error||'同步失敗');
      accept(result.version);status.textContent=result.added?`已新增 ${result.added} 張至待放置照片`:'沒有新照片';
    }catch(e){status.textContent=e.message;}finally{busy=false;lock(false);}
  };
  function accept(version) {
    editCount=Math.max(0,version.revision-1);showCount();
    revision=version.revision;apply(version.state);baseline=snapshot();
    status.textContent=`已同步 · 版本 ${revision}`;
  }
  function showDraftControls() { retry.hidden=false;remoteButton.hidden=false;download.hidden=false; }
  function persistDraft() { localStorage.setItem(draftKey,JSON.stringify({baseline,state:snapshot()})); }
  async function save() {
    if(!authenticated||!initialized||busy||!dirty||conflict)return;
    const state=snapshot(),operations=changes(baseline,state);
    if(!operations.length){dirty=false;localStorage.removeItem(draftKey);return;}
    persistDraft();busy=true;lock(true);status.textContent='正在儲存到共用牆…';
    try {
      const version=await request('','PATCH',{operations});
      accept(version);dirty=false;localStorage.removeItem(draftKey);
      retry.hidden=remoteButton.hidden=download.hidden=true;
    } catch(e) {
      conflict=e.status===409;
      status.textContent=conflict?'編輯衝突：草稿已保留，請先下載備份或讀取共用版本':'尚未同步，草稿已保留在此瀏覽器';
      retry.hidden=conflict;remoteButton.hidden=false;download.hidden=false;
    } finally {busy=false;lock(false);}
  }
  window.addEventListener('wall-edit',()=>{
    if(!authenticated||!initialized||busy)return;
    dirty=true;persistDraft();status.textContent='尚未同步';clearTimeout(timer);timer=setTimeout(save,700);
  });
  window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
  retry.onclick=()=>{if(initialized)save();else load();};
  download.onclick=()=>{
    const blob=new Blob([JSON.stringify({revision,...snapshot()},null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='shared-wall-draft.json';a.click();URL.revokeObjectURL(url);
  };
  remoteButton.onclick=async()=>{
    if(!confirm('放棄此瀏覽器尚未同步的修改，改用目前共用版本？'))return;
    busy=true;lock(true);
    try {const v=await request();accept(v);dirty=false;conflict=false;localStorage.removeItem(draftKey);retry.hidden=remoteButton.hidden=download.hidden=true;}
    catch(e){status.textContent=e.message;}finally{busy=false;lock(false);}
  };
  importButton.onclick=()=>upload.click();
  upload.onchange=async()=>{
    const file=upload.files[0];if(!file)return;
    busy=true;
    try {
      const imported=JSON.parse(await file.text());
      let state;
      if(imported.photos&&imported.notes) state={photos:imported.photos,notes:imported.notes,grid:imported.grid??null};
      else {
        if(!imported.positions||!Array.isArray(imported.wallNotes))throw new Error('請選擇數位牆 Export Positions 匯出的檔案');
        state=snapshot();
        for(const item of model.items){const p=imported.positions[item.id];if(!p)throw new Error('匯出檔缺少照片');state.photos[item.id]={x:p.x,y:p.y,placed:typeof p.placed==='boolean'?p.placed:item.alignmentStatus!=='unmatched'};}
        state.notes=Object.fromEntries(imported.wallNotes.map(n=>[n.id||crypto.randomUUID(),n]));
        for(const [id,note] of Object.entries(state.notes))note.id=id;
        state.grid=imported.grid??null;
      }
      const version=await request('/initialize','POST',state);
      accept(version);initialized=true;importButton.hidden=true;lock(false);
    }catch(e){status.textContent=e.message;}finally{busy=false;upload.value='';}
  };
  historyButton.onclick=async()=>{
    try {const versions=await request('/history');historySelect.replaceChildren(...versions.map(v=>{const option=document.createElement('option');option.value=v.revision;option.textContent=`版本 ${v.revision} · ${new Date(v.updated_at).toLocaleString()}`;return option;}));historySelect.hidden=restore.hidden=false;}
    catch(e){status.textContent=e.message;}
  };
  restore.onclick=async()=>{
    if(dirty||busy){status.textContent='請先處理尚未同步的草稿';return;}
    if(!confirm('所有人看到的牆面都會還原到這個版本，確定還原？'))return;
    busy=true;lock(true);
    try {accept(await request('/restore','POST',{revision:Number(historySelect.value),expectedRevision:revision}));}
    catch(e){status.textContent=e.message;}finally{busy=false;lock(false);}
  };
  async function load() {
    lock(true);status.textContent='正在讀取共用牆…';
    try {
      authenticated=(await request('/session')).authenticated;refresh();
      const version=await request();
      if(!version){status.textContent=authenticated?'已解鎖，請先匯入本機 download json 備份，建立共用牆後即可編輯':'尚未建立共用牆：請先解鎖並匯入本機備份';importButton.hidden=false;lock(true);return;}
      accept(version);initialized=true;
      const draft=JSON.parse(localStorage.getItem(draftKey)||'null');
      if(draft){baseline=draft.baseline;apply(draft.state);dirty=true;showDraftControls();status.textContent='已恢復尚未同步的草稿';setTimeout(save,700);}
      lock(false);
    }catch(e){status.textContent=e.message;retry.hidden=false;}
  }
  let polling=false;
  setInterval(async()=>{
    if(!initialized||polling||busy||dirty||document.hidden||document.querySelector('.dragging')||document.activeElement?.matches('input,[contenteditable]'))return;
    polling=true;
    try {const v=await request();if(busy||dirty||document.querySelector('.dragging')||document.activeElement?.matches('input,[contenteditable]'))return;if(v&&v.revision>revision)accept(v);else status.textContent=`已同步 · 版本 ${revision}`;}
    catch {if(!dirty&&!busy)status.textContent='暫時無法連線；修改會保留草稿';}finally{polling=false;}
  },2000);
  load();
})();
