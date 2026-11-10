import { supabaseHeaders, supabaseRequest } from './supabase';
import { notionId, NotionSnapshot } from './notionSnapshot';
import { CoursePayload } from '../../shared/contracts';
import { StudentWork } from '../../src/types';

export interface NotionEvent {
  seq: number;
  event_id: string;
  page_id: string;
  kind: string;
  occurred_at: string;
  payload: { data?: { parent?: { id?: string; database_id?: string; data_source_id?: string } }; [key: string]: unknown };
}
export interface ProjectSnapshot {
  version: 1;
  slug: string;
  storedProjectId: string;
  notion: NotionSnapshot;
  sourceWorks: StudentWork[];
  payload: CoursePayload;
}
export interface NotionEventStore {
  watermark(): Promise<number>;
  events(after: number, through: number): Promise<NotionEvent[]>;
  head?(projectId: string): Promise<{ checkpoint: number; version: number; slug: string } | null>;
  load(projectId: string): Promise<{ checkpoint: number; state: ProjectSnapshot } | null>;
  save(projectId: string, checkpoint: number, state: ProjectSnapshot): Promise<void>;
  record(event: Omit<NotionEvent, 'seq'>): Promise<void>;
  setting(key: string): Promise<string | null>;
  setSetting(key: string, value: string, onlyIfMissing?: boolean): Promise<void>;
}
async function request<T>(path: string, method = 'GET', body?: unknown, prefer?: string) {
  try {
    return await supabaseRequest<T>(`/rest/v1/${path}`, {
      method, headers: supabaseHeaders(prefer ? { Prefer: prefer } : undefined),
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch (error) {
    if (/42P01|PGRST20[25]|schema cache|does not exist/.test(String(error))) {
      throw new Error('變更同步資料表尚未建立，請先執行 sql/2026-10-23-notion-event-sync.sql。');
    }
    throw error;
  }
}
export const notionEventStore: NotionEventStore = {
  watermark: () => request<number>('rpc/notion_sync_watermark', 'POST', {}),
  async events(after, through) {
    const rows: NotionEvent[] = [];
    let cursor = after;
    while (cursor < through) {
      const page = await request<NotionEvent[]>(`notion_sync_events?select=*&seq=gt.${cursor}&seq=lte.${through}&order=seq.asc&limit=200`);
      if (!page.length) break;
      rows.push(...page); cursor = page[page.length - 1].seq;
    }
    return rows;
  },
  async head(projectId) {
    const rows = await request<Array<{ checkpoint: number; version: number; slug: string }>>(`notion_sync_snapshots?project_id=eq.${notionId(projectId)}&select=checkpoint,version:state->version,slug:state->>slug&limit=1`);
    return rows[0] || null;
  },
  async load(projectId) {
    const rows = await request<Array<{ checkpoint: number; state: ProjectSnapshot }>>(`notion_sync_snapshots?project_id=eq.${notionId(projectId)}&select=checkpoint,state&limit=1`);
    return rows[0] || null;
  },
  async save(projectId, checkpoint, state) {
    await request('notion_sync_snapshots?on_conflict=project_id', 'POST', { project_id: notionId(projectId), checkpoint, state, updated_at: new Date().toISOString() }, 'resolution=merge-duplicates');
  },
  async record(event) { await request('rpc/record_notion_sync_event', 'POST', { event }); },
  async setting(key) {
    const rows = await request<Array<{ value: string }>>(`notion_sync_settings?key=eq.${encodeURIComponent(key)}&select=value&limit=1`);
    return rows[0]?.value || null;
  },
  async setSetting(key, value, onlyIfMissing = false) {
    await request('notion_sync_settings?on_conflict=key', 'POST', { key, value }, `resolution=${onlyIfMissing ? 'ignore' : 'merge'}-duplicates`);
  },
};
