import test from 'node:test';
import assert from 'node:assert/strict';
import { syncProjectToSupabase, countWorkImages } from './syncToSupabase';
import { StudentWork } from '../../src/types';

const projectId = 'a'.repeat(32);
const sourceId = 'b'.repeat(32);
const courseId = 'c'.repeat(32);
const coursesDb = 'd'.repeat(32);
const projectsDb = 'e'.repeat(32);
const text = (value: string) => ({ type: 'rich_text', rich_text: [{ plain_text: value }] });

for (const scenario of ['success', 'empty', 'read-error', 'wrong-project', 'ownership-conflict'] as const) {
  test(`assignment sync isolation: ${scenario}`, async () => {
    const env = { ...process.env };
    const originalFetch = globalThis.fetch;
    Object.assign(process.env, { NOTION_TOKEN: 'test', NOTION_DB_COURSES_ID: coursesDb, NOTION_DB_PROJECTS_ID: projectsDb, SUPABASE_URL: 'https://test.supabase.co', SUPABASE_SECRET_KEY: 'test', IMAGE_SYNC_ENABLED: 'false' });
    const writes: { path: string; body: any; method: string }[] = [];
    const sourceReads: string[] = [];
    const respond = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
    globalThis.fetch = async (input, init) => {
      const url = new URL(String(input));
      const notionPath = url.pathname.replace(/-/g, '');
      if (url.host === 'api.notion.com') {
        if (notionPath.includes(coursesDb)) return respond({ results: [{ id: courseId, properties: { Slug: text('course'), CourseName: text('Course') } }], has_more: false });
        if (notionPath.includes(projectsDb)) return respond({ results: [
          { id: projectId, properties: { Name: text('Assignment'), SourceDatabaseId: text(sourceId), UiPattern: text('GallerySlide') } },
          { id: 'f'.repeat(32), properties: { Name: text('Other'), SourceDatabaseId: text('other-db'), UiPattern: text('GallerySlide') } },
        ], has_more: false });
        sourceReads.push(notionPath);
        if (scenario === 'read-error') return respond({ message: 'Source unavailable' }, 403);
        return respond({ results: scenario === 'empty' ? [] : [{ id: 'work-1', properties: { assignmentName: text('Work'), mainImage: { type: 'files', files: [{ type: 'external', external: { url: 'https://example.com/a.jpg' } }] } } }], has_more: false });
      }
      const method = init?.method || 'GET';
      if (method !== 'GET') {
        writes.push({ path: url.pathname + url.search, body: init?.body ? JSON.parse(String(init.body)) : null, method });
        if (url.pathname.endsWith('/projects')) return respond([{ id: 'stored-project', notion_page_id: projectId, source_database_id: sourceId }]);
        return respond(method === 'POST' ? [{ id: 'stored-work' }] : []);
      }
      if (url.pathname.endsWith('/courses')) return respond([{ id: 'stored-course' }]);
      if (url.pathname.endsWith('/projects')) return respond([{ id: 'stored-project', notion_page_id: projectId, course_id: 'stored-course' }]);
      if (url.pathname.endsWith('/student_works')) return respond(scenario === 'ownership-conflict' ? [{ project_id: 'another-project' }] : []);
      throw new Error(`Unexpected request ${url}`);
    };
    try {
      const run = syncProjectToSupabase({ slug: 'course', projectId: scenario === 'wrong-project' ? '9'.repeat(32) : projectId, report: () => {} });
      if (scenario === 'success') {
        await run;
        assert.equal(sourceReads.length, 1);
        assert.ok(sourceReads[0].includes(sourceId));
        assert.equal(writes.length, 3);
        assert.ok(writes.every(write => !write.path.startsWith('/rest/v1/courses')));
        assert.equal(writes[0].body.length, 1);
        assert.equal(writes[1].body[0].project_id, 'stored-project');
        assert.match(decodeURIComponent(writes[2].path), /project_id=in\.\("stored-project"\)/);
      } else {
        await assert.rejects(run, scenario === 'empty' ? /no works/ : scenario === 'read-error' ? /Source reads failed/ : scenario === 'ownership-conflict' ? /another assignment/ : /not a database project/);
        assert.equal(writes.length, 0);
      }
    } finally {
      globalThis.fetch = originalFetch;
      for (const key of Object.keys(process.env)) if (!(key in env)) delete process.env[key];
      Object.assign(process.env, env);
    }
  });
}

test('image totals include all gallery and nested blog references', () => {
  const work = { mainImage: 'main.jpg', moreImages: ['second.jpg', ''], interactionPart: 'icon.jpg', blogContent: [
    { type: 'toggle', content: '', children: [{ type: 'image', content: 'nested.jpg' }] },
  ] } as StudentWork;
  assert.equal(countWorkImages(work), 4);
});
