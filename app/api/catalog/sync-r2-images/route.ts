import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import {
  downloadImageToBuffer,
  makeR2ProductImageKey,
  uploadBufferToR2,
} from '@/lib/image-uploader';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LIMIT = 25;
const MAX_IMAGES = 10;

function getPublicR2Url(key: string) {
  const publicBaseUrl = process.env.R2_PUBLIC_URL;

  if (!publicBaseUrl) {
    throw new Error('Missing R2_PUBLIC_URL');
  }

  return `${publicBaseUrl.replace(/\/$/, '')}/${key}`;
}

function getProductGallery(product: any): string[] {
  const gallery: string[] = Array.isArray(product.ebay_gallery_urls)
    ? product.ebay_gallery_urls
        .map((url: unknown): string => String(url || '').trim())
        .filter((url: string): boolean => url.length > 0)
    : [];

  const mainImage: string = String(product.image_url || '').trim();

  const images: string[] =
    gallery.length > 0
      ? gallery
      : mainImage
        ? [mainImage]
        : [];

  return Array.from(new Set<string>(images)).slice(0, MAX_IMAGES);
}

export async function GET() {
  try {
    const { data: products, error } = await supabaseAdmin
      .from('products')
      .select(`
        id,
        ebay_item_id,
        image_url,
        ebay_gallery_urls,
        r2_image_url,
        r2_gallery_urls,
        image_status
      `)
      .eq('marketplace', 'EBAY_US')
      .not('ebay_item_id', 'is', null)
      .or('r2_gallery_urls.is.null,r2_gallery_urls.eq.[]')
      .limit(LIMIT);

    if (error) {
      throw error;
    }

    let updated = 0;
    let failed = 0;

    const results: Array<Record<string, unknown>> = [];

    for (const product of products ?? []) {
      try {
        const ebayItemId = String(product.ebay_item_id || '').trim();

        if (!ebayItemId) {
          throw new Error('Missing ebay_item_id');
        }

        const gallery = getProductGallery(product);

        if (gallery.length === 0) {
          throw new Error('No product images found');
        }

        const r2Urls: string[] = [];

        for (let i = 0; i < gallery.length; i++) {
          const imageUrl = gallery[i];

          try {
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
          } catch (imageError) {
            console.error(
              `R2 IMAGE FAILED ${ebayItemId} IMAGE ${i}:`,
              imageError
            );
          }
        }

        if (r2Urls.length === 0) {
          throw new Error('All product images failed to upload');
        }

        const { error: updateError } = await supabaseAdmin
          .from('products')
          .update({
            image_url: r2Urls[0],
            r2_image_url: r2Urls[0],
            r2_gallery_urls: r2Urls,
            image_status: 'r2_synced',
            image_count: r2Urls.length,
            images_synced_at: new Date().toISOString(),
            images_sync_error: null,
          })
          .eq('id', product.id);

        if (updateError) {
          throw updateError;
        }

        updated++;

        results.push({
          id: product.id,
          ebay_item_id: ebayItemId,
          status: 'r2_synced',
          image_count: r2Urls.length,
          image_url: r2Urls[0],
        });
      } catch (err) {
        failed++;

        const errorMessage =
          err instanceof Error ? err.message : String(err);

        await supabaseAdmin
          .from('products')
          .update({
            image_status: 'r2_failed',
            images_sync_error: errorMessage,
          })
          .eq('id', product.id);

        results.push({
          id: product.id,
          ebay_item_id: product.ebay_item_id,
          status: 'r2_failed',
          error: errorMessage,
        });
      }
    }

    const { count: uploadedCount } = await supabaseAdmin
      .from('products')
      .select('*', {
        count: 'exact',
        head: true,
      })
      .eq('marketplace', 'EBAY_US')
      .not('r2_gallery_urls', 'is', null)
      .neq('r2_gallery_urls', '[]');

    const { count: remainingCount } = await supabaseAdmin
      .from('products')
      .select('*', {
        count: 'exact',
        head: true,
      })
      .eq('marketplace', 'EBAY_US')
      .not('ebay_item_id', 'is', null)
      .or('r2_gallery_urls.is.null,r2_gallery_urls.eq.[]');

    return NextResponse.json({
      success: true,
      processed: products?.length ?? 0,
      updated,
      failed,
      uploadedProducts: uploadedCount ?? 0,
      remainingProducts: remainingCount ?? 0,
      totalProducts:
        (uploadedCount ?? 0) + (remainingCount ?? 0),
      results,
    });
  } catch (error) {
    console.error('SYNC R2 IMAGES ERROR:', error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}
