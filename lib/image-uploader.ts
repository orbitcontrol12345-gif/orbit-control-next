import {
  HeadObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';

import { r2 } from '@/lib/r2';

const TRUSTED_IMAGE_HOSTS = new Set([
  'i.ebayimg.com',
  'images.pexels.com',
  'orbit-surplus.com',
  'pub-e11286a0a91241bfbfe0d74a29552eed.r2.dev',
  'www.orbit-surplus.com',
  'xofucnqpqmxztazhtqix.supabase.co',
]);

const SUPPORTED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

const MAX_REMOTE_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_IMAGE_REDIRECTS = 3;
const IMAGE_FETCH_TIMEOUT_MS = 15_000;

export function parseTrustedImageUrl(value: string): URL {
  let url: URL;

  try {
    url = new URL(String(value || '').trim());
  } catch {
    throw new Error('Invalid remote image URL');
  }

  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    (url.port && url.port !== '443') ||
    !TRUSTED_IMAGE_HOSTS.has(url.hostname.toLowerCase())
  ) {
    throw new Error('Remote image host is not allowed');
  }

  return url;
}

function hasValidImageSignature(
  buffer: Buffer,
  contentType: string,
): boolean {
  if (contentType === 'image/jpeg') {
    return (
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff
    );
  }

  if (contentType === 'image/png') {
    return (
      buffer.length >= 8 &&
      buffer.subarray(0, 8).equals(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      )
    );
  }

  if (contentType === 'image/webp') {
    return (
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP'
    );
  }

  return false;
}

async function readResponseWithLimit(response: Response): Promise<Buffer> {
  const declaredLength = Number(
    response.headers.get('content-length') || 0,
  );

  if (
    Number.isFinite(declaredLength) &&
    declaredLength > MAX_REMOTE_IMAGE_BYTES
  ) {
    throw new Error('Remote image exceeds the size limit');
  }

  if (!response.body) {
    throw new Error('Remote image response has no body');
  }

  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();

    if (done) break;

    totalBytes += value.byteLength;

    if (totalBytes > MAX_REMOTE_IMAGE_BYTES) {
      await reader.cancel();
      throw new Error('Remote image exceeds the size limit');
    }

    chunks.push(Buffer.from(value));
  }

  return Buffer.concat(chunks, totalBytes);
}

export function makeR2ProductImageKey(params: {
  ebayItemId: string;
  index: number;
  ext?: string;
}) {
  const ext = params.ext || 'jpg';

  if (params.index === 0) {
    return `orbit-control/products/${params.ebayItemId}/main.${ext}`;
  }

  return `orbit-control/products/${params.ebayItemId}/${params.index}.${ext}`;
}

export async function downloadImageToBuffer(imageUrl: string) {
  let currentUrl = parseTrustedImageUrl(imageUrl);
  let response: Response | null = null;

  for (
    let redirectCount = 0;
    redirectCount <= MAX_IMAGE_REDIRECTS;
    redirectCount += 1
  ) {
    response = await fetch(currentUrl, {
      headers: {
        Accept: 'image/webp,image/png,image/jpeg',
        'User-Agent': 'Mozilla/5.0 Orbit-Control-Image-Sync',
      },
      cache: 'no-store',
      redirect: 'manual',
      signal: AbortSignal.timeout(IMAGE_FETCH_TIMEOUT_MS),
    });

    if (![301, 302, 303, 307, 308].includes(response.status)) {
      break;
    }

    const location = response.headers.get('location');

    if (!location || redirectCount === MAX_IMAGE_REDIRECTS) {
      throw new Error('Remote image redirected too many times');
    }

    currentUrl = parseTrustedImageUrl(
      new URL(location, currentUrl).toString(),
    );
  }

  if (!response?.ok) {
    throw new Error(
      `Failed to download image: ${response?.status || 0}`
    );
  }

  const contentType =
    response.headers
      .get('content-type')
      ?.split(';')[0]
      ?.trim()
      .toLowerCase() || '';

  if (!SUPPORTED_IMAGE_TYPES.has(contentType)) {
    throw new Error(
      `Invalid content type: ${contentType}`
    );
  }

  const buffer = await readResponseWithLimit(response);

  if (!hasValidImageSignature(buffer, contentType)) {
    throw new Error('Downloaded file is not a valid supported image');
  }

  return {
    buffer,
    contentType,
    size: buffer.length,
    sourceUrl: currentUrl.toString(),
  };
}

export async function uploadBufferToR2(params: {
  key: string;
  buffer: Buffer;
  contentType: string;
}) {
  const bucket = process.env.R2_BUCKET_NAME;

  if (!bucket) {
    throw new Error('Missing R2_BUCKET_NAME');
  }

  const uploadResult = await r2.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: params.key,
      Body: params.buffer,
      ContentType: params.contentType,
      ContentLength: params.buffer.length,
      CacheControl:
        'public, max-age=31536000, immutable',
    })
  );

  const verifyResult = await r2.send(
    new HeadObjectCommand({
      Bucket: bucket,
      Key: params.key,
    })
  );

  const uploadedSize = Number(
    verifyResult.ContentLength || 0
  );

  if (uploadedSize <= 0) {
    throw new Error(
      `R2 verification failed: empty object ${params.key}`
    );
  }

  if (uploadedSize !== params.buffer.length) {
    throw new Error(
      `R2 size mismatch for ${params.key}: local=${params.buffer.length}, r2=${uploadedSize}`
    );
  }

  return {
    key: params.key,
    etag: uploadResult.ETag,
    verified: true,
    uploadedSize,
  };
}
