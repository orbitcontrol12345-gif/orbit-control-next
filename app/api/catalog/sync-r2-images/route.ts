import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import {
  downloadImageToBuffer,
  makeR2ProductImageKey,
  uploadBufferToR2,
} from '@/lib/image-uploader';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getPublicR2Url(key: string) {
  const publicBaseUrl = process.env.R2_PUBLIC_URL;

  if (!publicBaseUrl) {
    return key;
  }

  return `${publicBaseUrl.replace(/\/$/, '')}/${key}`;
}

export async function GET() {
  try {
    const { data: products, error } = await supabaseAdmin
  .from('products')
  .select('id, ebay_item_id, ebay_gallery_urls, r2_gallery_urls, image_status')
  .not('ebay_item_id', 'is', null)
  .not('ebay_gallery_urls', 'is', null)
  .not('image_status', 'eq', 'r2_failed')
  .or('r2_gallery_urls.is.null,r2_gallery_urls.eq.[]')
  .limit(5);

    if (error) throw error;

    let updated = 0;
    let failed = 0;
    const results: any[] = [];

    for (const product of products ?? []) {
      try {
        const ebayItemId = String(product.ebay_item_id);
        const gallery = Array.isArray(product.ebay_gallery_urls)
          ? product.ebay_gallery_urls.slice(0, 10)
          : [];

        if (gallery.length === 0) {
          throw new Error('No eBay gallery images found');
        }

        const r2Urls: string[] = [];

        for (let i = 0; i < gallery.length; i++) {
          const imageUrl = gallery[i];

          const downloaded = await downloadImageToBuffer(imageUrl);

          const key = makeR2ProductImageKey({
            ebayItemId,
            index: i,
            ext: 'jpg',
          });

          await uploadBufferToR2({
            key,
            buffer: downloaded.buffer,
            contentType: downloaded.contentType,
          });

          r2Urls.push(getPublicR2Url(key));
        }

        await supabaseAdmin
          .from('products')
          .update({
            r2_image_url: r2Urls[0] ?? null,
            r2_gallery_urls: r2Urls,
            image_status: 'r2_synced',
            image_count: r2Urls.length,
            images_synced_at: new Date().toISOString(),
            images_sync_error: null,
          })
          .eq('id', product.id);

        updated++;

        results.push({
          id: product.id,
          ebay_item_id: ebayItemId,
          image_count: r2Urls.length,
        });
      } catch (err) {
        failed++;

        await supabaseAdmin
          .from('products')
          .update({
            image_status: 'r2_failed',
            images_sync_error: String(err),
          })
          .eq('id', product.id);

        results.push({
          id: product.id,
          ebay_item_id: product.ebay_item_id,
          error: String(err),
        });
      }
    }

    return NextResponse.json({
      success: true,
      processed: products?.length ?? 0,
      updated,
      failed,
      results,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: String(error),
      },
      { status: 500 }
    );
  }
}
