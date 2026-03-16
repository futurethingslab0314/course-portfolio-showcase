import test from 'node:test';
import assert from 'node:assert/strict';
import { filterVisibleProjectRowsForPayload } from './generator';
import { Project } from '../../src/types';

type ProjectPayloadRow = {
  project: Project;
  fieldMapping: {};
};

test('filterVisibleProjectRowsForPayload excludes draft projects', () => {
  const rows: ProjectPayloadRow[] = [
    {
      project: {
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
      fieldMapping: {},
    },
    {
      project: {
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
      fieldMapping: {},
    },
  ];

  const result = filterVisibleProjectRowsForPayload(rows);

  assert.equal(result.length, 1);
  assert.equal(result[0]?.project.id, 'project-published');
});
