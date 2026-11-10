import test from 'node:test';
import assert from 'node:assert/strict';
import { collectKeywordTags, collectThemeTags, filterAndSortWorksForDisplay } from './courseDetailViewModel';
import { StudentWork } from '../../types';

const baseWork = {
  members: [],
  description: '',
  mainImage: 'https://example.com/image.jpg',
  sourceDatabaseId: 'db-activity',
} satisfies Partial<StudentWork>;

test('collectThemeTags includes activity-event themeTag values', () => {
  const works: StudentWork[] = [
    {
      ...baseWork,
      id: '1',
      assignmentName: 'Conference 1',
      themeTag: 'Academic Conference',
    } as StudentWork,
    {
      ...baseWork,
      id: '2',
      assignmentName: 'Workshop 1',
      themeTag: 'Workshop',
      tags: ['Hands-on'],
    } as StudentWork,
  ];

  assert.deepEqual(collectThemeTags(works), ['Academic Conference', 'Hands-on', 'Workshop']);
});

test('collectKeywordTags includes gallery-story tags and removes duplicates', () => {
  const works: StudentWork[] = [
    {
      ...baseWork,
      id: 'gallery-1',
      assignmentName: 'Tracking 1',
      tags: ['Consumption', 'Diary'],
    } as StudentWork,
    {
      ...baseWork,
      id: 'gallery-2',
      assignmentName: 'Tracking 2',
      tags: ['Diary', 'Rhythm'],
    } as StudentWork,
  ];

  assert.deepEqual(collectKeywordTags(works), ['Consumption', 'Diary', 'Rhythm']);
});

test('filterAndSortWorksForDisplay filters activity-event by theme tag and sorts newest first', () => {
  const works: StudentWork[] = [
    {
      ...baseWork,
      id: 'older',
      assignmentName: 'Older Conference',
      themeTag: 'Academic Conference',
      startDate: '2025-04-01',
      year: '2025',
    } as StudentWork,
    {
      ...baseWork,
      id: 'latest',
      assignmentName: 'Latest Conference',
      themeTag: 'Academic Conference',
      startDate: '2026-05-10',
      year: '2026',
    } as StudentWork,
    {
      ...baseWork,
      id: 'workshop',
      assignmentName: 'Workshop',
      themeTag: 'Workshop',
      endDate: '2027-02-01',
      year: '2027',
    } as StudentWork,
  ];

  const result = filterAndSortWorksForDisplay(works, {
    displayStyle: 'activity-event',
    selectedYear: 'ALL',
    selectedThemeTag: 'Academic Conference',
    selectedKeywordTag: 'ALL',
    starredOnly: false,
  });

  assert.deepEqual(
    result.map((work) => work.id),
    ['latest', 'older'],
  );
});

test('filterAndSortWorksForDisplay falls back to endDate and year for activity-event sorting', () => {
  const works: StudentWork[] = [
    {
      ...baseWork,
      id: 'year-only',
      assignmentName: 'Year Only',
      year: '2024',
    } as StudentWork,
    {
      ...baseWork,
      id: 'end-date',
      assignmentName: 'End Date',
      endDate: '2025-01-15',
      year: '2025',
    } as StudentWork,
    {
      ...baseWork,
      id: 'start-date',
      assignmentName: 'Start Date',
      startDate: '2026-01-15',
      year: '2026',
    } as StudentWork,
  ];

  const result = filterAndSortWorksForDisplay(works, {
    displayStyle: 'activity-event',
    selectedYear: 'ALL',
    selectedThemeTag: 'ALL',
    selectedKeywordTag: 'ALL',
    starredOnly: false,
  });

  assert.deepEqual(
    result.map((work) => work.id),
    ['start-date', 'end-date', 'year-only'],
  );
});

test('filterAndSortWorksForDisplay filters gallery-story by keyword tag', () => {
  const works: StudentWork[] = [
    {
      ...baseWork,
      id: 'tracking-1',
      assignmentName: 'Tracking 1',
      tags: ['Consumption'],
      year: '2024',
    } as StudentWork,
    {
      ...baseWork,
      id: 'tracking-2',
      assignmentName: 'Tracking 2',
      tags: ['Rhythm'],
      year: '2024',
    } as StudentWork,
  ];

  const result = filterAndSortWorksForDisplay(works, {
    displayStyle: 'gallery-story',
    selectedYear: 'ALL',
    selectedThemeTag: 'ALL',
    selectedKeywordTag: 'Consumption',
    starredOnly: false,
  });

  assert.deepEqual(
    result.map((work) => work.id),
    ['tracking-1'],
  );
});

test('filterAndSortWorksForDisplay sorts gallery-story by createdAt descending', () => {
  const works: StudentWork[] = [
    {
      ...baseWork,
      id: 'older',
      assignmentName: 'Older',
      createdAt: '2024-01-10T10:00:00.000Z',
    } as StudentWork,
    {
      ...baseWork,
      id: 'latest',
      assignmentName: 'Latest',
      createdAt: '2024-06-10T10:00:00.000Z',
    } as StudentWork,
    {
      ...baseWork,
      id: 'no-created-at',
      assignmentName: 'No Created At',
    } as StudentWork,
  ];

  const result = filterAndSortWorksForDisplay(works, {
    displayStyle: 'gallery-story',
    selectedYear: 'ALL',
    selectedThemeTag: 'ALL',
    selectedKeywordTag: 'ALL',
    starredOnly: false,
  });

  assert.deepEqual(
    result.map((work) => work.id),
    ['latest', 'older', 'no-created-at'],
  );
});

for (const displayStyle of ['generic-card', 'gallery-slide', 'card-spec', 'blog-post', 'card-case', 'gallery-story'] as const) {
  test(`${displayStyle} pins instruction and orders by creation date with deterministic ties`, () => {
    const works = [
      { ...baseWork, id: 'z', assignmentName: 'Z', createdAt: '2026-01-01' },
      { ...baseWork, id: 'missing-z', assignmentName: 'Missing' },
      { ...baseWork, id: 'instruction', assignmentName: 'Guide', tags: [' Instruction '], createdAt: '2020-01-01' },
      { ...baseWork, id: 'new', assignmentName: 'New', createdAt: '2026-06-01' },
      { ...baseWork, id: 'a', assignmentName: 'A', createdAt: '2026-01-01' },
      { ...baseWork, id: 'missing-a', assignmentName: 'Invalid', createdAt: 'invalid' },
    ] as StudentWork[];
    const options = { displayStyle, selectedYear: 'ALL', selectedThemeTag: 'ALL', selectedKeywordTag: 'ALL', starredOnly: false };
    const expected = ['instruction', 'new', 'a', 'z', 'missing-a', 'missing-z'];
    assert.deepEqual(filterAndSortWorksForDisplay(works, options).map(work => work.id), expected);
    assert.deepEqual(filterAndSortWorksForDisplay([...works].reverse(), options).map(work => work.id), expected);
    assert.equal(works[0].id, 'z');
  });
}
