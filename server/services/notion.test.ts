import test from 'node:test';
import assert from 'node:assert/strict';
import { blockToBlogSectionForTest, fetchAllCourses, fetchStudentWorksForProject } from './notion';
import { Project } from '../../src/types';

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

test('blockToBlogSectionForTest preserves rich-text color annotations in paragraph blocks', async () => {
  const section = await blockToBlogSectionForTest({
    id: 'paragraph-color-block',
    type: 'paragraph',
    paragraph: {
      rich_text: [
        {
          plain_text: 'Alert',
          annotations: {
            bold: false,
            italic: false,
            underline: false,
            strikethrough: false,
            code: false,
            color: 'red',
          },
        },
        {
          plain_text: ' note',
          annotations: {
            bold: false,
            italic: false,
            underline: false,
            strikethrough: false,
            code: false,
            color: 'yellow_background',
          },
        },
      ],
    },
  } as any);

  assert.deepEqual(section, {
    type: 'text',
    blockType: 'paragraph',
    content: 'Alert note',
    richText: [
      { text: 'Alert', color: 'red' },
      { text: ' note', color: 'yellow_background' },
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

test('blockToBlogSectionForTest maps Notion callout blocks into blog callout sections', async () => {
  const section = await blockToBlogSectionForTest({
    id: 'callout-block',
    type: 'callout',
    callout: {
      rich_text: [
        {
          plain_text: 'Remember',
          annotations: {
            bold: true,
            italic: false,
            underline: false,
            strikethrough: false,
            code: false,
          },
        },
        { plain_text: ' the field context' },
      ],
    },
  } as any);

  assert.deepEqual(section, {
    type: 'text',
    blockType: 'callout',
    content: 'Remember the field context',
    richText: [
      { text: 'Remember', bold: true },
      { text: ' the field context' },
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

test('blockToBlogSectionForTest maps toggle heading blocks with nested list children', async () => {
  const section = await blockToBlogSectionForTest({
    id: 'toggle-heading-block',
    type: 'heading_2',
    heading_2: {
      is_toggleable: true,
      rich_text: [
        { plain_text: 'Open findings' },
      ],
    },
    children: [
      {
        id: 'bullet-child',
        type: 'bulleted_list_item',
        bulleted_list_item: {
          rich_text: [
            { plain_text: 'Interview synthesis' },
          ],
        },
      },
      {
        id: 'number-child',
        type: 'numbered_list_item',
        numbered_list_item: {
          rich_text: [
            { plain_text: 'Prototype audit' },
          ],
        },
      },
    ],
  } as any);

  assert.deepEqual(section, {
    type: 'toggle',
    blockType: 'heading_2',
    content: 'Open findings',
    richText: [{ text: 'Open findings' }],
    children: [
      {
        type: 'text',
        blockType: 'bulleted_list_item',
        content: 'Interview synthesis',
        richText: [{ text: 'Interview synthesis' }],
      },
      {
        type: 'text',
        blockType: 'numbered_list_item',
        content: 'Prototype audit',
        richText: [{ text: 'Prototype audit' }],
      },
    ],
  });
});

test('blockToBlogSectionForTest maps column lists with column children', async () => {
  const section = await blockToBlogSectionForTest({
    id: 'column-list-block',
    type: 'column_list',
    column_list: {},
    children: [
      {
        id: 'left-column',
        type: 'column',
        column: {},
        children: [
          {
            id: 'left-paragraph',
            type: 'paragraph',
            paragraph: {
              rich_text: [
                { plain_text: 'Left body' },
              ],
            },
          },
        ],
      },
      {
        id: 'right-column',
        type: 'column',
        column: {},
        children: [
          {
            id: 'right-paragraph',
            type: 'paragraph',
            paragraph: {
              rich_text: [
                { plain_text: 'Right body' },
              ],
            },
          },
        ],
      },
    ],
  } as any);

  assert.deepEqual(section, {
    type: 'column_list',
    columns: [
      {
        children: [
          {
            type: 'text',
            blockType: 'paragraph',
            content: 'Left body',
            richText: [{ text: 'Left body' }],
          },
        ],
      },
      {
        children: [
          {
            type: 'text',
            blockType: 'paragraph',
            content: 'Right body',
            richText: [{ text: 'Right body' }],
          },
        ],
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

test('blockToBlogSectionForTest maps embedded video blocks into playable video sections', async () => {
  const section = await blockToBlogSectionForTest({
    id: 'embed-block',
    type: 'embed',
    embed: {
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    },
  } as any);

  assert.deepEqual(section, {
    type: 'video',
    content: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    provider: 'youtube',
  });
});

test('blockToBlogSectionForTest maps Notion video files into playable video sections', async () => {
  const section = await blockToBlogSectionForTest({
    id: 'video-block',
    type: 'video',
    video: {
      type: 'external',
      external: {
        url: 'https://example.com/demo.mp4',
      },
    },
  } as any);

  assert.deepEqual(section, {
    type: 'video',
    content: 'https://example.com/demo.mp4',
    provider: 'direct',
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

test('fetchStudentWorksForProject expands card-case student, case, and body relations', async () => {
  const project: Project = {
    id: 'project-card-case',
    courseId: 'course-1',
    projectName: 'Card Case Project',
    projectDescription: 'Card case description',
    tabName: 'Card Case',
    order: 0,
    sourceDatabaseId: 'student-db',
    displayStyle: 'card-case',
    visibility: 'published',
  };

  globalThis.fetch = async (input) => {
    const url = String(input);

    if (url.includes('/databases/student-db/query')) {
      return new Response(
        JSON.stringify({
          results: [
            {
              id: 'student-page-1',
              properties: {
                group: { type: 'select', select: { name: 'Group A' } },
                StudentName: { type: 'title', title: [{ plain_text: 'Alice' }] },
                StudentID: { type: 'rich_text', rich_text: [{ plain_text: 'S001' }] },
                year: { type: 'rich_text', rich_text: [{ plain_text: '2026' }] },
                CaseCards: { type: 'relation', relation: [{ id: 'case-page-1' }] },
              },
            },
            {
              id: 'student-page-2',
              properties: {
                group: { type: 'select', select: { name: 'Group A' } },
                StudentName: { type: 'title', title: [{ plain_text: 'Bob' }] },
                StudentID: { type: 'rich_text', rich_text: [{ plain_text: 'S002' }] },
                year: { type: 'rich_text', rich_text: [{ plain_text: '2026' }] },
                CaseCards: { type: 'relation', relation: [{ id: 'case-page-1' }] },
              },
            },
          ],
          has_more: false,
        }),
      );
    }

    if (url.includes('/pages/case-page-1')) {
      return new Response(
        JSON.stringify({
          id: 'case-page-1',
          properties: {
            CaseName: { type: 'title', title: [{ plain_text: 'Rehab Glove' }] },
            BodyPart: { type: 'relation', relation: [{ id: 'body-page-1' }] },
            mainImage: { type: 'files', files: [{ type: 'external', external: { url: 'https://example.com/case.jpg' } }] },
            TargetUser: { type: 'rich_text', rich_text: [{ plain_text: 'Stroke Patient' }] },
            CaseYear: { type: 'rich_text', rich_text: [{ plain_text: '2026' }] },
            DesignTeam: { type: 'rich_text', rich_text: [{ plain_text: 'Team Alpha' }] },
            Keywords: { type: 'multi_select', multi_select: [{ name: 'Rehab' }, { name: 'Wearable' }] },
            StudentName: { type: 'relation', relation: [{ id: 'student-page-1' }, { id: 'student-page-2' }] },
          },
        }),
      );
    }

    if (url.includes('/pages/body-page-1')) {
      return new Response(
        JSON.stringify({
          id: 'body-page-1',
          properties: {
            Icon: { type: 'files', files: [{ type: 'external', external: { url: 'https://example.com/icon.png' } }] },
          },
        }),
      );
    }

    throw new Error(`Unexpected fetch URL: ${url}`);
  };

  const warnings: Array<{ level: 'warning' | 'error'; code: string; message: string }> = [];
  const works = await fetchStudentWorksForProject(project, {}, undefined, warnings);

  const groupRecord = works.find((work) => work.cardCaseRecordType === 'group');
  const caseRecord = works.find((work) => work.cardCaseRecordType === 'case');

  assert.equal(groupRecord?.group, 'Group A');
  assert.deepEqual(groupRecord?.memberDetails, [
    { name: 'Alice', id: 'S001' },
    { name: 'Bob', id: 'S002' },
  ]);
  assert.deepEqual(groupRecord?.caseIds, ['case-page-1']);

  assert.equal(caseRecord?.assignmentName, 'Rehab Glove');
  assert.equal(caseRecord?.interactionPart, 'https://example.com/icon.png');
  assert.equal(caseRecord?.targetUser, 'Stroke Patient');
  assert.equal(caseRecord?.designTeam, 'Team Alpha');
  assert.deepEqual(caseRecord?.tags, ['Rehab', 'Wearable']);
  assert.deepEqual(caseRecord?.memberDetails, [
    { name: 'Alice', id: 'S001' },
    { name: 'Bob', id: 'S002' },
  ]);
  assert.equal(warnings.length, 0);
});
