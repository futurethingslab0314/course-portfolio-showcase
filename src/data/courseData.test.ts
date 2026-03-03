import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCoursePayloadBySlug, loadCoursesForHome } from './courseData';

const originalFetch = globalThis.fetch;

test.after(() => {
  globalThis.fetch = originalFetch;
});

test('loadCoursesForHome returns API courses when response is valid', async () => {
  const courses = [
    { id: 'course-1', slug: 'course-1', courseName: 'Course 1', quarter: 'Fall', year: '2025', description: '', coverImage: '' },
  ];

  globalThis.fetch = async () =>
    new Response(JSON.stringify({ courses }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });

  const result = await loadCoursesForHome();
  assert.deepEqual(result, courses);
});

test('loadCoursesForHome rejects when API request fails', async () => {
  globalThis.fetch = async () => {
    throw new Error('network down');
  };

  await assert.rejects(() => loadCoursesForHome(), /network down/);
});

test('loadCoursePayloadBySlug rejects when API request fails', async () => {
  globalThis.fetch = async () => {
    throw new Error('network down');
  };

  await assert.rejects(() => loadCoursePayloadBySlug('any-course'), /network down/);
});
