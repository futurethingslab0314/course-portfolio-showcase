import test from 'node:test';
import assert from 'node:assert/strict';
import { rewriteBlogContentImagesToR2ForTest } from './syncToSupabase';
import { StudentWork } from '../../src/types';

test('rewriteBlogContentImagesToR2ForTest rewrites nested blog image sections to R2 URLs', async () => {
  const blogContent: NonNullable<StudentWork['blogContent']> = [
    { type: 'text', content: 'Intro', blockType: 'paragraph' },
    { type: 'image', content: 'https://notion.site/image-1', caption: 'Hero' },
    {
      type: 'toggle',
      content: 'Details',
      children: [
        { type: 'image', content: 'https://notion.site/image-2', caption: 'Nested' },
      ],
    },
  ];

  const uploaded: string[] = [];

  const result = await rewriteBlogContentImagesToR2ForTest(blogContent, async (sourceUrl) => {
    uploaded.push(sourceUrl);
    return `https://r2.example/${uploaded.length}`;
  });

  assert.deepEqual(uploaded, ['https://notion.site/image-1', 'https://notion.site/image-2']);
  assert.equal(result.uploaded, 2);
  assert.equal(result.skipped, 0);
  assert.deepEqual(result.blogContent, [
    { type: 'text', content: 'Intro', blockType: 'paragraph' },
    { type: 'image', content: 'https://r2.example/1', caption: 'Hero' },
    {
      type: 'toggle',
      content: 'Details',
      children: [
        { type: 'image', content: 'https://r2.example/2', caption: 'Nested' },
      ],
    },
  ]);
});
