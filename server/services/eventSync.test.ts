import test from 'node:test';
import assert from 'node:assert/strict';
import { EventSyncDependencies, runEventSync } from './eventSync';
import { newNotionSnapshot } from './notionSnapshot';
import { ProjectSnapshot, NotionEventStore } from './notionEventStore';
import { CoursePayload } from '../../shared/contracts';
const page = 'a'.repeat(32), db = 'b'.repeat(32), project = 'c'.repeat(32);
const payload = { course: { id: 'course', slug: 'course', courseName: 'Course', projectIds: [] }, projects: [{ id: project, courseId: 'course', sourceDatabaseId: db, displayStyle: 'data-matrix' }], studentWorks: [{ id: page, assignmentName: 'Old', members: [], description: '', mainImage: '', sourceDatabaseId: db }], warnings: [] } as unknown as CoursePayload;
function setup(events: any[] = []) {
  let saved: { checkpoint: number; state: ProjectSnapshot } = { checkpoint: 0, state: { version: 1, slug: 'course', storedProjectId: 'stored', notion: newNotionSnapshot(), sourceWorks: structuredClone(payload.studentWorks), payload: structuredClone(payload) } };
  saved.state.notion.pages[page] = { id: page, properties: {}, parent: { type: 'database_id', database_id: db } };
  saved.state.notion.queries[`${db}:{}`] = [page];
  const calls = { read: 0, build: 0, media: 0, write: 0, deleted: [] as string[], saves: 0 };
  let nextPayload = structuredClone(payload);
  const store = { watermark: async () => events.length, events: async () => events, load: async () => structuredClone(saved), save: async (_id, checkpoint, state) => { calls.saves++; saved = { checkpoint, state }; }, setting: async () => 'configured' } as unknown as NotionEventStore;
  const deps: EventSyncDependencies = { store, loadPage: async () => { calls.read++; return { id: page, properties: {}, parent: { type: 'database_id', database_id: db } }; }, build: async () => { calls.build++; return nextPayload; }, media: async () => { calls.media++; return { uploaded: 0, skipped: 0 }; }, write: async () => { calls.write++; }, remove: async (_project, ids) => { calls.deleted.push(...ids); }, preflight: async () => 'stored' };
  return { deps, calls, state: () => saved, next: (value: CoursePayload) => { nextPayload = value; } };
}
const event = (kind = 'page.properties_updated', seq = 1) => ({ seq, event_id: `e${seq}`, page_id: page, kind, occurred_at: '2026-10-23T01:00:00Z', payload: {} });
const input = { slug: 'course', projectId: project, report: () => {} };
test('no pending events causes no Notion reads, image work, or work writes', async () => {
  const s = setup(); const result = await runEventSync(input, s.deps);
  assert.equal(result.changed, 0); assert.equal(result.noChanges, true);
  assert.deepEqual(s.calls, { read: 0, build: 0, media: 0, write: 0, deleted: [], saves: 0 });
});
test('multiple notifications for one changed work fetch it once and update only changed works', async () => {
  const s = setup([event(), event('page.content_updated', 2)]);
  s.next({ ...structuredClone(payload), studentWorks: [{ ...payload.studentWorks[0], assignmentName: 'New' }] });
  const result = await runEventSync(input, s.deps);
  assert.equal(s.calls.read, 1); assert.equal(s.calls.write, 1); assert.equal(result.changed, 1);
  assert.equal(s.state().checkpoint, 2);
});
test('deleting the last work removes only its ID and saves an empty snapshot', async () => {
  const s = setup([event('page.deleted')]);
  s.deps.loadPage = async () => ({ id: page, properties: {}, archived: true });
  s.next({ ...structuredClone(payload), studentWorks: [] });
  const result = await runEventSync(input, s.deps);
  assert.equal(result.deleted, 1); assert.deepEqual(s.calls.deleted, [page]);
  assert.equal(s.state().state.payload.studentWorks.length, 0);
});
test('failed writes retain the previous checkpoint and snapshot', async () => {
  const s = setup([event()]);
  s.next({ ...structuredClone(payload), studentWorks: [{ ...payload.studentWorks[0], description: 'Changed' }] });
  s.deps.write = async () => { throw new Error('Write failed'); };
  await assert.rejects(runEventSync(input, s.deps), /Write failed/);
  assert.equal(s.state().checkpoint, 0); assert.equal(s.calls.saves, 0);
});

