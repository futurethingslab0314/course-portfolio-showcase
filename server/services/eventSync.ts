import { CoursePayload } from '../../shared/contracts';
import { ImageAsset, StudentWork } from '../../src/types';
import { SyncProgress, SyncMode, SyncResult } from '../../shared/adminSync';
import { buildCourseSyncPayloadBySlug } from './generator';
import { fetchPageById, NotionPage } from './notion';
import { NotionEvent, NotionEventStore, notionEventStore, ProjectSnapshot } from './notionEventStore';
import { newNotionSnapshot, notionId, queryKey, removeSnapshotPage, withNotionSnapshot } from './notionSnapshot';
import { reuseWorkMedia, workFingerprint } from './incrementalMedia';
import { assertSourceReadsSucceeded, rewriteWorkImagesToR2, runFullProjectSync } from './syncToSupabase';
import { deleteStudentWorksByNotionIds, preflightProjectSync, upsertStudentWorksToSupabase } from './supabase';
import { serializeSync } from './syncQueue';

type Input = { slug: string; projectId: string; mode?: SyncMode; report: (progress: SyncProgress) => void };
export interface EventSyncDependencies {
  store: NotionEventStore;
  loadPage(id: string): Promise<NotionPage>;
  build: typeof buildCourseSyncPayloadBySlug;
  media: typeof rewriteWorkImagesToR2;
  preflight: typeof preflightProjectSync;
  write(payload: CoursePayload, storedProjectId: string): Promise<void>;
  remove(projectId: string, ids: string[]): Promise<void>;
}
const defaults: EventSyncDependencies = {
  store: notionEventStore, loadPage: fetchPageById, build: buildCourseSyncPayloadBySlug,
  media: rewriteWorkImagesToR2, preflight: preflightProjectSync,
  async write(payload, projectId) {
    const result = await upsertStudentWorksToSupabase({ studentWorks: payload.studentWorks, projectIdBySourceDb: new Map([[payload.projects[0].sourceDatabaseId, projectId]]), warnings: payload.warnings });
    if (result.skipped || result.upserted !== payload.studentWorks.length) throw new Error('部分作品未能儲存，變更清單已保留，請重試。');
  },
  remove: deleteStudentWorksByNotionIds,
};
const progress = (): SyncProgress => ({ stage: 'reading', total: 0, processed: 0, uploaded: 0, skipped: 0, failed: 0 });
function assertComplete(payload: CoursePayload) {
  assertSourceReadsSucceeded(payload.warnings);
  if (payload.warnings.some(w => w.level === 'error' || /FETCH_FAILED|UPLOAD_FAILED|VARIANT_FAILED|CARD_CASE_PAGE_MISSING/.test(w.code))) {
    throw new Error('來源或圖片讀取不完整，變更清單已保留，請修正後重試。');
  }
}
const parentIds = (parent: any): string[] => [parent?.id, parent?.database_id, parent?.data_source_id, parent?.page_id].filter(value => typeof value === 'string').map(notionId);
const result = (changed = 0, deleted = 0): SyncResult => ({ warnings: [], changed, deleted, noChanges: !changed && !deleted, message: changed || deleted ? `已更新 ${changed} 筆、移除 ${deleted} 筆作品。剛發生的變更可能仍在等待 Notion 通知。` : '目前沒有收到新的變更。Notion 通知可能尚未送達，請稍後再同步。' });

