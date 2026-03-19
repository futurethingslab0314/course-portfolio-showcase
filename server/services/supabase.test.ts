import test from 'node:test';
import assert from 'node:assert/strict';
import {
  deleteProjectsNotInCourse,
  deleteStudentWorksNotInProjects,
  fetchCoursePayloadBySlugFromSupabase,
  upsertProjectsToSupabase,
} from './supabase';
import { Project } from '../../src/types';

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

test('upsertProjectsToSupabase stores publication status for draft and published projects', async () => {
  let requestBody = '';

  const projects: Project[] = [
    {
      id: 'project-published',
      projectName: 'Published Project',
      projectDescription: '',
      courseId: 'course-1',
      tabName: 'Published',
      order: 1,
      sourceDatabaseId: 'db-published',
      displayStyle: 'generic-card',
      visibility: 'published',
    },
    {
      id: 'project-draft',
      projectName: 'Draft Project',
      projectDescription: '',
      courseId: 'course-1',
      tabName: 'Draft',
      order: 2,
      sourceDatabaseId: 'db-draft',
      displayStyle: 'generic-card',
      visibility: 'draft',
    },
  ];

  globalThis.fetch = async (_input, init) => {
    requestBody = String(init?.body || '');
    return new Response(requestBody, {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  await upsertProjectsToSupabase(projects, 'course-row-1');

  assert.match(requestBody, /"is_published":true/);
  assert.match(requestBody, /"is_published":false/);
});

test('fetchCoursePayloadBySlugFromSupabase returns only published projects and their works', async () => {
  let requestCount = 0;

  globalThis.fetch = async () => {
    requestCount += 1;

    if (requestCount === 1) {
      return new Response(
        JSON.stringify([
          {
            id: 'course-row-1',
            notion_page_id: 'course-1',
            slug: 'course-a',
            course_name: 'Course A',
            course_summary: '',
            cover_image_url: '',
            is_active: true,
          },
        ]),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }

    if (requestCount === 2) {
      return new Response(
        JSON.stringify([
          {
            id: 'project-row-1',
            notion_page_id: 'project-1',
            course_id: 'course-row-1',
            project_name: 'Published Project',
            project_description: '',
            tab_name: 'Published',
            order: 1,
            source_database_id: 'db-published',
            ui_pattern: 'activity-event',
            field_mapping: {},
            is_published: true,
          },
          {
            id: 'project-row-2',
            notion_page_id: 'project-2',
            course_id: 'course-row-1',
            project_name: 'Draft Project',
            project_description: '',
            tab_name: 'Draft',
            order: 2,
            source_database_id: 'db-draft',
            ui_pattern: 'generic-card',
            field_mapping: {},
            is_published: false,
          },
        ]),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify([
        {
          id: 'work-row-1',
          notion_page_id: 'work-1',
          project_id: 'project-row-1',
          source_database_id: 'db-published',
          assignment_name: 'Published Work',
          members: ['Author A', 'Author B'],
          description: '',
          main_image_url: '',
          blog_content: null,
          metadata: {
            themeTag: 'Conference',
            startDate: '2026-03-01',
            endDate: '2026-03-03',
            country: 'Taiwan',
            city: 'Taipei',
            grant: 'NSTC',
            publicationName: 'CHI 2026',
            moreImages: ['https://example.com/2.jpg'],
            year: '2026',
          },
        },
        {
          id: 'work-row-2',
          notion_page_id: 'work-2',
          project_id: 'project-row-2',
          source_database_id: 'db-draft',
          assignment_name: 'Draft Work',
          members: [],
          description: '',
          main_image_url: '',
          blog_content: null,
          metadata: {},
        },
      ]),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  };

  const payload = await fetchCoursePayloadBySlugFromSupabase('course-a');

  assert.equal(payload.projects.length, 1);
  assert.equal(payload.projects[0]?.id, 'project-1');
  assert.equal(payload.projects[0]?.displayStyle, 'activity-event');
  assert.equal(payload.studentWorks.length, 1);
  assert.equal(payload.studentWorks[0]?.id, 'work-1');
  assert.equal(payload.studentWorks[0]?.themeTag, 'Conference');
  assert.equal(payload.studentWorks[0]?.startDate, '2026-03-01');
  assert.equal(payload.studentWorks[0]?.endDate, '2026-03-03');
  assert.equal(payload.studentWorks[0]?.country, 'Taiwan');
  assert.equal(payload.studentWorks[0]?.city, 'Taipei');
  assert.equal(payload.studentWorks[0]?.grant, 'NSTC');
  assert.equal(payload.studentWorks[0]?.publicationName, 'CHI 2026');
  assert.deepEqual(payload.studentWorks[0]?.members, ['Author A', 'Author B']);
  assert.deepEqual(payload.studentWorks[0]?.moreImages, ['https://example.com/2.jpg']);
  assert.equal(payload.studentWorks[0]?.year, '2026');
});

test('deleteProjectsNotInCourse deletes stale projects for a course', async () => {
  let calledUrl = '';

  globalThis.fetch = async (input) => {
    calledUrl = String(input);
    return new Response(JSON.stringify([{ id: 'project-row-stale' }]), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  const deleted = await deleteProjectsNotInCourse({
    courseId: 'course-row-1',
    activeProjectNotionIds: ['project-1', 'project-2'],
  });

  assert.equal(deleted, 1);
  assert.match(calledUrl, /\/rest\/v1\/projects\?/);
  assert.match(calledUrl, /course_id=eq\.course-row-1/);
  assert.match(calledUrl, /notion_page_id=/);
});
