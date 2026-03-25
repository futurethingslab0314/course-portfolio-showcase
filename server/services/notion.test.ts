import test from 'node:test';
import assert from 'node:assert/strict';
import { blockToBlogSectionForTest, fetchAllCourses } from './notion';

const originalFetch = globalThis.fetch;
const originalEnv = {
  NOTION_TOKEN: process.env.NOTION_TOKEN,
  NOTION_API_KEY: process.env.NOTION_API_KEY,
  NOTION_DB_COURSES_ID: process.env.NOTION_DB_COURSES_ID,
};

test.beforeEach(() => {
  process.env.NOTION_TOKEN = 'test-notion-token';
  delete process.env.NOTION_API_KEY;
  process.env.NOTION_DB_COURSES_ID = 'courses-db';
});

test.afterEach(() => {
  globalThis.fetch = originalFetch;
  process.env.NOTION_TOKEN = originalEnv.NOTION_TOKEN;
  process.env.NOTION_API_KEY = originalEnv.NOTION_API_KEY;
  process.env.NOTION_DB_COURSES_ID = originalEnv.NOTION_DB_COURSES_ID;
});

test('blockToBlogSectionForTest preserves rich-text links in paragraph blocks', async () => {
  const section = await blockToBlogSectionForTest({
    id: 'paragraph-block',
    type: 'paragraph',
    paragraph: {
      rich_text: [
        { plain_text: 'See ', href: null },
        { plain_text: 'project docs', href: 'https://example.com/docs' },
      ],
    },
  } as any);

  assert.deepEqual(section, {
    type: 'text',
    blockType: 'paragraph',
    content: 'See project docs',
    richText: [
      { text: 'See ' },
      { text: 'project docs', href: 'https://example.com/docs' },
    ],
  });
});

test('blockToBlogSectionForTest maps Notion table blocks into blog table sections', async () => {
  const section = await blockToBlogSectionForTest({
    id: 'table-block',
    type: 'table',
    table: {
      has_column_header: true,
      has_row_header: false,
    },
    children: [
      {
        id: 'row-1',
        type: 'table_row',
        table_row: {
          cells: [
            [{ plain_text: 'Name' }],
            [{ plain_text: 'Role', href: 'https://example.com/role' }],
          ],
        },
      },
      {
        id: 'row-2',
        type: 'table_row',
        table_row: {
          cells: [
            [{ plain_text: 'Alice' }],
            [{ plain_text: 'Research' }],
          ],
        },
      },
    ],
  } as any);

  assert.deepEqual(section, {
    type: 'table',
    rows: [
      ['Name', 'Role'],
      ['Alice', 'Research'],
    ],
    richRows: [
      [
        [{ text: 'Name' }],
        [{ text: 'Role', href: 'https://example.com/role' }],
      ],
      [
        [{ text: 'Alice' }],
        [{ text: 'Research' }],
      ],
    ],
    hasColumnHeader: true,
    hasRowHeader: false,
  });
});

test('blockToBlogSectionForTest preserves heading metadata and annotations', async () => {
  const section = await blockToBlogSectionForTest({
    id: 'heading-block',
    type: 'heading_2',
    heading_2: {
      rich_text: [
        {
          plain_text: 'Important',
          annotations: {
            bold: true,
            italic: false,
            underline: false,
            strikethrough: false,
            code: false,
          },
        },
        {
          plain_text: ' note',
          annotations: {
            bold: false,
            italic: true,
            underline: true,
            strikethrough: false,
            code: false,
          },
        },
      ],
    },
  } as any);

  assert.deepEqual(section, {
    type: 'text',
    blockType: 'heading_2',
    content: 'Important note',
    richText: [
      { text: 'Important', bold: true },
      { text: ' note', italic: true, underline: true },
    ],
  });
});

test('blockToBlogSectionForTest maps toggle blocks with nested children', async () => {
  const section = await blockToBlogSectionForTest({
    id: 'toggle-block',
    type: 'toggle',
    toggle: {
      rich_text: [
        { plain_text: 'Read more' },
      ],
    },
    children: [
      {
        id: 'child-paragraph',
        type: 'paragraph',
        paragraph: {
          rich_text: [
            {
              plain_text: 'Nested detail',
              annotations: {
                bold: false,
                italic: false,
                underline: false,
                strikethrough: false,
                code: true,
              },
            },
          ],
        },
      },
    ],
  } as any);

  assert.deepEqual(section, {
    type: 'toggle',
    content: 'Read more',
    richText: [{ text: 'Read more' }],
    children: [
      {
        type: 'text',
        blockType: 'paragraph',
        content: 'Nested detail',
        richText: [{ text: 'Nested detail', code: true }],
      },
    ],
  });
});

test('blockToBlogSectionForTest maps Notion code blocks with language metadata', async () => {
  const section = await blockToBlogSectionForTest({
    id: 'code-block',
    type: 'code',
    code: {
      language: 'typescript',
      rich_text: [
        { plain_text: 'const answer = 42;' },
      ],
    },
  } as any);

  assert.deepEqual(section, {
    type: 'code',
    content: 'const answer = 42;',
    language: 'typescript',
  });
});

test('fetchAllCourses returns only published courses for homepage fallback', async () => {
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        results: [
          {
            id: 'course-1',
            properties: {
              Slug: { type: 'rich_text', rich_text: [{ plain_text: 'published-course' }] },
              CourseName: { type: 'rich_text', rich_text: [{ plain_text: 'Published Course' }] },
              CourseSummary: { type: 'rich_text', rich_text: [{ plain_text: 'Visible summary' }] },
              Projects: { type: 'relation', relation: [] },
              PublishedStatus: { type: 'checkbox', checkbox: true },
            },
          },
          {
            id: 'course-2',
            properties: {
              Slug: { type: 'rich_text', rich_text: [{ plain_text: 'hidden-course' }] },
              CourseName: { type: 'rich_text', rich_text: [{ plain_text: 'Hidden Course' }] },
              CourseSummary: { type: 'rich_text', rich_text: [{ plain_text: 'Hidden summary' }] },
              Projects: { type: 'relation', relation: [] },
              PublishedStatus: { type: 'checkbox', checkbox: false },
            },
          },
        ],
        has_more: false,
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' },
      },
    );

  const courses = await fetchAllCourses();

  assert.equal(courses.length, 1);
  assert.equal(courses[0]?.slug, 'published-course');
  assert.equal(courses[0]?.courseName, 'Published Course');
});
