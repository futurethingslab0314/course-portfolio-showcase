import test from 'node:test';
import assert from 'node:assert/strict';
import { deleteStudentWorksNotInProjects } from './supabase';

const originalFetch = globalThis.fetch;
const originalEnv = {
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
};

test.beforeEach(() => {
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SECRET_KEY = 'test-secret';
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
});

test.afterEach(() => {
  globalThis.fetch = originalFetch;
  process.env.SUPABASE_URL = originalEnv.SUPABASE_URL;
  process.env.SUPABASE_SECRET_KEY = originalEnv.SUPABASE_SECRET_KEY;
  process.env.SUPABASE_SERVICE_ROLE_KEY = originalEnv.SUPABASE_SERVICE_ROLE_KEY;
});

test('deleteStudentWorksNotInProjects deletes stale rows within project scope', async () => {
  let calledUrl = '';
  let calledMethod = '';

  globalThis.fetch = async (input, init) => {
    calledUrl = String(input);
    calledMethod = String(init?.method || '');
    return new Response(JSON.stringify([{ id: 'row-1' }, { id: 'row-2' }]), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  const deleted = await deleteStudentWorksNotInProjects({
    projectIds: ['project-a', 'project-b'],
    activeWorkNotionIds: ['work-keep-1', 'work-keep-2'],
  });

  assert.equal(deleted, 2);
  assert.equal(calledMethod, 'DELETE');
  assert.match(calledUrl, /\/rest\/v1\/student_works\?/);
  assert.match(calledUrl, /project_id=/);
  assert.match(calledUrl, /notion_page_id=/);
});

test('deleteStudentWorksNotInProjects no-ops when projectIds is empty', async () => {
  let fetchCalled = false;
  globalThis.fetch = async () => {
    fetchCalled = true;
    return new Response('[]', { status: 200 });
  };

  const deleted = await deleteStudentWorksNotInProjects({
    projectIds: [],
    activeWorkNotionIds: ['work-keep-1'],
  });

  assert.equal(deleted, 0);
  assert.equal(fetchCalled, false);
});
