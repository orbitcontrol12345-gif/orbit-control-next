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

const ROUTE_VERSION = 'REPAIR-OLD-IMAGES';
const JOB_KEY = 'repair-old-images';

const LIMIT = 30;
const MAX_IMAGES = 10;
const MARKETPLACE = 'EBAY_US';

const DONE_STATUS = 'r2_gallery_hd_synced';
const FAILED_STATUS = 'r2_gallery_failed';

const UPGRADE_STATUSES = [
  'pending',
  'synced',
  'r2_synced',
  'gallery_synced',
];

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

  if (!publicBaseUrl) {
    throw new Error('Missing R2_PUBLIC_URL');
  }

  return `${publicBaseUrl.replace(/\/$/, '')}/${key}`;
}

function getHighResolutionEbayImageUrl(
  value: unknown
): string {
  const imageUrl = String(value || '').trim();

  if (!imageUrl) {
    return '';
  }

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

function decodeXml(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

async function fetchEbayGalleryFromTrading(
  ebayItemId: string,
  accessToken: string
): Promise<string[]> {
  const requestXml = `<?xml version="1.0" encoding="utf-8"?>
<GetItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <ItemID>${ebayItemId}</ItemID>
  <DetailLevel>ReturnAll</DetailLevel>
</GetItemRequest>`;

  const response = await fetch(
    'https://api.ebay.com/ws/api.dll',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml',
        'X-EBAY-API-CALL-NAME': 'GetItem',
        'X-EBAY-API-SITEID': '0',
        'X-EBAY-API-COMPATIBILITY-LEVEL': '1423',
        'X-EBAY-API-IAF-TOKEN': accessToken,
      },
      body: requestXml,
      cache: 'no-store',
    }
  );

  const responseText = await response.text();

  if (response.status === 429) {
    throw new Error('EBAY_RATE_LIMIT_429');
  }

  if (!response.ok) {
    throw new Error(
      `EBAY_TRADING_HTTP_${response.status}: ${responseText.slice(
        0,
        500
      )}`
    );
  }

  const acknowledgement =
    responseText.match(
      /<(?:\w+:)?Ack>([\s\S]*?)<\/(?:\w+:)?Ack>/i
    )?.[1]?.trim() || '';

  if (
    acknowledgement &&
    acknowledgement !== 'Success' &&
    acknowledgement !== 'Warning'
  ) {
    const errorMessage =
      responseText.match(
        /<(?:\w+:)?LongMessage>([\s\S]*?)<\/(?:\w+:)?LongMessage>/i
      )?.[1] ||
      responseText.match(
        /<(?:\w+:)?ShortMessage>([\s\S]*?)<\/(?:\w+:)?ShortMessage>/i
      )?.[1] ||
      'Unknown eBay Trading API error';

    throw new Error(
      `EBAY_TRADING_ERROR: ${decodeXml(
        errorMessage.trim()
      )}`
    );
  }

  const pictureUrls = Array.from(
    responseText.matchAll(
      /<(?:\w+:)?PictureURL>([\s\S]*?)<\/(?:\w+:)?PictureURL>/gi
    )
  ).map((match) => decodeXml(match[1].trim()));

  return uniqueImageUrls(pictureUrls);
}

async function ensureJobRow() {
  const { data, error } = await supabaseAdmin
    .from('catalog_jobs')
    .select('job_key, cursor_offset')
    .eq('job_key', JOB_KEY)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (data) {
    return data;
  }

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

  if (insertError) {
    throw insertError;
  }

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
        .eq('image_count', 1)
        .gt('id', currentCursor)
        .order('id', { ascending: true })
        .limit(LIMIT);

    if (error) {
      throw error;
    }

    const rows = (products ?? []) as ProductRow[];

    if (rows.length === 0) {
      return NextResponse.json({
        success: true,
        routeVersion: ROUTE_VERSION,
        job: JOB_KEY,
        status: 'REPLACE_ALL_COMPLETE',
        currentCursor,
        nextCursor: currentCursor,
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
    const cacheVersion = Date.now();

    for (const product of rows) {
      const ebayItemId = String(
        product.ebay_item_id || ''
      ).trim();

      try {
        if (!ebayItemId) {
          throw new Error('Missing ebay_item_id');
        }

        let ebayGallery: string[] = [];
        let source = 'ebay_trading_get_item';
        let ebayFetchError: string | null = null;

        try {
          ebayGallery =
            await fetchEbayGalleryFromTrading(
              ebayItemId,
              accessToken
            );
        } catch (ebayError) {
          const message =
            ebayError instanceof Error
              ? ebayError.message
              : String(ebayError);

          if (message === 'EBAY_RATE_LIMIT_429') {
            throw ebayError;
          }

          ebayFetchError = message;
          console.error(
            `EBAY TRADING IMAGE FETCH FAILED ${ebayItemId}:`,
            ebayError
          );
        }

        if (ebayFetchError) {
          throw new Error(
            `EBAY_GALLERY_FETCH_FAILED: ${ebayFetchError}`
          );
        }

        if (ebayGallery.length < 2) {
          throw new Error(
            `EBAY_GALLERY_INCOMPLETE: eBay returned ${ebayGallery.length} image(s)`
          );
        }

        const gallery = ebayGallery;

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

            // The same R2 key is overwritten, and the version query prevents
            // browsers/CDNs from showing the previously cached low-resolution file.
            r2Urls.push(`${getPublicR2Url(key)}?v=${cacheVersion}`);
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

        if (updateError) {
          throw updateError;
        }

        updated++;
        lastCompletedId = product.id;

        results.push({
          id: product.id,
          ebay_item_id: ebayItemId,
          previous_status: product.image_status,
          status: DONE_STATUS,
          source,
          ebay_image_count: gallery.length,
          image_count: r2Urls.length,
          image_url: r2Urls[0],
          ebay_fetch_error: ebayFetchError,
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
            previous_status: product.image_status,
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
          previous_status: product.image_status,
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

    if (jobUpdateError) {
      throw jobUpdateError;
    }

    const [
      doneCountResult,
      upgradeCountResult,
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
        .eq('image_count', 1)
        .gt('id', nextCursor),

      supabaseAdmin
        .from('products')
        .select('*', {
          count: 'exact',
          head: true,
        })
        .eq('marketplace', MARKETPLACE)
        .eq('image_status', FAILED_STATUS),
    ]);

    if (doneCountResult.error) {
      throw doneCountResult.error;
    }

    if (upgradeCountResult.error) {
      throw upgradeCountResult.error;
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

      hdSyncedProducts:
        doneCountResult.count ?? 0,
      remainingUpgradeProducts:
        upgradeCountResult.count ?? 0,
      failedProducts:
        failedCountResult.count ?? 0,

      results,
    });
  } catch (error) {
    console.error(
      'SYNC R2 GALLERY V6 UPGRADE ERROR:',
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