export function syncProjectChanges(input: Input) {
  return serializeSync(() => runEventSync(input));
}
export async function runEventSync(input: Input, overrides: Partial<EventSyncDependencies> = {}): Promise<SyncResult> {
  const deps = { ...defaults, ...overrides };
  const { store } = deps;
  input.report(progress());
  const through = await store.watermark();
  if (input.mode === 'full') {
    const snapshot = newNotionSnapshot();
    const completed = await withNotionSnapshot(snapshot, false, () => runFullProjectSync({
      ...input, allowEmpty: true,
      async onSaved(payload, sourceWorks, storedProjectId) {
        assertComplete(payload);
        await store.save(input.projectId, through, { version: 1, slug: input.slug, storedProjectId, notion: snapshot, sourceWorks, payload });
      },
    }));
    return { ...result(), warnings: completed.warnings, noChanges: false, message: '完整比對完成，已建立變更同步基準；之後可使用「同步變更」。' };
  }
  const token = process.env.NOTION_WEBHOOK_VERIFICATION_TOKEN || await store.setting('verification_token');
  if (!token || !await store.setting('last_received_at')) throw new Error('Notion 變更通知尚未啟用或尚未收到測試事件，請先完成通知設定。');
  if (store.head) {
    const head = await store.head(input.projectId);
    if (!head || head.version !== 1) throw new Error('此分頁尚未建立同步基準，請先執行一次「完整比對」。');
    if (head.slug !== input.slug) throw new Error('課程識別已變更，請先執行「完整比對」。');
    // No event: do not even transfer the large saved source snapshot.
    if (head.checkpoint === through) return result();
  }
  const baseline = await store.load(input.projectId);
  if (!baseline || baseline.state.version !== 1) throw new Error('此分頁尚未建立同步基準，請先執行一次「完整比對」。');
  if (baseline.state.slug !== input.slug) throw new Error('課程識別已變更，請先執行「完整比對」。');
  if (through === baseline.checkpoint) return result();
  const events = await store.events(baseline.checkpoint, through);
  const state: ProjectSnapshot = structuredClone(baseline.state);
  const project = state.payload.projects[0];
  const sourceId = notionId(project.sourceDatabaseId || '');
  const databaseIds = new Set(Object.keys(state.notion.queries).map(key => key.split(':')[0]));
  // Includes related case/body databases, whose schemas affect normalization too.
  for (const page of Object.values(state.notion.pages)) for (const id of parentIds(page.parent)) databaseIds.add(id);
  const configIds = new Set([notionId(project.id), notionId(state.payload.course.id)]);
  const latest = new Map<string, NotionEvent>();
  for (const event of events) {
    const id = notionId(event.page_id);
    if (((event.kind.startsWith('database.') || event.kind.startsWith('data_source.')) && databaseIds.has(id)) || configIds.has(id)) {
      throw new Error('課程、分頁或資料庫結構已變更，請執行「完整比對」更新同步基準。');
    }
    if (id in state.notion.pages || state.notion.removed.includes(id) || parentIds(event.payload.data?.parent).includes(sourceId)) {
      const previous = latest.get(id);
      if (!previous || Date.parse(event.occurred_at) >= Date.parse(previous.occurred_at)) latest.set(id, event);
    }
  }
  if (!latest.size) { await store.save(input.projectId, through, state); return result(); }
  for (const [id, event] of latest) {
    let page: NotionPage;
    try { page = await deps.loadPage(id); }
    catch (error) {
      // A 404 on an ordinary update may mean access was revoked. Preserve data.
      if (event.kind === 'page.deleted' && /\(404\)/.test(String(error))) { removeSnapshotPage(state.notion, id); continue; }
      throw error;
    }
    const oldPage = state.notion.pages[id];
    const belongsToSource = parentIds(page.parent).includes(sourceId);
    const wasSource = parentIds(oldPage?.parent).includes(sourceId) || state.notion.queries[queryKey(project.sourceDatabaseId, {})]?.includes(id);
    if (wasSource && !page.parent && !page.archived && !page.in_trash) throw new Error('Notion 頁面缺少來源資訊，變更清單已保留，請重試。');
    if (page.archived || page.in_trash || (wasSource && !belongsToSource)) {
      removeSnapshotPage(state.notion, id); continue;
    }
    state.notion.pages[id] = page;
    state.notion.removed = state.notion.removed.filter(value => value !== id);
    delete state.notion.blogs[id];
    if (belongsToSource) {
      const sourceQuery = state.notion.queries[queryKey(project.sourceDatabaseId, {})];
      if (!sourceQuery) throw new Error('來源資料庫設定已變更，請執行「完整比對」。');
      if (!sourceQuery.includes(id)) sourceQuery.push(id);
    }
  }
  const payload = await withNotionSnapshot(state.notion, true, () => deps.build(input.slug, input.projectId));
  assertComplete(payload);
  const previous = new Map(state.sourceWorks.map(work => [work.id, work]));
  const stored = new Map(state.payload.studentWorks.map(work => [work.id, work]));
  const nextIds = new Set(payload.studentWorks.map(work => work.id));
  const deleted = state.sourceWorks.filter(work => !nextIds.has(work.id)).map(work => work.id);
  const changed = payload.studentWorks.filter(work => !previous.has(work.id) || workFingerprint(work) !== workFingerprint(previous.get(work.id)!));
  const sourceWorks = structuredClone(payload.studentWorks);
  const assets = new Map<string, ImageAsset>(), urls = new Set<string>();
  payload.studentWorks = changed.map(work => {
    const reused = reuseWorkMedia(previous.get(work.id), stored.get(work.id), work);
    for (const [key, asset] of reused.assets) assets.set(key, asset);
    for (const url of reused.urls) urls.add(url);
    return reused.work;
  });
  let lastProgress = progress();
  if (changed.length) {
    const courseId = await deps.preflight(payload.course.id, project, changed);
    if (!courseId) throw new Error('Course ownership validation failed');
    await deps.media(payload, `changes-${Date.now()}`, p => { lastProgress = p; input.report(p); }, { assets, urls });
    assertComplete(payload);
    input.report({ ...lastProgress, stage: 'saving' });
    await deps.write(payload, state.storedProjectId);
  }
  if (deleted.length) {
    // Validate course/project scope even for a deletion-only batch.
    if (!changed.length) await deps.preflight(payload.course.id, project, []);
    input.report({ ...lastProgress, stage: 'saving' });
    await deps.remove(state.storedProjectId, deleted);
  }
  const rewritten = new Map(payload.studentWorks.map(work => [work.id, work]));
  state.sourceWorks = sourceWorks;
  state.payload = { ...payload, studentWorks: sourceWorks.map(work => rewritten.get(work.id) || stored.get(work.id)!) };
  // Checkpoint advances only after all side effects succeed. Events received after
  // 'through' remain pending, including edits made while this job was running.
  await store.save(input.projectId, through, state);
  return { ...result(changed.length, deleted.length), warnings: payload.warnings };
}
