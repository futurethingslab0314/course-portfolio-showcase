import test from 'node:test';
import assert from 'node:assert/strict';
import { inferFieldMapping, getTemplateTargetFields } from './mappingPipeline';

test('inferFieldMapping maps files-and-media source fields to mainImage for gallery-slide', () => {
  const result = inferFieldMapping({
    sourceDatabaseId: 'db-cmf-mood-board',
    uiPattern: 'gallery-slide',
    schemaProfile: {
      sourceDatabaseId: 'db-cmf-mood-board',
      totalRecords: 1,
      fields: {
        assignmentName: { name: 'Assignment Name', inferredTypes: ['string'], nullRate: 0, sampleValues: ['CMF Mood Board'] },
        members: { name: 'Members', inferredTypes: ['string[]'], nullRate: 0, sampleValues: [['莊以寧']] },
        description: { name: 'Description', inferredTypes: ['string'], nullRate: 0, sampleValues: ['...'] },
        'Files & media': { name: 'Files & media', inferredTypes: ['array'], nullRate: 0, sampleValues: [['https://example.com/image.jpg']] },
      },
    },
    targetSchemaFields: getTemplateTargetFields('gallery-slide'),
  });

  assert.deepEqual(result.fieldMapping.mainImage?.sourceCandidates, ['Files & media']);
  assert.equal(result.fieldMapping.mainImage?.transform, 'string');
  assert.equal(result.confidenceReport.find((item) => item.targetField === 'mainImage')?.matchedFrom, 'alias');
});
