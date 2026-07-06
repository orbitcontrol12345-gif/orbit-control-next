import { PutObjectCommand } from '@aws-sdk/client-s3';
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
  });

  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status}`);
  }

  const contentType = response.headers.get('content-type') || 'image/jpeg';

  if (!contentType.startsWith('image/')) {
    throw new Error(`Invalid content type: ${contentType}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());

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

  const result = await r2.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: params.key,
      Body: params.buffer,
      ContentType: params.contentType,
      CacheControl: 'public, max-age=31536000, immutable',
    })
  );

  return {
    key: params.key,
    etag: result.ETag,
  };
}
