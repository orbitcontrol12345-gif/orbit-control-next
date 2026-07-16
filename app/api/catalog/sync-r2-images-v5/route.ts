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
export const maxDuration = 300;

const ROUTE_VERSION = 'R2-GALLERY-V5-CURSOR-SAFE';
const JOB_KEY = 'sync-r2-images-v5';

const LIMIT = 25;
const MAX_IMAGES = 10;
const MARKETPLACE = 'EBAY_US';
const SELLER = 'orbitcontrol';

const DONE_STATUS = 'r2_gallery_hd_synced';
const PENDING_STATUS = 'pending';
const FAILED_STATUS = 'r2_gallery_failed';

type ProductRow = {
  id: number;
  ebay_item_id: string | null;
  image_url: string | null;
  ebay_image_url: string | null;
  ebay_gallery_urls: string[] | null;
  r2_image_url: string | null;
  r2_gallery_urls: string[] | null;
  image_status: string | null;
  image_count: number | null;
};

function getPublicR2Url(key: string): string {
  const publicBaseUrl = process.env.R2_PUBLIC_URL;
  if (!publicBaseUrl) throw new Error('Missing R2_PUBLIC_URL');
  return `${publicBaseUrl.replace(/\/$/, '')}/${key}`;
}

function getHighResolutionEbayImageUrl(value: unknown): string {
  const imageUrl = String(value || '').trim();
  if (!imageUrl) return '';

  try {
    const url = new URL(imageUrl);

    if (url.hostname !== 'i.ebayimg.com') {
      return imageUrl;
    }

    url.pathname = url.pathname.replace(
      /\/s-l\d+\.(jpg|jpeg|png|webp)$/i,
      '/s-l1600.$1'
    );

    return url.toString();
  } catch {
    return imageUrl;
  }
}

function uniqueImageUrls(values: unknown[]): string[] {
  return Array.from(
    new Set(
      values
        .map(getHighResolutionEbayImageUrl)
        .filter(
          (url) =>
            url.length > 0 &&
            /^https?:\/\//i.test(url)
        )
    )
  ).slice(0, MAX_IMAGES);
}

