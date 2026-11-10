import test from 'node:test';
import assert from 'node:assert/strict';
import { reuseWorkMedia, workFingerprint } from './incrementalMedia';
import { StudentWork } from '../../src/types';
const source = { id: 'w', assignmentName: 'Old', members: [], description: '', mainImage: 'https://prod-files-secure.s3.us-west-2.amazonaws.com/file/image.jpg?X-Amz-Signature=old', sourceDatabaseId: 'db' } as StudentWork;
const stored = { ...source, mainImage: 'https://images.example/r2.jpg', mainImageAsset: { original: 'https://images.example/r2.jpg', thumbnail: 'https://images.example/thumb.webp' } };
test('one-letter changes reuse existing images despite expiring Notion URLs', () => {
  const next = { ...source, assignmentName: 'New', mainImage: source.mainImage.replace('=old', '=new') };
  const reused = reuseWorkMedia(source, stored, next);
  assert.equal(reused.work.mainImage, stored.mainImage);
  assert.equal(reused.assets.get(stored.mainImage)?.thumbnail, stored.mainImageAsset.thumbnail);
  assert.notEqual(workFingerprint(next), workFingerprint(source));
  assert.equal(workFingerprint({ ...source, mainImage: next.mainImage }), workFingerprint(source));
});
test('external query parameters and replaced or removed images remain changes', () => {
  assert.notEqual(workFingerprint({ ...source, mainImage: 'https://example.com/image?v=1' }), workFingerprint({ ...source, mainImage: 'https://example.com/image?v=2' }));
  assert.equal(reuseWorkMedia(source, stored, { ...source, mainImage: '' }).work.mainImage, '');
});

test('text-only updates do not download images or perform R2 existence checks', async () => {
  const { rewriteWorkImagesToR2 } = await import('./syncToSupabase');
  const env = { ...process.env }, originalFetch = globalThis.fetch;
  Object.assign(process.env, { IMAGE_BACKEND: 'r2', IMAGE_SYNC_ENABLED: 'true' });
  globalThis.fetch = async () => { throw new Error('Unchanged images must not use the network'); };
  try {
    const reuse = reuseWorkMedia(source, stored, { ...source, description: 'One letter changed' });
    const payload = { course: { id: 'course' }, projects: [{ id: 'project', sourceDatabaseId: 'db', displayStyle: 'data-matrix' }], studentWorks: [reuse.work], warnings: [] } as any;
    await rewriteWorkImagesToR2(payload, 'test', undefined, reuse);
    assert.equal(payload.studentWorks[0].mainImage, stored.mainImage);
    assert.equal(payload.studentWorks[0].mainImageAsset.thumbnail, stored.mainImageAsset.thumbnail);
    assert.deepEqual(payload.warnings, []);
  } finally {
    globalThis.fetch = originalFetch;
    for (const key of Object.keys(process.env)) if (!(key in env)) delete process.env[key];
    Object.assign(process.env, env);
  }
});
