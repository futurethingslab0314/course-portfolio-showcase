import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';
import { uploadImageUrlToR2 } from './imageStoreR2';

test('uploadImageUrlToR2 uploads original, thumbnail, and preview from one source image', async () => {
  const originalFetch = globalThis.fetch;
  const uploads: Array<{ url: string; contentType: string }> = [];
  const sourcePng = await sharp({
    create: { width: 2, height: 2, channels: 3, background: '#336699' },
  }).png().toBuffer();

  process.env.R2_ACCOUNT_ID = 'account';
  process.env.R2_ACCESS_KEY_ID = 'access';
  process.env.R2_SECRET_ACCESS_KEY = 'secret';
  process.env.R2_BUCKET = 'bucket';
  process.env.R2_PUBLIC_BASE_URL = 'https://images.example.com';
  process.env.R2_S3_ENDPOINT = 'https://account.r2.cloudflarestorage.com';

  globalThis.fetch = (async (input, init) => {
    const url = String(input);
    if (!init?.method) {
      return new Response(sourcePng, { status: 200, headers: { 'content-type': 'image/png' } });
    }

    uploads.push({ url, contentType: String((init.headers as Record<string, string>)['Content-Type']) });
    return new Response('', { status: 200 });
  }) as typeof fetch;

  try {
    const result = await uploadImageUrlToR2({
      sourceUrl: 'https://notion.example/photo.png',
      courseSlug: 'course',
      projectNotionId: 'project',
      workNotionId: 'work',
      generateCardCaseVariants: true,
    }) as any;

    assert.equal(uploads.length, 3);
    assert.deepEqual(uploads.map((upload) => upload.contentType), ['image/png', 'image/webp', 'image/webp']);
    assert.match(result.publicUrl, /\.png$/);
    assert.match(result.thumbnailUrl, /-thumbnail\.webp$/);
    assert.match(result.previewUrl, /-preview\.webp$/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
