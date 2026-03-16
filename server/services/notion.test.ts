import test from 'node:test';
import assert from 'node:assert/strict';
import { blockToBlogSectionForTest } from './notion';

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
            [{ plain_text: 'Role' }],
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
    hasColumnHeader: true,
    hasRowHeader: false,
  });
});
