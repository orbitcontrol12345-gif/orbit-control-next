import { NextResponse } from 'next/server';
import { getEbayToken } from '@/lib/ebay';
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
const MARKETPLACE = 'EBAY_US';
const SELLER = 'orbitcontrol';
const ROUTE_VERSION = 'R2-GALLERY-V3-FULL-DETAILS';
const DONE_STATUS = 'r2_gallery_synced';

function getPublicR2Url(key: string) {
  const publicBaseUrl = process.env.R2_PUBLIC_URL;

  if (!publicBaseUrl) {
    throw new Error('Missing R2_PUBLIC_URL');
  }

  return `${publicBaseUrl.replace(/\/$/, '')}/${key}`;
}

function normalizeImageUrl(value: unknown): string {
  return String(value || '').trim();
}

function uniqueImageUrls(values: unknown[]): string[] {
  return Array.from(
    new Set(
      values
        .map(normalizeImageUrl)
        .filter(
          (url) =>
            url.length > 0 &&
            /^https?:\/\//i.test(url)
        )
    )
  ).slice(0, MAX_IMAGES);
}

function getStoredGallery(product: any): string[] {
  const ebayGallery = Array.isArray(product.ebay_gallery_urls)
    ? product.ebay_gallery_urls
    : [];

  return uniqueImageUrls([
    product.image_url,
    ...ebayGallery,
  ]);
}

async function fetchEbayItemDetails(
  ebayItemId: string,
  accessToken: string
): Promise<any | null> {
  const params = new URLSearchParams({
    q: ebayItemId,
    limit: '10',
    filter: `sellers:{${SELLER}}`,
  });

  const searchResponse = await fetch(
    `https://api.ebay.com/buy/browse/v1/item_summary/search?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'X-EBAY-C-MARKETPLACE-ID': MARKETPLACE,
        'Accept-Language': 'en-US',
      },
      cache: 'no-store',
    }
  );

  if (searchResponse.status === 429) {
    throw new Error('EBAY_RATE_LIMIT_429');
  }

  const searchData = await searchResponse.json().catch(() => null);

  if (!searchResponse.ok) {
    throw new Error(
      `EBAY_SEARCH_${searchResponse.status}: ${JSON.stringify(
        searchData || {}
      ).slice(0, 500)}`
    );
  }

  const summaries = Array.isArray(searchData?.itemSummaries)
    ? searchData.itemSummaries
    : [];

  const itemSummary =
    summaries.find((item: any) => {
      const legacyItemId = String(item?.legacyItemId || '').trim();
      const browseItemId = String(item?.itemId || '').trim();
      const itemIdFromComposite = browseItemId.split('|')?.[1] || '';

      return (
        legacyItemId === ebayItemId ||
        itemIdFromComposite === ebayItemId
      );
    }) ||
    summaries[0] ||
    null;

  if (!itemSummary) {
    return null;
  }

  const browseItemId = String(itemSummary.itemId || '').trim();

  if (!browseItemId) {
    return itemSummary;
  }

  const detailResponse = await fetch(
    `https://api.ebay.com/buy/browse/v1/item/${encodeURIComponent(
      browseItemId
    )}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'X-EBAY-C-MARKETPLACE-ID': MARKETPLACE,
        'Accept-Language': 'en-US',
      },
      cache: 'no-store',
    }
  );

  if (detailResponse.status === 429) {
    throw new Error('EBAY_RATE_LIMIT_429');
  }

  if (!detailResponse.ok) {
    return itemSummary;
  }

  const itemDetails = await detailResponse.json().catch(() => null);

  return itemDetails || itemSummary;
}

function getEbayGallery(item: any): string[] {
  const additionalImages = Array.isArray(item?.additionalImages)
    ? item.additionalImages.map((image: any) => image?.imageUrl)
    : [];

  return uniqueImageUrls([
    item?.image?.imageUrl,
    ...additionalImages,
  ]);
}

