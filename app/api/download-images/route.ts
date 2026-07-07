import { NextRequest, NextResponse } from 'next/server';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { r2 } from '@/lib/r2';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getPublicUrl(key: string) {
  const baseUrl = process.env.R2_PUBLIC_URL;

  if (!baseUrl) {
    throw new Error('Missing R2_PUBLIC_URL');
  }

  return `${baseUrl.replace(/\/$/, '')}/${key}`;
}

async function uploadToR2({
  imageUrl,
  ebayItemId,
}: {
  imageUrl: string;
  ebayItemId: string;
}) {
  const res = await fetch(imageUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0',
    },
  });

  if (!res.ok) {
    throw new Error(`Image download failed: ${res.status}`);
  }

  const contentType = res.headers.get('content-type') || 'image/jpeg';

  if (!contentType.startsWith('image/')) {
    throw new Error(`Invalid image content type: ${contentType}`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());

  const ext = contentType.includes('webp')
    ? 'webp'
    : contentType.includes('png')
      ? 'png'
      : 'jpg';

  const key = `orbit-control/products/${ebayItemId}/main.${ext}`;

  await r2.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  );

  return getPublicUrl(key);
}

export async function GET(req: NextRequest) {
  const limit = Math.min(
    Number(req.nextUrl.searchParams.get('limit') ?? 30),
    100
  );

  const { data: products, error } = await supabaseAdmin
    .from('products')
    .select('id, ebay_item_id, image_url, ebay_image_url, r2_image_url')
    .is('r2_image_url', null)
    .not('image_url', 'is', null)
    .limit(limit);

  if (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }

  let updated = 0;
  let failed = 0;

  for (const product of products ?? []) {
    try {
      const sourceImage = product.ebay_image_url || product.image_url;

      if (!sourceImage) {
        failed++;
        continue;
      }

      const ebayItemId = String(product.ebay_item_id || product.id);

      const r2Url = await uploadToR2({
        imageUrl: sourceImage,
        ebayItemId,
      });

      await supabaseAdmin
        .from('products')
        .update({
          r2_image_url: r2Url,
          image_status: 'synced',
          images_synced_at: new Date().toISOString(),
          images_sync_error: null,
        })
        .eq('id', product.id);

      updated++;
    } catch (err) {
  console.error(err);

  failed++;

  await supabaseAdmin
    .from('products')
    .update({
      image_status: 'failed',
      images_sync_error:
        err instanceof Error ? err.message : String(err),
    })
    .eq('id', product.id);
}
  }

  return NextResponse.json({
    success: true,
    processed: products?.length ?? 0,
    updated,
    failed,
  });
}
