import { createHash, createHmac } from 'node:crypto';
import sharp from 'sharp';
import { ImageAsset } from '../../src/types';

function getEnv(name: string, required = true): string {
  const value = process.env[name];
  if (!value && required) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value || '';
}

function toHex(buffer: Uint8Array): string {
  return Buffer.from(buffer).toString('hex');
}

function sha256Hex(input: Uint8Array | string): string {
  return createHash('sha256').update(input).digest('hex');
}

function hmac(key: Buffer | string, value: string): Buffer {
  return createHmac('sha256', key).update(value).digest();
}

function formatAmzDate(date = new Date()): { amzDate: string; dateStamp: string } {
  const iso = date.toISOString().replace(/[:-]|\.\d{3}/g, '');
  return {
    amzDate: iso,
    dateStamp: iso.slice(0, 8),
  };
}

function encodeRfc3986(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`);
}

function looksLikeHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function inferExtension(contentType: string | null, sourceUrl: string): string {
  const fromType = (contentType || '').toLowerCase().split(';')[0].trim();
  if (fromType === 'image/jpeg') return 'jpg';
  if (fromType === 'image/png') return 'png';
  if (fromType === 'image/webp') return 'webp';
  if (fromType === 'image/gif') return 'gif';
  if (fromType === 'image/avif') return 'avif';
  if (fromType === 'image/svg+xml') return 'svg';

  try {
    const pathname = new URL(sourceUrl).pathname;
    const tail = pathname.split('/').pop() || '';
    const ext = tail.includes('.') ? tail.split('.').pop() || '' : '';
    if (ext) return ext.toLowerCase().slice(0, 8);
  } catch {
    // no-op
  }

  return 'bin';
}

function sanitizePathSegment(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120) || 'unknown';
}

function r2Config() {
  const accountId = getEnv('R2_ACCOUNT_ID');
  const accessKeyId = getEnv('R2_ACCESS_KEY_ID');
  const secretAccessKey = getEnv('R2_SECRET_ACCESS_KEY');
  const bucket = getEnv('R2_BUCKET');
  const publicBaseUrl = getEnv('R2_PUBLIC_BASE_URL');
  const endpoint = (process.env.R2_S3_ENDPOINT || `https://${accountId}.r2.cloudflarestorage.com`).replace(/\/$/, '');

  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucket,
    publicBaseUrl: publicBaseUrl.replace(/\/$/, ''),
    endpoint,
  };
}

export function isR2ImageSyncEnabled(): boolean {
  const imageBackend = String(process.env.IMAGE_BACKEND || '').toLowerCase();
  const enabled = String(process.env.IMAGE_SYNC_ENABLED || 'false').toLowerCase() === 'true';
  return imageBackend === 'r2' && enabled;
}

