import { NextRequest, NextResponse } from 'next/server';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { downloadImageToBuffer } from '@/lib/image-uploader';
import { r2 } from '@/lib/r2';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const imageUrl =
      req.nextUrl.searchParams.get('url') ??
      'https://i.ebayimg.com/images/g/NO_IMAGE_AVAILABLE/s-l1600.jpg';

    const { buffer, contentType } =
      await downloadImageToBuffer(imageUrl);

    const extension = contentType === 'image/webp'
      ? 'webp'
      : contentType === 'image/png'
        ? 'png'
        : 'jpg';

    const key = `orbit-control/test/${Date.now()}.${extension}`;

    const result = await r2.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME!,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        ContentLength: buffer.length,
        CacheControl: 'private, no-store',
      })
    );

    return NextResponse.json({
      success: true,
      bucket: process.env.R2_BUCKET_NAME,
      key,
      etag: result.ETag,
      size: buffer.length,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        error: String(error),
      },
      { status: 500 }
    );
  }
}
