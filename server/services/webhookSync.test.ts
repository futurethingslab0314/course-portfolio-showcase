import test from 'node:test';
import assert from 'node:assert/strict';
import { syncProjectMappings } from './webhookSync';

const originalFetch = globalThis.fetch;
const originalEnv = {
  NOTION_TOKEN: process.env.NOTION_TOKEN,
  NOTION_API_KEY: process.env.NOTION_API_KEY,
};

test.beforeEach(() => {
  process.env.NOTION_TOKEN = 'test-notion-token';
  delete process.env.NOTION_API_KEY;
});

test.afterEach(() => {
  globalThis.fetch = originalFetch;
  process.env.NOTION_TOKEN = originalEnv.NOTION_TOKEN;
  process.env.NOTION_API_KEY = originalEnv.NOTION_API_KEY;
});

test('syncProjectMappings writes RelationConfig for card-case projects', async () => {
  const patchBodies: unknown[] = [];

  globalThis.fetch = async (input, init) => {
    const url = String(input);

    if (url.includes('/pages/project-page-1') && (!init?.method || init.method === 'GET')) {
      return new Response(
        JSON.stringify({
          id: 'project-page-1',
          properties: {
            SourceDatabaseId: { type: 'rich_text', rich_text: [{ plain_text: 'student-db' }] },
            FieldMapping: { type: 'rich_text', rich_text: [] },
            RelationConfig: { type: 'rich_text', rich_text: [] },
            UiPattern: { type: 'select', select: { name: 'card-case' } },
          },
        }),
      );
    }

    if (url.includes('/databases/student-db') && !url.includes('/query')) {
      return new Response(
        JSON.stringify({
          properties: {
            group: { type: 'select' },
            StudentName: { type: 'title' },
            StudentID: { type: 'rich_text' },
            year: { type: 'number' },
            CaseCards: { type: 'relation', relation: { database_id: 'case-db' } },
          },
        }),
      );
    }

    if (url.includes('/databases/case-db') && !url.includes('/query')) {
      return new Response(
        JSON.stringify({
          properties: {
            CaseName: { type: 'title' },
            BodyPart: { type: 'relation', relation: { database_id: 'body-db' } },
            mainImage: { type: 'files' },
            TargetUser: { type: 'rich_text' },
            CaseYear: { type: 'number' },
            DesignTeam: { type: 'rich_text' },
            Keywords: { type: 'multi_select' },
            StudentName: { type: 'relation', relation: { database_id: 'student-db' } },
          },
        }),
      );
    }

    if (url.includes('/databases/body-db') && !url.includes('/query')) {
      return new Response(
        JSON.stringify({
          properties: {
            Icon: { type: 'files' },
          },
        }),
      );
    }

    if (url.includes('/pages/project-page-1') && init?.method === 'PATCH') {
      patchBodies.push(JSON.parse(String(init.body || '{}')));
      return new Response('{}', { status: 200 });
    }

    throw new Error(`Unexpected fetch URL: ${url}`);
  };

  const result = await syncProjectMappings({
    projectPageId: 'project-page-1',
    overwrite: true,
  });

  assert.equal(result.updated, 1);
  assert.equal(result.inferredUiPattern, 'card-case');
  assert.equal(result.inferredRelationConfig?.entry.caseRelationField, 'CaseCards');
  assert.equal(result.inferredRelationConfig?.case.bodyRelationField, 'BodyPart');
  assert.equal(result.inferredRelationConfig?.body.iconField, 'Icon');

  const patched = patchBodies[0] as Record<string, any>;
  const patchedProperties = patched.properties || {};
  const relationConfigText = JSON.stringify(patchedProperties.RelationConfig || patchedProperties['Relation Config'] || {});
  assert.match(relationConfigText, /\\"caseRelationField\\": \\"CaseCards\\"/);
  assert.match(relationConfigText, /\\"bodyRelationField\\": \\"BodyPart\\"/);
  assert.match(relationConfigText, /\\"iconField\\": \\"Icon\\"/);
});
