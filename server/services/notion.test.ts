import test from 'node:test';
import assert from 'node:assert/strict';
import { blockToBlogSectionForTest } from './notion';

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