test('unrelated events advance the checkpoint without reading any Notion page', async () => {
  const s = setup([{ ...event(), page_id: 'f'.repeat(32) }]);
  assert.equal((await runEventSync(input, s.deps)).noChanges, true);
  assert.equal(s.calls.read, 0); assert.equal(s.calls.build, 0);
  assert.equal(s.state().checkpoint, 1);
});

test('a delayed deletion notification reads the live restored page instead of deleting it', async () => {
  const s = setup([event('page.deleted')]);
  const r = await runEventSync(input, s.deps);
  assert.equal(r.deleted, 0); assert.deepEqual(s.calls.deleted, []);
});

test('an ordinary update that loses access must not be treated as a deletion', async () => {
  const s = setup([event()]);
  s.deps.loadPage = async () => { throw new Error('Notion API error (404)'); };
  await assert.rejects(runEventSync(input, s.deps), /404/);
  assert.deepEqual(s.calls.deleted, []); assert.equal(s.state().checkpoint, 0);
});

test('schema and mapping changes require explicit full reconciliation and stay pending', async () => {
  for (const e of [{ ...event('database.schema_updated'), page_id: db }, { ...event(), page_id: project }]) {
    const s = setup([e]);
    await assert.rejects(runEventSync(input, s.deps), /完整比對/);
    assert.equal(s.calls.read, 0); assert.equal(s.state().checkpoint, 0);
  }
});

test('new works are discovered from their parent without querying the source database', async () => {
  const id = 'd'.repeat(32);
  const s = setup([{ ...event('page.created'), page_id: id, payload: { data: { parent: { id: db } } } }]);
  s.deps.loadPage = async () => { s.calls.read++; return { id, parent: { type: 'database_id', database_id: db }, properties: {} }; };
  s.next({ ...structuredClone(payload), studentWorks: [...payload.studentWorks, { ...payload.studentWorks[0], id }] });
  assert.equal((await runEventSync(input, s.deps)).changed, 1);
  assert.equal(s.calls.read, 1);
  assert.deepEqual(s.state().state.notion.queries[`${db}:{}`], [page, id]);
});

test('work moved outside the source database is removed only from its original assignment', async () => {
  const s = setup([event('page.moved')]);
  s.deps.loadPage = async () => ({ id: page, properties: {}, parent: { type: 'database_id', database_id: 'e'.repeat(32) } });
  s.next({ ...structuredClone(payload), studentWorks: [] });
  await runEventSync(input, s.deps);
  assert.deepEqual(s.calls.deleted, [page]);
});

test('events arriving after the initial watermark are not acknowledged by this job', async () => {
  const s = setup([event()]);
  s.deps.store.watermark = async () => 1;
  s.deps.loadPage = async () => {
    // Represents event 2 arriving while event 1 is being processed.
    return { id: page, properties: {}, parent: { type: 'database_id', database_id: db } };
  };
  await runEventSync(input, s.deps);
  assert.equal(s.state().checkpoint, 1);
});

test('idle sync reads only a lightweight checkpoint, not the full source snapshot', async () => {
  const s = setup();
  s.deps.store.head = async () => ({ checkpoint: 0, version: 1, slug: 'course' });
  s.deps.store.load = async () => { throw new Error('Must not read snapshot'); };
  assert.equal((await runEventSync(input, s.deps)).noChanges, true);
});
