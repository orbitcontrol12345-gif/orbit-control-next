import { NextRequest, NextResponse } from 'next/server';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { r2 } from '@/lib/r2';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const imageUrl =
      req.nextUrl.searchParams.get('url') ??
      'https://i.ebayimg.com/images/g/NO_IMAGE_AVAILABLE/s-l1600.jpg';

    const response = await fetch(imageUrl);

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to download image',
        },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    const key = `orbit-control/test/${Date.now()}.jpg`;

    const result = await r2.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME!,
        Key: key,
        Body: buffer,
        ContentType: response.headers.get('content-type') ?? 'image/jpeg',
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
