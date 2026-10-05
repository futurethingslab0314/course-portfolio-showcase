import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, LogIn, LogOut, RefreshCw, X } from 'lucide-react';
import { ProjectSyncJob } from '../../shared/adminSync';

class ApiError extends Error { constructor(message: string, public status: number) { super(message); } }
async function api<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api/admin/session${path}`, {
    method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  const data = await response.json();
  if (!response.ok) throw new ApiError(data.error || 'Request failed', response.status);
  return data;
}

type AdminState = {
  authenticated: boolean;
  job: ProjectSyncJob | null;
  openLogin: () => void;
  logout: () => Promise<void>;
  start: (slug: string, projectId: string, name: string) => Promise<void>;
  starting: boolean;
};
const Context = createContext<AdminState>({ authenticated: false, job: null, openLogin: () => {}, logout: async () => {}, start: async () => {}, starting: false });
export const useAdminSync = () => useContext(Context);
const storageKey = 'portfolio-sync-job';
const stageLabels = { queued: '等待同步', reading: '讀取 Notion', images: '處理圖片', saving: '更新資料庫', complete: '同步完成', failed: '同步失敗' };

export function AdminSyncProvider({ children }: { children: React.ReactNode }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [job, setJob] = useState<ProjectSyncJob | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loginError, setLoginError] = useState('');
  const [busy, setBusy] = useState(false);
  const [starting, setStarting] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const passwordInput = useRef<HTMLInputElement>(null);
  const startLock = useRef(false);

  useEffect(() => {
    let active = true;
    api<{ authenticated: boolean }>('/').then(data => { if (active) setAuthenticated(data.authenticated); }).catch(() => {});
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey) || 'null');
      if (saved?.id) { setJobId(saved.id); setName(saved.name || ''); }
    } catch { /* Storage is optional. */ }
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (loginOpen) dialog.current?.showModal();
    else dialog.current?.close();
  }, [loginOpen]);
  useEffect(() => {
    if (!authenticated || !jobId) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      let again = true;
      try {
        const next = await api<ProjectSyncJob>(`/jobs/${encodeURIComponent(jobId)}`);
        if (!active) return;
        setJob(next); setError('');
        again = next.status === 'queued' || next.status === 'running';
        if (!again) { try { sessionStorage.removeItem(storageKey); } catch {} }
      } catch (e) {
        if (!active) return;
        setError(e instanceof Error ? e.message : '無法取得進度，正在重試');
        if (e instanceof ApiError && e.status === 401) { setAuthenticated(false); again = false; }
        if (e instanceof ApiError && e.status === 404) {
          again = false; setJob(null); setJobId(null);
          try { sessionStorage.removeItem(storageKey); } catch {}
        }
      }
      if (active && again) timer = setTimeout(poll, 2000);
    };
    void poll();
    return () => { active = false; clearTimeout(timer); };
  }, [authenticated, jobId]);

  const start = async (slug: string, projectId: string, projectName: string) => {
    if (startLock.current) return;
    startLock.current = true; setStarting(true); setError(''); setCollapsed(false);
    try {
      const next = await api<ProjectSyncJob>('/jobs', { slug, projectId });
      setJob(next); setJobId(next.id); setName(projectName);
      try { sessionStorage.setItem(storageKey, JSON.stringify({ id: next.id, name: projectName })); } catch {}
    } catch (e) {
      setError(e instanceof Error ? e.message : '無法啟動同步');
      if (e instanceof ApiError && e.status === 401) setAuthenticated(false);
    } finally { setStarting(false); startLock.current = false; }
  };
  const logout = async () => {
    try { await api('/logout', {}); setAuthenticated(false); setError(''); }
    catch { setError('登出失敗，請重試。'); }
  };
  const closeLogin = () => { setLoginOpen(false); if (passwordInput.current) passwordInput.current.value = ''; };
  const activeJob = job?.status === 'queued' || job?.status === 'running';
  return <Context.Provider value={{ authenticated, job, openLogin: () => { setLoginError(''); setLoginOpen(true); }, logout, start, starting }}>
    {children}
    <dialog ref={dialog} onCancel={closeLogin} onClose={closeLogin} className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-lg p-6 backdrop:bg-black/50" aria-labelledby="admin-login-title">
      <form onSubmit={async event => {
        event.preventDefault(); setBusy(true); setLoginError('');
        try { await api('/login', { password: passwordInput.current?.value }); setAuthenticated(true); closeLogin(); }
        catch (e) { setLoginError(e instanceof Error ? e.message : '登入失敗'); }
        finally { setBusy(false); }
      }}>
        <div className="flex items-center justify-between mb-5"><h2 id="admin-login-title" className="text-xl font-bold">Admin 登入</h2><button type="button" onClick={closeLogin} aria-label="關閉登入" title="關閉"><X size={20} /></button></div>
        <label htmlFor="admin-password" className="block text-sm mb-2">管理員密碼</label>
        <input ref={passwordInput} id="admin-password" type="password" autoComplete="current-password" required autoFocus maxLength={1024} className="w-full border border-black/20 rounded p-3" />
        {loginError && <p role="alert" className="text-sm text-red-700 mt-3">{loginError}</p>}
        <button disabled={busy} className="mt-5 w-full bg-black text-white rounded py-3 disabled:opacity-50">{busy ? '登入中…' : '登入'}</button>
      </form>
    </dialog>
    {(error || (authenticated && job)) && <aside role="status" aria-live="polite" className="fixed right-4 top-32 md:top-24 z-[80] w-[calc(100%-2rem)] max-w-sm rounded-lg border border-black/15 bg-white p-4 shadow-lg">
      <div className="flex justify-between items-start gap-3"><strong className="text-sm break-words min-w-0">{name || '同步通知'}</strong>
        {activeJob ? <button aria-label={collapsed ? '展開進度' : '收合進度'} title={collapsed ? '展開進度' : '收合進度'} aria-expanded={!collapsed} onClick={() => setCollapsed(!collapsed)}>{collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}</button> : <button aria-label="關閉通知" title="關閉通知" onClick={() => { setJob(null); setJobId(null); setError(''); }}><X size={16} /></button>}
      </div>
      {job && authenticated && <>
        <p className="text-sm mt-2">{stageLabels[job.stage]}{job.status === 'success' && job.warnings > 0 ? `（${job.warnings} 項警告）` : ''}</p>
        {!collapsed && (job.stage === 'images' ? <>
          <progress aria-label="圖片處理進度" max={Math.max(job.total, 1)} value={job.processed} className="w-full h-2 mt-3 accent-emerald-600" />
          <p className="text-xs mt-2">{job.processed} / {job.total} 張 · 上傳 {job.uploaded} · 跳過 {job.skipped} · 失敗 {job.failed}</p>
        </> : activeJob ? <progress aria-label="同步進行中" className="w-full h-2 mt-3" /> : null)}
        {job.status === 'success' && <p className="text-xs mt-2">圖片上傳 {job.uploaded} · 跳過 {job.skipped} · 失敗 {job.failed}</p>}
        {job.error && <p className="text-sm text-red-700 mt-2 break-words">{job.error}</p>}
      </>}
      {error && <p className="text-sm text-red-700 mt-2 break-words">{error}</p>}
    </aside>}
  </Context.Provider>;
}

export function AdminControl() {
  const admin = useAdminSync();
  return <button onClick={() => admin.authenticated ? void admin.logout() : admin.openLogin()} className="flex items-center gap-2 border border-black/15 rounded px-3 py-2 text-xs font-semibold">
    {admin.authenticated ? <LogOut size={14} /> : <LogIn size={14} />}{admin.authenticated ? '登出 Admin' : 'Admin'}
  </button>;
}

export function ProjectSyncButton({ slug, projectId, name }: { slug: string; projectId: string; name: string }) {
  const admin = useAdminSync();
  if (!admin.authenticated) return null;
  const busy = admin.starting || admin.job?.status === 'queued' || admin.job?.status === 'running';
  return <button disabled={busy} onClick={() => void admin.start(slug, projectId, name)} className="flex items-center gap-2 border border-black/20 rounded px-3 py-2 text-sm disabled:opacity-40">
    <RefreshCw size={15} />Sync Data
  </button>;
}