function getStoredGallery(product: ProductRow): string[] {
  const storedEbayGallery = Array.isArray(
    product.ebay_gallery_urls
  )
    ? product.ebay_gallery_urls
    : [];

  return uniqueImageUrls([
    ...storedEbayGallery,
    product.ebay_image_url,
    product.image_url,
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

  const searchData = await searchResponse
    .json()
    .catch(() => null);

  if (!searchResponse.ok) {
    throw new Error(
      `EBAY_SEARCH_${searchResponse.status}: ${JSON.stringify(
        searchData || {}
      ).slice(0, 500)}`
    );
  }

  const summaries = Array.isArray(
    searchData?.itemSummaries
  )
    ? searchData.itemSummaries
    : [];

  const itemSummary =
    summaries.find((item: any) => {
      const legacyItemId = String(
        item?.legacyItemId || ''
      ).trim();

      const browseItemId = String(
        item?.itemId || ''
      ).trim();

      const itemIdFromComposite =
        browseItemId.split('|')?.[1] || '';

      return (
        legacyItemId === ebayItemId ||
        itemIdFromComposite === ebayItemId
      );
    }) ||
    summaries[0] ||
    null;

  if (!itemSummary) return null;

  const browseItemId = String(
    itemSummary.itemId || ''
  ).trim();

  if (!browseItemId) return itemSummary;

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

  if (!detailResponse.ok) return itemSummary;

  const itemDetails = await detailResponse
    .json()
    .catch(() => null);

  return itemDetails || itemSummary;
}

function getEbayGallery(item: any): string[] {
  const additionalImages = Array.isArray(
    item?.additionalImages
  )
    ? item.additionalImages.map(
        (image: any) => image?.imageUrl
      )
    : [];

  return uniqueImageUrls([
    item?.image?.imageUrl,
    ...additionalImages,
  ]);
}

async function ensureJobRow() {
  const { data, error } = await supabaseAdmin
    .from('catalog_jobs')
    .select('job_key, cursor_offset')
    .eq('job_key', JOB_KEY)
    .maybeSingle();

  if (error) throw error;
  if (data) return data;

  const { data: inserted, error: insertError } =
    await supabaseAdmin
      .from('catalog_jobs')
      .insert({
        job_key: JOB_KEY,
        cursor_offset: 0,
        last_processed: 0,
        last_updated: 0,
        last_unresolved: 0,
        last_failed: 0,
        last_rate_limited: false,
        updated_at: new Date().toISOString(),
      })
      .select('job_key, cursor_offset')
      .single();

  if (insertError) throw insertError;
  return inserted;
}

export async function GET() {
  try {
    const job = await ensureJobRow();

    const currentCursor = Math.max(
      0,
      Number(job?.cursor_offset || 0)
    );

    const token = await getEbayToken();
    const accessToken = String(
      token?.access_token || ''
    ).trim();

    if (!accessToken) {
      throw new Error('Missing eBay access token');
    }

    const { data: products, error } =
      await supabaseAdmin
        .from('products')
        .select(`
          id,
          ebay_item_id,
          image_url,
          ebay_image_url,
          ebay_gallery_urls,
          r2_image_url,
          r2_gallery_urls,
          image_status,
          image_count
        `)
        .eq('marketplace', MARKETPLACE)
        .not('ebay_item_id', 'is', null)
        .gt('id', currentCursor)
        .or(
          `image_status.is.null,image_status.eq.${PENDING_STATUS}`
        )
        .order('id', { ascending: true })
        .limit(LIMIT);

    if (error) throw error;

    const rows = (products ?? []) as ProductRow[];

    if (rows.length === 0) {
      const { error: resetError } = await supabaseAdmin
        .from('catalog_jobs')
        .update({
          cursor_offset: 0,
          last_processed: 0,
          last_updated: 0,
          last_unresolved: 0,
          last_failed: 0,
          last_rate_limited: false,
          updated_at: new Date().toISOString(),
        })
        .eq('job_key', JOB_KEY);

      if (resetError) throw resetError;

      return NextResponse.json({
        success: true,
        routeVersion: ROUTE_VERSION,
        job: JOB_KEY,
        status: 'CYCLE_COMPLETE_CURSOR_RESET',
        currentCursor,
        nextCursor: 0,
        processed: 0,
        updated: 0,
        failed: 0,
        rateLimited: false,
      });
    }

    let updated = 0;
    let failed = 0;
    let rateLimited = false;
    let lastCompletedId = currentCursor;

    const results: Array<Record<string, unknown>> = [];

    for (const product of rows) {
      const ebayItemId = String(
        product.ebay_item_id || ''
      ).trim();

      try {
        if (!ebayItemId) {
          throw new Error('Missing ebay_item_id');
        }

        const storedGallery = getStoredGallery(product);

        let ebayGallery: string[] = [];
        let source = 'stored_gallery';

        if (storedGallery.length <= 1) {
          const item = await fetchEbayItemDetails(
            ebayItemId,
            accessToken
          );

          ebayGallery = item
            ? getEbayGallery(item)
            : [];

          source =
            ebayGallery.length > 0
              ? 'ebay_item_details'
              : 'stored_gallery_fallback';
        }

        const gallery =
          ebayGallery.length > 0
            ? ebayGallery
            : storedGallery;

        if (gallery.length === 0) {
          throw new Error('No product images found');
        }

        const r2Urls: string[] = [];

        for (
          let index = 0;
          index < gallery.length;
          index++
        ) {
          const imageUrl = gallery[index];

          try {
            const downloaded =
              await downloadImageToBuffer(imageUrl);

            const key = makeR2ProductImageKey({
              ebayItemId,
              index,
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
              `R2 IMAGE FAILED ${ebayItemId} IMAGE ${index}:`,
              imageError
            );
          }
        }

        if (r2Urls.length === 0) {
          throw new Error(
            'All product images failed to upload'
          );
        }

        const { error: updateError } =
          await supabaseAdmin
            .from('products')
            .update({
              image_url: r2Urls[0],
              r2_image_url: r2Urls[0],
              ebay_gallery_urls: gallery,
              r2_gallery_urls: r2Urls,
              image_status: DONE_STATUS,
              image_count: r2Urls.length,
              images_synced_at:
                new Date().toISOString(),
              images_sync_error: null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', product.id);

        if (updateError) throw updateError;

        updated++;
        lastCompletedId = product.id;

        results.push({
          id: product.id,
          ebay_item_id: ebayItemId,
          status: DONE_STATUS,
          source,
          ebay_image_count: gallery.length,
          image_count: r2Urls.length,
          image_url: r2Urls[0],
        });
      } catch (err) {
        const errorMessage =
          err instanceof Error
            ? err.message
            : String(err);

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
        lastCompletedId = product.id;

        await supabaseAdmin
          .from('products')
          .update({
            image_status: FAILED_STATUS,
            images_sync_error: errorMessage,
            updated_at: new Date().toISOString(),
          })
          .eq('id', product.id);

        results.push({
          id: product.id,
          ebay_item_id: ebayItemId,
          status: FAILED_STATUS,
          error: errorMessage,
        });
      }
    }

    const nextCursor = rateLimited
      ? lastCompletedId
      : Math.max(
          lastCompletedId,
          rows[rows.length - 1]?.id ||
            currentCursor
        );

    const { error: jobUpdateError } =
      await supabaseAdmin
        .from('catalog_jobs')
        .update({
          cursor_offset: nextCursor,
          last_processed: results.length,
          last_updated: updated,
          last_unresolved: 0,
          last_failed: failed,
          last_rate_limited: rateLimited,
          updated_at: new Date().toISOString(),
        })
        .eq('job_key', JOB_KEY);

    if (jobUpdateError) throw jobUpdateError;

    const [
      syncedCountResult,
      pendingCountResult,
      failedCountResult,
    ] = await Promise.all([
      supabaseAdmin
        .from('products')
        .select('*', {
          count: 'exact',
          head: true,
        })
        .eq('marketplace', MARKETPLACE)
        .eq('image_status', DONE_STATUS),

      supabaseAdmin
        .from('products')
        .select('*', {
          count: 'exact',
          head: true,
        })
        .eq('marketplace', MARKETPLACE)
        .not('ebay_item_id', 'is', null)
        .or(
          `image_status.is.null,image_status.eq.${PENDING_STATUS}`
        ),

      supabaseAdmin
        .from('products')
        .select('*', {
          count: 'exact',
          head: true,
        })
        .eq('marketplace', MARKETPLACE)
        .eq('image_status', FAILED_STATUS),
    ]);

    if (syncedCountResult.error) {
      throw syncedCountResult.error;
    }

    if (pendingCountResult.error) {
      throw pendingCountResult.error;
    }

    if (failedCountResult.error) {
      throw failedCountResult.error;
    }

    return NextResponse.json({
      success: true,
      routeVersion: ROUTE_VERSION,
      job: JOB_KEY,
      status: rateLimited
        ? 'RATE_LIMITED_CURSOR_HELD'
        : 'BATCH_COMPLETE',
      currentCursor,
      nextCursor,
      processed: results.length,
      updated,
      failed,
      rateLimited,
      gallerySyncedProducts:
        syncedCountResult.count ?? 0,
      pendingProducts:
        pendingCountResult.count ?? 0,
      failedProducts:
        failedCountResult.count ?? 0,
      results,
    });
  } catch (error) {
    console.error(
      'SYNC R2 GALLERY V5 ERROR:',
      error
    );

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
