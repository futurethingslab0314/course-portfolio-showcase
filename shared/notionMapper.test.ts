import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeStudentWork } from './notionMapper';

test('normalizeStudentWork maps activity-event aliases without explicit field mapping', () => {
  const warnings: Array<{ level: 'warning' | 'error'; code: string; message: string }> = [];
  const work = normalizeStudentWork(
    {
      id: 'activity-1',
      'Activity Name': 'CHI 2026 Research Presentation',
      description: 'Presented a paper about collaborative AI systems.',
      'Files & media': ['https://example.com/cover.jpg', 'https://example.com/2.jpg'],
      'theme tag': 'Conference',
      year: '2026',
      'start date': '2026-03-01',
      'end date': '2026-03-03',
      country: 'Taiwan',
      city: 'Taipei',
      grant: 'NSTC',
      'publication name': 'CHI 2026',
      members: ['Author A', 'Author B'],
    },
    'db-activity',
    {},
    warnings,
    {
      projectId: 'project-1',
      courseId: 'course-1',
      sourceDatabaseId: 'db-activity',
    },
  );

  assert.equal(work.assignmentName, 'CHI 2026 Research Presentation');
  assert.equal(work.mainImage, 'https://example.com/cover.jpg');
  assert.deepEqual(work.moreImages, ['https://example.com/2.jpg']);
  assert.equal(work.themeTag, 'Conference');
  assert.equal(work.startDate, '2026-03-01');
  assert.equal(work.endDate, '2026-03-03');
  assert.equal(work.country, 'Taiwan');
  assert.equal(work.city, 'Taipei');
  assert.equal(work.grant, 'NSTC');
  assert.equal(work.publicationName, 'CHI 2026');
  assert.deepEqual(work.members, ['Author A', 'Author B']);
  assert.deepEqual(work.tags, ['Conference']);
  assert.equal(warnings.length, 0);
});

test('normalizeStudentWork infers multiple story buttons from button and URL pairs', () => {
  const warnings: Array<{ level: 'warning' | 'error'; code: string; message: string }> = [];
  const work = normalizeStudentWork(
    {
      id: 'blog-1',
      title: 'Blog With Links',
      description: 'Testing multiple CTA buttons.',
      mainImage: 'https://example.com/cover.jpg',
      button01: 'Read Article',
      URLbutton01: 'https://example.com/article',
      button02: 'View Dataset',
      URLbutton02: 'https://example.com/dataset',
    },
    'db-blog',
    {},
    warnings,
    {
      projectId: 'project-blog',
      courseId: 'course-1',
      sourceDatabaseId: 'db-blog',
    },
  );

  assert.deepEqual(work.storyButtons, [
    { label: 'Read Article', url: 'https://example.com/article' },
    { label: 'View Dataset', url: 'https://example.com/dataset' },
  ]);
  assert.equal(warnings.length, 0);
});
