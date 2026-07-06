import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EBAY_ITEM_API_URL = 'https://api.ebay.com/buy/browse/v1/item';

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

function toEbayRestItemId(ebayItemId: string) {
  if (ebayItemId.includes('|')) return ebayItemId;
  return `v1|${ebayItemId}|0`;
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
      .not('image_status', 'eq', 'gallery_synced')
      .limit(10);

    if (error) throw error;

    let updated = 0;
    let failed = 0;
    const results: any[] = [];

    for (const product of products ?? []) {
      try {
        const legacyItemId = String(product.ebay_item_id);
        const restItemId = toEbayRestItemId(legacyItemId);

        const ebayRes = await fetch(
          `${EBAY_ITEM_API_URL}/${encodeURIComponent(restItemId)}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
            },
          }
        );

        const ebayData = await ebayRes.json();

        if (!ebayRes.ok) {
          throw new Error(JSON.stringify(ebayData));
        }

        const mainImage = ebayData?.image?.imageUrl || product.image_url || null;

        const additionalImages =
          ebayData?.additionalImages?.map((img: any) => img.imageUrl) ?? [];

        const gallery = cleanImageUrls([mainImage, ...additionalImages]);

        if (gallery.length === 0) {
          throw new Error('No images found from eBay item API');
        }

        await supabaseAdmin
          .from('products')
          .update({
            ebay_image_url: mainImage,
            ebay_gallery_urls: gallery,
            image_count: gallery.length,
            image_status: 'gallery_synced',
            images_sync_error: null,
          })
          .eq('id', product.id);

        updated++;

        results.push({
          id: product.id,
          ebay_item_id: legacyItemId,
          ebay_rest_item_id: restItemId,
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
