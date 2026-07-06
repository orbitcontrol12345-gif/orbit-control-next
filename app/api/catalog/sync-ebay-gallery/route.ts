import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EBAY_SEARCH_API_URL =
  'https://api.ebay.com/buy/browse/v1/item_summary/search';

async function getEbayAccessToken() {
  const clientId = process.env.EBAY_CLIENT_ID;
  const clientSecret = process.env.EBAY_CLIENT_SECRET;
  const refreshToken = process.env.EBAY_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Missing eBay credentials');
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const res = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      scope: 'https://api.ebay.com/oauth/api_scope',
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(`eBay token failed: ${JSON.stringify(data)}`);
  }

  return data.access_token as string;
}

function cleanImageUrls(urls: string[]) {
  return Array.from(
    new Set(
      urls
        .filter(Boolean)
        .map((url) => url.trim())
        .filter((url) => url.startsWith('http'))
    )
  ).slice(0, 10);
}

export async function GET() {
  try {
    const token = await getEbayAccessToken();

    const { data: products, error } = await supabaseAdmin
  .from('products')
  .select('id, ebay_item_id, image_url, ebay_gallery_urls, image_status')
  .not('ebay_item_id', 'is', null)
  .not('image_status', 'eq', 'gallery_failed')
  .or('ebay_gallery_urls.is.null,ebay_gallery_urls.eq.[]')
  .limit(10);

    if (error) throw error;

    let updated = 0;
    let failed = 0;
    const results: any[] = [];

    for (const product of products ?? []) {
      try {
        const ebayItemId = String(product.ebay_item_id);

        const searchUrl = new URL(EBAY_SEARCH_API_URL);
        searchUrl.searchParams.set('q', ebayItemId);
        searchUrl.searchParams.set('limit', '1');

        const ebayRes = await fetch(searchUrl.toString(), {
          headers: {
            Authorization: `Bearer ${token}`,
            'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
          },
        });

        const ebayData = await ebayRes.json();

        if (!ebayRes.ok) {
          throw new Error(JSON.stringify(ebayData));
        }

        const item = ebayData?.itemSummaries?.[0];

        if (!item) {
          throw new Error('No eBay item found from search');
        }

        const mainImage = item?.image?.imageUrl || product.image_url || null;

        const thumbnailImages =
          item?.thumbnailImages?.map((img: any) => img.imageUrl) ?? [];

        const additionalImages =
          item?.additionalImages?.map((img: any) => img.imageUrl) ?? [];

        const gallery = cleanImageUrls([
          mainImage,
          ...thumbnailImages,
          ...additionalImages,
        ]);

        await supabaseAdmin
          .from('products')
          .update({
            ebay_image_url: mainImage,
            ebay_gallery_urls: gallery,
            image_count: gallery.length,
            image_status: 'gallery_synced',
          })
          .eq('id', product.id);

        updated++;

        results.push({
          id: product.id,
          ebay_item_id: ebayItemId,
          ebay_rest_item_id: item.itemId,
          image_count: gallery.length,
        });
      } catch (err) {
        failed++;

        await supabaseAdmin
          .from('products')
          .update({
            image_status: 'gallery_failed',
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
