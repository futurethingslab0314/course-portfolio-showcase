import test from 'node:test';
import assert from 'node:assert/strict';
import { runEventSync } from './eventSync';
import { NotionEventStore, ProjectSnapshot } from './notionEventStore';
const course = 'c'.repeat(32), project = 'a'.repeat(32), db = 'b'.repeat(32), coursesDb = 'd'.repeat(32), projectsDb = 'e'.repeat(32);
const workId = 'f'.repeat(32), otherId = '1'.repeat(32);
const rich = (value: string) => ({ type: 'rich_text', rich_text: [{ plain_text: value }] });

test('real Notion snapshot replay fetches only a changed page and preserves unchanged works', async () => {
  const env = { ...process.env }, originalFetch = globalThis.fetch;
  Object.assign(process.env, { NOTION_TOKEN: 'test', NOTION_DB_COURSES_ID: coursesDb, NOTION_DB_PROJECTS_ID: projectsDb, SUPABASE_URL: 'https://test.supabase.co', SUPABASE_SECRET_KEY: 'test', IMAGE_SYNC_ENABLED: 'false' });
  let baseline: { checkpoint: number; state: ProjectSnapshot } | null = null;
  let changed = false, delta = false;
  const reads: string[] = [], writes: string[] = [];
  const events: any[] = [];
  const store = { watermark: async () => events.length, events: async () => events, load: async () => structuredClone(baseline), save: async (_id, checkpoint, state) => { baseline = structuredClone({ checkpoint, state }); }, setting: async () => 'configured' } as unknown as NotionEventStore;
  const workPage = (id: string, title: string) => ({ id, parent: { type: 'database_id', database_id: db }, properties: { assignmentName: rich(title) } });
  const response = (data: unknown) => new Response(JSON.stringify(data));
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    const path = url.pathname.replace(/-/g, '');
    if (url.host === 'api.notion.com') {
      if (delta) reads.push(url.pathname);
      if (path.includes(coursesDb)) return response({ results: [{ id: course, properties: { Slug: rich('course'), CourseName: rich('Course') } }], has_more: false });
      if (path.includes(projectsDb)) return response({ results: [{ id: project, properties: { Name: rich('Assignment'), SourceDatabaseId: rich(db), UiPattern: rich('DataMatrix') } }], has_more: false });
      if (path.includes(db)) return response({ results: [workPage(workId, 'Old'), workPage(otherId, 'Unchanged')], has_more: false });
      if (path.endsWith(workId)) return response(workPage(workId, changed ? 'New' : 'Old'));
      throw new Error('Unexpected Notion read: ' + url.pathname);
    }
    const method = init?.method || 'GET';
    if (method !== 'GET') {
      if (delta) writes.push(url.pathname);
      if (url.pathname.endsWith('/projects')) return response([{ id: 'stored-project', notion_page_id: project, source_database_id: db }]);
      if (url.pathname.endsWith('/student_works') && method === 'POST') return response((JSON.parse(String(init?.body)) as any[]).map(row => ({ id: row.notion_page_id })));
      return response([]);
    }
    if (url.pathname.endsWith('/courses')) return response([{ id: 'stored-course' }]);
    if (url.pathname.endsWith('/projects')) return response([{ id: 'stored-project', notion_page_id: project, course_id: 'stored-course' }]);
    if (url.pathname.endsWith('/student_works')) return response([]);
    throw new Error('Unexpected request: ' + url.pathname);
  };
  const input = { slug: 'course', projectId: project, report: () => {} };
  try {
    await runEventSync({ ...input, mode: 'full' }, { store });
    assert.equal(baseline?.state.payload.studentWorks.length, 2);
    delta = true; changed = true;
    events.push({ seq: 1, event_id: 'event1', page_id: workId, kind: 'page.properties_updated', occurred_at: '2026-10-23T00:00:00Z', payload: {} });
    const result = await runEventSync(input, { store });
    assert.equal(result.changed, 1);
    assert.equal(reads.length, 1);
    assert.ok(reads[0].replace(/-/g, '').endsWith(workId));
    assert.deepEqual(writes, ['/rest/v1/student_works']);
    assert.equal(baseline?.state.payload.studentWorks.find(work => work.id === otherId)?.assignmentName, 'Unchanged');
    assert.equal(baseline?.state.payload.studentWorks.find(work => work.id === workId)?.assignmentName, 'New');
    reads.length = 0; writes.length = 0;
    assert.equal((await runEventSync(input, { store })).noChanges, true);
    assert.deepEqual(reads, []); assert.deepEqual(writes, []);
  } finally {
    globalThis.fetch = originalFetch;
    for (const key of Object.keys(process.env)) if (!(key in env)) delete process.env[key];
    Object.assign(process.env, env);
  }
});
