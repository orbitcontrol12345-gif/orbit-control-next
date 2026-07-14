import {
  HeadObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';

import { r2 } from '@/lib/r2';

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
  const response = await fetch(imageUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 Orbit-Control-Image-Sync',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(
      `Failed to download image: ${response.status}`
    );
  }

  const contentType =
    response.headers.get('content-type') || 'image/jpeg';

  if (!contentType.startsWith('image/')) {
    throw new Error(
      `Invalid content type: ${contentType}`
    );
  }

  const buffer = Buffer.from(
    await response.arrayBuffer()
  );

  if (buffer.length === 0) {
    throw new Error('Downloaded image is empty');
  }

  return {
    buffer,
    contentType,
    size: buffer.length,
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