async function requestObjectSigned(params: {
  key: string;
  method: 'PUT' | 'HEAD';
  body?: Uint8Array;
  contentType?: string;
}): Promise<Response> {
  const cfg = r2Config();
  const endpoint = new URL(cfg.endpoint);
  const host = endpoint.host;

  const canonicalUri = `/${[cfg.bucket, ...params.key.split('/').filter(Boolean)].map(encodeRfc3986).join('/')}`;
  const payloadHash = sha256Hex(params.body || '');
  const { amzDate, dateStamp } = formatAmzDate();

  const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
  const canonicalRequest = [params.method, canonicalUri, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');

  const credentialScope = `${dateStamp}/auto/s3/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${sha256Hex(canonicalRequest)}`;

  const kDate = hmac(`AWS4${cfg.secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, 'auto');
  const kService = hmac(kRegion, 's3');
  const kSigning = hmac(kService, 'aws4_request');
  const signature = toHex(hmac(kSigning, stringToSign));

  const authorization = `AWS4-HMAC-SHA256 Credential=${cfg.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  const uploadUrl = `${cfg.endpoint}${canonicalUri}`;

  return fetch(uploadUrl, {
    method: params.method,
    headers: {
      Authorization: authorization,
      'x-amz-date': amzDate,
      'x-amz-content-sha256': payloadHash,
      ...(params.contentType ? { 'Content-Type': params.contentType } : {}),
      ...(params.method === 'PUT' ? { 'Cache-Control': 'public, max-age=2592000, immutable' } : {}),
    },
    body: params.body,
  });
}

async function objectExists(key: string): Promise<boolean> {
  const response = await requestObjectSigned({ key, method: 'HEAD' });
  if (response.ok) return true;
  if (response.status === 404) return false;
  throw new Error(`R2 existence check failed (${response.status}): ${key}`);
}

async function putObjectSigned(params: { key: string; body: Uint8Array; contentType: string }): Promise<void> {
  const response = await requestObjectSigned({ ...params, method: 'PUT' });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`R2 upload failed (${response.status}): ${text}`);
  }
}

export interface ImageAssetUploadParams {
  sourceUrl: string;
  courseSlug: string;
  projectNotionId: string;
  workNotionId: string;
  variants?: 'standard' | 'thumbnail-only';
}

export interface ImageAssetUploadResult {
  asset: ImageAsset;
  uploaded: boolean;
  warning?: string;
}

interface StoredOriginal {
  body: Uint8Array;
  contentType: string;
  uploaded: boolean;
  key: string;
  publicUrl: string;
  basePath: string;
  fileStem: string;
}

async function storeOriginal(params: Omit<ImageAssetUploadParams, 'variants'>): Promise<StoredOriginal | null> {
  const sourceUrl = (params.sourceUrl || '').trim();
  if (!sourceUrl || !looksLikeHttpUrl(sourceUrl)) {
    return null;
  }

  const cfg = r2Config();
  const isStoredOriginal = sourceUrl.startsWith(`${cfg.publicBaseUrl}/`);
  const response = await fetch(sourceUrl);
  if (!response.ok) {
    throw new Error(`Failed to download source image (${response.status}): ${sourceUrl}`);
  }

  const contentType = response.headers.get('content-type') || 'application/octet-stream';
  const arrayBuffer = await response.arrayBuffer();
  const body = new Uint8Array(arrayBuffer);

  if (!body.length) {
    throw new Error(`Downloaded image is empty: ${sourceUrl}`);
  }

  const hash = sha256Hex(body).slice(0, 16);
  const ext = inferExtension(contentType, sourceUrl);

  const basePath = [
    'courses',
    sanitizePathSegment(params.courseSlug),
    'projects',
    sanitizePathSegment(params.projectNotionId),
  ].join('/');
  const key = isStoredOriginal
    ? sourceUrl.slice(cfg.publicBaseUrl.length + 1)
    : `${basePath}/${sanitizePathSegment(params.workNotionId)}-${hash}.${sanitizePathSegment(ext)}`;
  const keyParts = key.split('/');
  const originalFilename = keyParts.pop() || `${sanitizePathSegment(params.workNotionId)}-${hash}.${sanitizePathSegment(ext)}`;
  const fileStem = originalFilename.replace(/\.[^.]+$/, '');
  const originalBasePath = keyParts.join('/');

  const uploaded = !isStoredOriginal && !(await objectExists(key));
  if (uploaded) {
    await putObjectSigned({ key, body, contentType });
  }

  return {
    body,
    contentType,
    uploaded,
    key,
    publicUrl: `${cfg.publicBaseUrl}/${key}`,
    basePath: originalBasePath || basePath,
    fileStem,
  };
}

export async function uploadImageAssetToR2(params: ImageAssetUploadParams): Promise<ImageAssetUploadResult> {
  const sourceUrl = (params.sourceUrl || '').trim();
  const publicBase = sourceUrl && looksLikeHttpUrl(sourceUrl) ? r2Config().publicBaseUrl : '';
  if (publicBase && sourceUrl.startsWith(`${publicBase}/`)) {
    const key = sourceUrl.slice(publicBase.length + 1);
    const stem = key.replace(/\.[^/.]+$/, '');
    const keys = [key, `${stem}-thumbnail.webp`, ...(params.variants === 'thumbnail-only' ? [] : [`${stem}-preview.webp`])];
    const exists = await Promise.all(keys.map(objectExists));
    if (exists.every(Boolean)) {
      return {
        asset: {
          original: sourceUrl,
          thumbnail: `${publicBase}/${keys[1]}`,
          ...(keys[2] ? { preview: `${publicBase}/${keys[2]}` } : {}),
        },
        uploaded: false,
      };
    }
  }
  const stored = await storeOriginal(params);
  if (!stored) return { asset: { original: sourceUrl }, uploaded: false };

  const asset: ImageAsset = { original: stored.publicUrl };
  let uploaded = stored.uploaded;
  const contentType = stored.contentType.toLowerCase().split(';')[0].trim();
  if (contentType === 'image/svg+xml') {
    return { asset, uploaded };
  }

  try {
    const metadata = await sharp(stored.body, { animated: true }).metadata();
    if (contentType === 'image/gif' && (metadata.pages || 1) > 1) {
      return { asset, uploaded };
    }

    const thumbnailKey = `${stored.basePath}/${stored.fileStem}-thumbnail.webp`;
    if (!(await objectExists(thumbnailKey))) {
      const thumbnailBody = await sharp(stored.body)
        .rotate()
        .resize({ width: 640, height: 640, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();
      await putObjectSigned({ key: thumbnailKey, body: thumbnailBody, contentType: 'image/webp' });
      uploaded = true;
    }
    asset.thumbnail = `${r2Config().publicBaseUrl}/${thumbnailKey}`;

    if (params.variants !== 'thumbnail-only') {
      const previewKey = `${stored.basePath}/${stored.fileStem}-preview.webp`;
      if (!(await objectExists(previewKey))) {
        const previewBody = await sharp(stored.body)
          .rotate()
          .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 85 })
          .toBuffer();
        await putObjectSigned({ key: previewKey, body: previewBody, contentType: 'image/webp' });
        uploaded = true;
      }
      asset.preview = `${r2Config().publicBaseUrl}/${previewKey}`;
    }

    return { asset, uploaded };
  } catch (error) {
    return {
      asset,
      uploaded,
      warning: `Variant conversion failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export async function uploadImageUrlToR2(params: {
  sourceUrl: string;
  courseSlug: string;
  projectNotionId: string;
  workNotionId: string;
  generateCardCaseVariants?: boolean;
}): Promise<{ publicUrl: string; key: string; uploaded: boolean; thumbnailUrl?: string; previewUrl?: string }> {
  if (params.generateCardCaseVariants) {
    const result = await uploadImageAssetToR2({ ...params, variants: 'standard' });
    return {
      publicUrl: result.asset.original,
      key: result.asset.original.startsWith(`${r2Config().publicBaseUrl}/`)
        ? result.asset.original.slice(r2Config().publicBaseUrl.length + 1)
        : '',
      uploaded: result.uploaded,
      thumbnailUrl: result.asset.thumbnail,
      previewUrl: result.asset.preview,
    };
  }

  const sourceUrl = (params.sourceUrl || '').trim();
  if (!sourceUrl || !looksLikeHttpUrl(sourceUrl)) return { publicUrl: sourceUrl, key: '', uploaded: false };
  const cfg = r2Config();
  if (sourceUrl.startsWith(`${cfg.publicBaseUrl}/`)) {
    return { publicUrl: sourceUrl, key: sourceUrl.slice(cfg.publicBaseUrl.length + 1), uploaded: false };
  }
  const stored = await storeOriginal(params);
  if (!stored) return { publicUrl: sourceUrl, key: '', uploaded: false };
  return {
    publicUrl: stored.publicUrl,
    key: stored.key,
    uploaded: stored.uploaded,
  };
}