export async function GET() {
  try {
    const token = await getEbayToken();
    const accessToken = String(token?.access_token || '').trim();

    if (!accessToken) {
      throw new Error('Missing eBay access token');
    }

    const { data: products, error } = await supabaseAdmin
      .from('products')
      .select(`
        id,
        ebay_item_id,
        image_url,
        ebay_gallery_urls,
        r2_image_url,
        r2_gallery_urls,
        image_status,
        image_count
      `)
      .eq('marketplace', MARKETPLACE)
      .not('ebay_item_id', 'is', null)
      .or(`image_status.is.null,image_status.neq.${DONE_STATUS}`)
      .order('id', { ascending: true })
      .limit(LIMIT);

    if (error) {
      throw error;
    }

    let updated = 0;
    let failed = 0;
    let rateLimited = false;

    const results: Array<Record<string, unknown>> = [];

    for (const product of products ?? []) {
      const ebayItemId = String(product.ebay_item_id || '').trim();

      try {
        if (!ebayItemId) {
          throw new Error('Missing ebay_item_id');
        }

        const item = await fetchEbayItemDetails(
          ebayItemId,
          accessToken
        );

        const ebayGallery = item
          ? getEbayGallery(item)
          : [];

        const storedGallery = getStoredGallery(product);

        const gallery =
          ebayGallery.length > 0
            ? ebayGallery
            : storedGallery;

        if (gallery.length === 0) {
          throw new Error('No product images found');
        }

        const r2Urls: string[] = [];

        for (let i = 0; i < gallery.length; i++) {
          const imageUrl = gallery[i];

          try {
            const downloaded =
              await downloadImageToBuffer(imageUrl);

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
            ebay_gallery_urls: gallery,
            r2_gallery_urls: r2Urls,
            image_status: DONE_STATUS,
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
          status: DONE_STATUS,
          source:
            ebayGallery.length > 0
              ? 'ebay_item_details'
              : 'stored_gallery_fallback',
          ebay_image_count: gallery.length,
          image_count: r2Urls.length,
          image_url: r2Urls[0],
        });
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : String(err);

        if (errorMessage === 'EBAY_RATE_LIMIT_429') {
          rateLimited = true;

          results.push({
            id: product.id,
            ebay_item_id: ebayItemId,
            status: 'rate_limited',
          });

          break;
        }

        failed++;

        await supabaseAdmin
          .from('products')
          .update({
            image_status: 'r2_gallery_failed',
            images_sync_error: errorMessage,
          })
          .eq('id', product.id);

        results.push({
          id: product.id,
          ebay_item_id: ebayItemId,
          status: 'r2_gallery_failed',
          error: errorMessage,
        });
      }
    }

    const { count: gallerySyncedCount } = await supabaseAdmin
      .from('products')
      .select('*', {
        count: 'exact',
        head: true,
      })
      .eq('marketplace', MARKETPLACE)
      .eq('image_status', DONE_STATUS);

    const { count: remainingCount } = await supabaseAdmin
      .from('products')
      .select('*', {
        count: 'exact',
        head: true,
      })
      .eq('marketplace', MARKETPLACE)
      .not('ebay_item_id', 'is', null)
      .or(`image_status.is.null,image_status.neq.${DONE_STATUS}`);

    return NextResponse.json({
      success: true,
      routeVersion: ROUTE_VERSION,
      processed: results.length,
      updated,
      failed,
      rateLimited,
      gallerySyncedProducts:
        gallerySyncedCount ?? 0,
      remainingProducts: remainingCount ?? 0,
      totalProducts:
        (gallerySyncedCount ?? 0) +
        (remainingCount ?? 0),
      results,
    });
  } catch (error) {
    console.error('SYNC R2 GALLERY ERROR:', error);

    return NextResponse.json(
      {
        success: false,
        routeVersion: ROUTE_VERSION,
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}
