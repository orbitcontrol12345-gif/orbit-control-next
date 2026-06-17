import { NextResponse } from 'next/server';
import { getEbayToken } from '@/lib/ebay';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 60;

function getSpecificValue(item: any, names: string[]) {
  const specs = item.localizedAspects || [];

  const found = specs.find((spec: any) =>
    names.some(
      (name) => spec.name?.toLowerCase() === name.toLowerCase()
    )
  );

  return found?.value || '';
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get('limit') || '10'), 10);

  const { data: products, error } = await supabaseAdmin
    .from('products')
    .select('id, sku, ebay_item_id, name, part_number')
    .not('ebay_item_id', 'is', null)
    .or('mpn.is.null,model_number.is.null')
    .order('id', { ascending: true })
    .limit(limit);

  if (error) {
    return NextResponse.json(
      {
        success: false,
        step: 'supabase-select',
        error,
      },
      { status: 500 }
    );
  }

  const token = await getEbayToken();
  const accessToken = String(token.access_token).trim();

  const results = [];

  for (const product of products || []) {
  try {

    const ebayItemId = product.ebay_item_id || product.sku;

    await new Promise(resolve => setTimeout(resolve, 500));

    const response = await fetch(
      `https://api.ebay.com/buy/browse/v1/item/v1|${ebayItemId}|0`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
          },
        }
      );

     if (response.status === 429) {
  results.push({
    sku: product.sku,
    ebayItemId,
    updated: false,
    status: 429,
    message: 'eBay rate limit reached'
  });

  break;
}

if (!response.ok) {
  results.push({
    sku: product.sku,
    ebayItemId,
    updated: false,
    status: response.status,
  });

  continue;
}

      const item = await response.json();
      
      const mpn = getSpecificValue(item, [
        'MPN',
        'Manufacturer Part Number',
      ]);

      const model = getSpecificValue(item, ['Model']);

      const brand = getSpecificValue(item, ['Brand']);

      const partNumber =
  mpn ||
  model ||
  product.part_number ||
  product.sku;

      const { error: updateError } = await supabaseAdmin
        .from('products')
        .update({
          mpn: mpn || null,
          model_number: model || null,
          brand: brand || undefined,
          part_number: partNumber,
        })
        .eq('id', product.id);

      results.push({
        id: product.id,
        sku: product.sku,
        ebayItemId,
        mpn,
        model,
        brand,
        partNumber,
        updated: !updateError,
        error: updateError,
      });
    } catch (err: any) {
      results.push({
        sku: product.sku,
        updated: false,
        error: err?.message || String(err),
      });
    }
  }

  return NextResponse.json({
    success: true,
    found: products?.length || 0,
    processed: results.length,
    results,
  });
}
