import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { uploadImageAssetToR2, uploadImageUrlToR2 } from './imageStoreR2';

const ENV_NAMES = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET', 'R2_PUBLIC_BASE_URL', 'R2_S3_ENDPOINT'] as const;

interface Upload {
  url: string;
  body: Buffer;
  contentType: string;
}

async function withR2TestEnv(sourceBody: Buffer, contentType: string, run: (uploads: Upload[]) => Promise<void>, existingSuffixes: string[] = []): Promise<void> {
  const originalFetch = globalThis.fetch;
  const originalEnv = Object.fromEntries(ENV_NAMES.map((name) => [name, process.env[name]]));
  const uploads: Upload[] = [];

  Object.assign(process.env, {
    R2_ACCOUNT_ID: 'account', R2_ACCESS_KEY_ID: 'access', R2_SECRET_ACCESS_KEY: 'secret', R2_BUCKET: 'bucket',
    R2_PUBLIC_BASE_URL: 'https://images.example.com', R2_S3_ENDPOINT: 'https://account.r2.cloudflarestorage.com',
  });
  globalThis.fetch = (async (input, init) => {
    if (init?.method === 'HEAD') {
      const exists = uploads.some((upload) => upload.url === String(input))
        || existingSuffixes.some((suffix) => String(input).endsWith(suffix));
      return new Response(null, { status: exists ? 200 : 404 });
    }
    if (!init?.method) {
      const stored = uploads.find((upload) => new URL(upload.url).pathname.replace('/bucket', '') === new URL(String(input)).pathname);
      return new Response(stored?.body || sourceBody, { status: 200, headers: { 'content-type': stored?.contentType || contentType } });
    }
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

for (const [sourceUrl, mime] of [
  ['https://notion.example/photo.HEIC?signature=1', 'application/octet-stream'],
  ['https://notion.example/file', 'image/heic'],
  ['https://notion.example/file', 'application/octet-stream'],
  ['https://images.example.com/courses/photo.heic', 'image/heic'],
]) {
  test(`HEIC becomes a full-resolution JPEG original (${sourceUrl}, ${mime})`, async () => {
    const source = await readFile(new URL('./fixtures/sample.heic', import.meta.url));
    await withR2TestEnv(source, mime, async (uploads) => {
      const result = await uploadImageAssetToR2(standardParams(sourceUrl));
      assert.match(result.asset.original, /-heic-jpeg-v1\.jpg$/);
      assert.equal(result.warning, undefined);
      assert.equal(uploads.length, 3);
      const jpeg = uploads.find((item) => item.contentType === 'image/jpeg');
      assert.ok(jpeg);
      const metadata = await sharp(jpeg.body).metadata();
      assert.equal(metadata.format, 'jpeg');
      assert.deepEqual([metadata.width, metadata.height], [96, 64]);
      assert.ok(result.asset.thumbnail);
      assert.ok(result.asset.preview);
      const again = await uploadImageAssetToR2(standardParams(sourceUrl));
      assert.deepEqual(again.asset, result.asset);
      assert.equal(again.uploaded, false);
      assert.equal(again.warning, undefined);
      assert.equal(uploads.length, 3);
    });
  });
}

test('original-only upload also converts HEIC to JPEG', async () => {
  const source = await readFile(new URL('./fixtures/sample.heic', import.meta.url));
  await withR2TestEnv(source, 'image/heic', async (uploads) => {
    const result = await uploadImageUrlToR2(standardParams('https://notion.example/photo.heic'));
    assert.match(result.publicUrl, /\.jpg$/);
    assert.equal(uploads.length, 1);
    assert.equal(uploads[0].contentType, 'image/jpeg');
  });
});

test('corrupt HEIC reports conversion failure without uploading invalid JPEG', async () => {
  await withR2TestEnv(Buffer.from('invalid HEIC'), 'image/heic', async (uploads) => {
    await assert.rejects(uploadImageAssetToR2(standardParams('https://notion.example/bad.heic')), /HEIC to JPEG conversion failed/);
    assert.equal(uploads.length, 0);
  });
});

test('repeated Notion uploads reuse original and both variants; changed bytes produce new keys', async () => {
  const source = await sharp({ create: { width: 8, height: 6, channels: 3, background: '#336699' } }).jpeg().toBuffer();
  await withR2TestEnv(source, 'image/jpeg', async (uploads) => {
    const first = await uploadImageAssetToR2(standardParams());
    assert.equal(uploads.length, 3);
    const second = await uploadImageAssetToR2(standardParams('https://notion.example/photo.jpg?new-signature=1'));
    assert.deepEqual(second.asset, first.asset);
    assert.equal(second.uploaded, false);
    assert.equal(uploads.length, 3);
    source[source.length - 1] ^= 1;
    const changed = await uploadImageAssetToR2(standardParams());
    assert.notEqual(changed.asset.original, first.asset.original);
    assert.equal(changed.uploaded, true);
  });
});

test('complete R2 assets skip source download and all uploads', async () => {
  await withR2TestEnv(Buffer.from('must not decode'), 'image/jpeg', async (uploads) => {
    const previousFetch = globalThis.fetch;
    globalThis.fetch = (async (input, init) => {
      assert.equal(init?.method, 'HEAD');
      return previousFetch(input, init);
    }) as typeof fetch;
    const result = await uploadImageAssetToR2(standardParams('https://images.example.com/photo.jpg'));
    assert.equal(result.uploaded, false);
    assert.equal(result.warning, undefined);
    assert.equal(result.asset.preview, 'https://images.example.com/photo-preview.webp');
    assert.equal(uploads.length, 0);
  }, ['/photo.jpg', '/photo-thumbnail.webp', '/photo-preview.webp']);
});

test('an existing thumbnail only uploads the missing preview', async () => {
  const source = await sharp({ create: { width: 8, height: 6, channels: 3, background: '#336699' } }).jpeg().toBuffer();
  await withR2TestEnv(source, 'image/jpeg', async (uploads) => {
    const result = await uploadImageAssetToR2(standardParams('https://images.example.com/courses/photo.jpg'));
    assert.equal(result.uploaded, true);
    assert.equal(uploads.length, 1);
    assert.match(uploads[0].url, /photo-preview\.webp$/);
    assert.equal(result.asset.thumbnail, 'https://images.example.com/courses/photo-thumbnail.webp');
  }, ['/photo.jpg', '/photo-thumbnail.webp']);
});

test('thumbnail-only assets skip without requiring a preview', async () => {
  await withR2TestEnv(Buffer.from('must not decode'), 'image/jpeg', async (uploads) => {
    const result = await uploadImageAssetToR2({ ...standardParams('https://images.example.com/photo.jpg'), variants: 'thumbnail-only' });
    assert.equal(result.uploaded, false);
    assert.equal(result.asset.preview, undefined);
    assert.equal(result.warning, undefined);
    assert.equal(uploads.length, 0);
  }, ['/photo.jpg', '/photo-thumbnail.webp']);
});

test('failed existence checks are not mistaken for missing objects', async () => {
  await withR2TestEnv(Buffer.from('unused'), 'image/jpeg', async (uploads) => {
    globalThis.fetch = async () => new Response(null, { status: 403 });
    await assert.rejects(uploadImageAssetToR2(standardParams('https://images.example.com/photo.jpg')), /existence check failed \(403\)/);
    assert.equal(uploads.length, 0);
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
