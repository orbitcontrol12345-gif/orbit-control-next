import { NextResponse } from 'next/server';
import { getEbayToken } from '@/lib/ebay';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function getSpecificValue(item: any, names: string[]) {
  const specs = item.localizedAspects || [];

  const found = specs.find((spec: any) =>
    names.some((name) =>
      spec.name?.toLowerCase() === name.toLowerCase()
    )
  );

  return found?.value || '';
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Number(searchParams.get('limit') || '500');

  const { data: products } = await supabaseAdmin
  .from('products')
  .select('id, sku, ebay_item_id, name')
  .not('ebay_item_id', 'is', null)
  .or('mpn.is.null,model_number.is.null,brand.eq.Unknown')
  .order('id', { ascending: true })
  .limit(limit);
  const token = await getEbayToken();
  const accessToken = String(token.access_token).trim();

  const results = [];

  for (const product of products || []) {
    const ebayItemId = product.ebay_item_id || product.sku;

    const response = await fetch(
      `https://api.ebay.com/buy/browse/v1/item/v1|${ebayItemId}|0`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
        },
      }
    );

    const item = await response.json();

    const mpn = getSpecificValue(item, ['MPN', 'Manufacturer Part Number']);
    const model = getSpecificValue(item, ['Model']);
    const brand = getSpecificValue(item, ['Brand']);

    const partNumber = mpn || model || product.sku;

    const { error } = await supabaseAdmin
      .from('products')
      .update({
        mpn,
        model_number: model,
        brand: brand || undefined,
        part_number: partNumber,
      })
      .eq('id', product.id);

    results.push({
      sku: product.sku,
      mpn,
      model,
      brand,
      partNumber,
      updated: !error,
      error,
    });
  }

  return NextResponse.json({
    success: true,
    processed: results.length,
    results,
  });
}
