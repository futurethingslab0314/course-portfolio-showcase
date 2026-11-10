import test from 'node:test';
import assert from 'node:assert/strict';
import { withNotionSnapshot, newNotionSnapshot } from './notionSnapshot';
import { fetchPageById } from './notion';

test('snapshot capture and replay avoid re-reading unchanged Notion pages', async () => {
  const original = globalThis.fetch;
  process.env.NOTION_TOKEN = 'test';
  let reads = 0;
  globalThis.fetch = async () => { reads++; return new Response(JSON.stringify({ id: 'a'.repeat(32), properties: {} })); };
  try {
    const snapshot = newNotionSnapshot();
    await withNotionSnapshot(snapshot, false, () => fetchPageById('a'.repeat(32)));
    await withNotionSnapshot(snapshot, true, () => fetchPageById('a'.repeat(32)));
    assert.equal(reads, 1);
  } finally { globalThis.fetch = original; delete process.env.NOTION_TOKEN; }
});

test('related card-case pages replay from the snapshot and explicit deletion removes the case safely', async () => {
  const { fetchStudentWorksForProject } = await import('./notion');
  const { notionId, removeSnapshotPage } = await import('./notionSnapshot');
  const original = globalThis.fetch, token = process.env.NOTION_TOKEN;
  process.env.NOTION_TOKEN = 'test';
  const project = { id: 'project', courseId: 'course', projectName: 'Cases', projectDescription: '', tabName: 'Cases', order: 0, sourceDatabaseId: 'students', displayStyle: 'card-case', visibility: 'published' } as any;
  const title = (value: string) => ({ type: 'title', title: [{ plain_text: value }] });
  const relation = (id: string) => ({ type: 'relation', relation: [{ id }] });
  globalThis.fetch = async input => {
    const url = String(input);
    if (url.includes('/databases/')) return new Response(JSON.stringify({ results: [{ id: 'student', properties: { StudentName: title('Alice'), group: title('A'), CaseCards: relation('case') } }], has_more: false }));
    if (url.endsWith('/case')) return new Response(JSON.stringify({ id: 'case', properties: { CaseName: title('Case'), BodyPart: relation('body') } }));
    if (url.endsWith('/body')) return new Response(JSON.stringify({ id: 'body', properties: { Icon: { type: 'files', files: [{ type: 'external', external: { url: 'https://example.com/old.png' } }] } } }));
    throw new Error('Unexpected read');
  };
  try {
    const snapshot = newNotionSnapshot();
    await withNotionSnapshot(snapshot, false, () => fetchStudentWorksForProject(project, {}, undefined, []));
    snapshot.pages[notionId('body')].properties.Icon.files[0].external.url = 'https://example.com/new.png';
    globalThis.fetch = async () => { throw new Error('Unchanged related pages must not be fetched'); };
    const replay = await withNotionSnapshot(snapshot, true, () => fetchStudentWorksForProject(project, {}, undefined, []));
    assert.equal(replay.find(work => work.id === 'case')?.interactionPart, 'https://example.com/new.png');
    removeSnapshotPage(snapshot, 'case');
    const warnings: any[] = [];
    const deleted = await withNotionSnapshot(snapshot, true, () => fetchStudentWorksForProject(project, {}, undefined, warnings));
    assert.ok(!deleted.some(work => work.id === 'case'));
    assert.deepEqual(deleted[0].caseIds, []);
    assert.deepEqual(warnings, []);
  } finally { globalThis.fetch = original; if (token === undefined) delete process.env.NOTION_TOKEN; else process.env.NOTION_TOKEN = token; }
});
