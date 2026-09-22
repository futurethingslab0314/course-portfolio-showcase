import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';
import { uploadImageAssetToR2, uploadImageUrlToR2 } from './imageStoreR2';

const ENV_NAMES = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET', 'R2_PUBLIC_BASE_URL', 'R2_S3_ENDPOINT'] as const;

interface Upload {
  url: string;
  body: Buffer;
  contentType: string;
}

async function withR2TestEnv(sourceBody: Buffer, contentType: string, run: (uploads: Upload[]) => Promise<void>): Promise<void> {
  const originalFetch = globalThis.fetch;
  const originalEnv = Object.fromEntries(ENV_NAMES.map((name) => [name, process.env[name]]));
  const uploads: Upload[] = [];

  Object.assign(process.env, {
    R2_ACCOUNT_ID: 'account', R2_ACCESS_KEY_ID: 'access', R2_SECRET_ACCESS_KEY: 'secret', R2_BUCKET: 'bucket',
    R2_PUBLIC_BASE_URL: 'https://images.example.com', R2_S3_ENDPOINT: 'https://account.r2.cloudflarestorage.com',
  });
  globalThis.fetch = (async (input, init) => {
    if (!init?.method) return new Response(sourceBody, { status: 200, headers: { 'content-type': contentType } });
    uploads.push({
      url: String(input), body: Buffer.from(init.body as Uint8Array),
      contentType: String((init.headers as Record<string, string>)['Content-Type']),
    });
    return new Response('', { status: 200 });
  }) as typeof fetch;

  try {
    await run(uploads);
  } finally {
    globalThis.fetch = originalFetch;
    for (const name of ENV_NAMES) {
      const value = originalEnv[name];
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}

function standardParams(sourceUrl = 'https://notion.example/photo.jpg') {
  return { sourceUrl, courseSlug: 'course', projectNotionId: 'project', workNotionId: 'work', variants: 'standard' as const };
}

test('uploadImageAssetToR2 creates bounded WebP variants', async () => {
  const source = await sharp({ create: { width: 2400, height: 1800, channels: 3, background: '#336699' } }).jpeg().toBuffer();
  await withR2TestEnv(source, 'image/jpeg', async (uploads) => {
    const result = await uploadImageAssetToR2(standardParams());
    const bodyFor = (suffix: string) => uploads.find(({ url }) => url.endsWith(suffix))!.body;
    assert.equal((await sharp(bodyFor('-thumbnail.webp')).metadata()).width, 640);
    assert.equal((await sharp(bodyFor('-preview.webp')).metadata()).width, 1600);
    assert.match(result.asset.thumbnail || '', /-thumbnail\.webp$/);
    assert.match(result.asset.preview || '', /-preview\.webp$/);
  });
});

test('uploadImageAssetToR2 never enlarges small images', async () => {
  const source = await sharp({ create: { width: 320, height: 240, channels: 3, background: '#336699' } }).jpeg().toBuffer();
  await withR2TestEnv(source, 'image/jpeg', async (uploads) => {
    await uploadImageAssetToR2(standardParams());
    for (const suffix of ['-thumbnail.webp', '-preview.webp']) {
      const upload = uploads.find(({ url }) => url.endsWith(suffix));
      assert.ok(upload);
      const metadata = await sharp(upload.body).metadata();
      assert.deepEqual({ width: metadata.width, height: metadata.height }, { width: 320, height: 240 });
    }
  });
});

test('uploadImageAssetToR2 applies EXIF orientation to variants', async () => {
  const source = await sharp({ create: { width: 1200, height: 800, channels: 3, background: '#336699' } })
    .jpeg().withMetadata({ orientation: 6 }).toBuffer();
  await withR2TestEnv(source, 'image/jpeg', async (uploads) => {
    await uploadImageAssetToR2(standardParams());
    const preview = uploads.find(({ url }) => url.endsWith('-preview.webp'));
    assert.ok(preview);
    const metadata = await sharp(preview.body).metadata();
    assert.deepEqual({ width: metadata.width, height: metadata.height }, { width: 800, height: 1200 });
  });
});

test('an existing R2 original is fetched for variants but is not uploaded again', async () => {
  const source = await sharp({ create: { width: 800, height: 600, channels: 3, background: '#336699' } }).jpeg().toBuffer();
  await withR2TestEnv(source, 'image/jpeg', async (uploads) => {
    const result = await uploadImageAssetToR2(standardParams('https://images.example.com/courses/course/projects/project/work-existing.jpg'));
    assert.equal(uploads.filter(({ url }) => url.endsWith('/work-existing.jpg')).length, 0);
    assert.equal(uploads.length, 2);
    assert.ok(result.asset.thumbnail);
    assert.ok(result.asset.preview);
  });
});

test('SVG retains an original-only asset', async () => {
  const source = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>');
  await withR2TestEnv(source, 'image/svg+xml', async (uploads) => {
    const result = await uploadImageAssetToR2(standardParams('https://notion.example/vector.svg'));
    assert.deepEqual(Object.keys(result.asset), ['original']);
    assert.equal(uploads.length, 1);
  });
});

test('animated GIF retains an original-only asset', async () => {
  const frame = Buffer.alloc(2 * 4 * 4, 255);
  const source = await sharp(frame, { raw: { width: 2, height: 4, channels: 4, pageHeight: 2 } })
    .gif({ keepDuplicateFrames: true, delay: [100, 100], loop: 0 })
    .toBuffer();
  assert.equal((await sharp(source, { animated: true }).metadata()).pages, 2);
  await withR2TestEnv(source, 'image/gif', async (uploads) => {
    const result = await uploadImageAssetToR2(standardParams('https://notion.example/animated.gif'));
    assert.deepEqual(Object.keys(result.asset), ['original']);
    assert.equal(uploads.length, 1);
  });
});

test('uploadImageUrlToR2 keeps its legacy card-case result shape', async () => {
  const source = await sharp({ create: { width: 2, height: 2, channels: 3, background: '#336699' } }).png().toBuffer();
  await withR2TestEnv(source, 'image/png', async (uploads) => {
    const result = await uploadImageUrlToR2({
      sourceUrl: 'https://notion.example/photo.png', courseSlug: 'course', projectNotionId: 'project', workNotionId: 'work',
      generateCardCaseVariants: true,
    });
    assert.deepEqual(uploads.map((upload) => upload.contentType), ['image/png', 'image/webp', 'image/webp']);
    assert.match(result.publicUrl, /\.png$/);
    assert.match(result.thumbnailUrl || '', /-thumbnail\.webp$/);
    assert.match(result.previewUrl || '', /-preview\.webp$/);
  });
});
