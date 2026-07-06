import { NextRequest, NextResponse } from 'next/server';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { r2 } from '@/lib/r2';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function publicUrl(key: string) {
  return `${process.env.R2_PUBLIC_URL}/${key}`;
}

async function uploadImageToR2({
  imageUrl,
  ebayItemId,
}: {
  imageUrl: string;
  ebayItemId: string;
}) {
  const response = await fetch(imageUrl);

  if (!response.ok) {
    throw new Error(`Image download failed ${response.status}`);
  }

  const contentType = response.headers.get('content-type') || 'image/jpeg';
  const ext = contentType.includes('png') ? 'png' : 'jpg';
  const buffer = Buffer.from(await response.arrayBuffer());

  const key = `orbit-control/products/${ebayItemId}/main.${ext}`;

  await r2.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  );

  return publicUrl(key);
}

export async function GET(req: NextRequest) {
  const limit = Number(req.nextUrl.searchParams.get('limit') ?? 50);

  const { data: products, error } = await supabaseAdmin
    .from('products')
    .select('id, ebay_item_id, image_url, ebay_image_url, r2_image_url')
    .is('r2_image_url', null)
    .not('image_url', 'is', null)
    .limit(limit);

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  let updated = 0;
  let failed = 0;

  for (const product of products ?? []) {
    try {
      const sourceImage = product.ebay_image_url || product.image_url;
      const ebayItemId = String(product.ebay_item_id || product.id);

      if (!sourceImage) continue;

      const r2Url = await uploadImageToR2({
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
      failed++;

      await supabaseAdmin
        .from('products')
        .update({
          image_status: 'failed',
          images_sync_error: String(err),
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
