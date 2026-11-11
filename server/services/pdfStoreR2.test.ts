import test from 'node:test';
import assert from 'node:assert/strict';
import { uploadPdfToR2 } from './imageStoreR2';

test('PDF storage verifies bytes and uploads inline and attachment copies', async () => {
  const names = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET', 'R2_PUBLIC_BASE_URL'];
  const saved = names.map((name) => process.env[name]);
  const originalFetch = globalThis.fetch;
  const uploads: Array<{ url: string; headers: Headers }> = [];
  try {
    names.forEach((name) => { process.env[name] = name === 'R2_PUBLIC_BASE_URL' ? 'https://pdf.example' : 'test'; });
    globalThis.fetch = async (input, init) => {
      if (!init?.method) return new Response('%PDF-1.7\nexample', { headers: { 'content-type': 'application/octet-stream' } });
      if (init.method === 'HEAD') return new Response(null, { status: 404 });
      uploads.push({ url: String(input), headers: new Headers(init.headers) });
      return new Response(null, { status: 200 });
    };
    const result = await uploadPdfToR2({ sourceUrl: 'https://notion.example/signed', courseSlug: 'course', projectNotionId: 'project', workNotionId: 'work', fileName: 'manual.pdf' });
    assert.equal(uploads.length, 2);
    assert.equal(uploads[0].headers.get('content-type'), 'application/pdf');
    assert.match(uploads[0].headers.get('content-disposition')!, /^inline;/);
    assert.match(uploads[1].headers.get('content-disposition')!, /^attachment;/);
    assert.match(result.publicUrl, /^https:\/\/pdf.example\/.*\.pdf$/);
    assert.match(result.downloadUrl, /-download.pdf$/);
    globalThis.fetch = async () => new Response('<html>Not a PDF</html>');
    await assert.rejects(uploadPdfToR2({ sourceUrl: 'https://example.com/not-pdf', courseSlug: 'course', projectNotionId: 'project', workNotionId: 'work' }), /not a PDF/);
  } finally {
    globalThis.fetch = originalFetch;
    names.forEach((name, index) => { if (saved[index] === undefined) delete process.env[name]; else process.env[name] = saved[index]; });
  }
});
