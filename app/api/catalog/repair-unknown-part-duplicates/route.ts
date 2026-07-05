import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { makeCatalogIdentity } from '@/lib/catalog-identity';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function norm(value: any) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');
}

function compact(value: any) {
  return norm(value).replace(/[^A-Z0-9]/g, '');
}

function isBadPart(value: any) {
  const v = norm(value);
  return (
    !v ||
    v === 'UNKNOWN' ||
    v === 'P/N' ||
    v === 'PN' ||
    v.length < 3 ||
    /^\d{12,13}$/.test(v)
  );
}

function nameContainsPart(name: any, part: any) {
  const n = compact(name);
  const p = compact(part);

  if (!n || !p || p.length < 4) return false;
  return n.includes(p);
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const apply = url.searchParams.get('apply') === 'true';
    const limit = Number(url.searchParams.get('limit') || 200);

    const { data: badRows, error: badError } = await supabaseAdmin
      .from('products')
      .select(`
        id,
        ebay_item_id,
        brand,
        part_number,
        name,
        condition,
        catalog_key
      `)
      .eq('is_active', true)
      .eq('catalog_visible', true)
      .limit(limit);

    if (badError) throw badError;

    const candidates = (badRows || []).filter((row) =>
      isBadPart(row.part_number)
    );

    const fixes: any[] = [];

    for (const bad of candidates) {
      const brand = norm(bad.brand);
      if (!brand || brand === 'UNKNOWN') continue;

      const { data: possible, error: possibleError } = await supabaseAdmin
        .from('products')
        .select(`
          id,
          ebay_item_id,
          brand,
          part_number,
          name,
          condition,
          catalog_key
        `)
        .eq('is_active', true)
        .eq('catalog_visible', true)
        .eq('brand', bad.brand)
        .neq('part_number', 'UNKNOWN')
        .limit(1000);

      if (possibleError) throw possibleError;

      const match = (possible || []).find((row) => {
        if (String(row.id) === String(bad.id)) return false;
        if (isBadPart(row.part_number)) return false;

        const sameCondition =
          norm(row.condition) === norm(bad.condition);

        if (!sameCondition) return false;

        return nameContainsPart(bad.name, row.part_number);
      });

      if (!match) continue;

      const { catalogKey } = makeCatalogIdentity({
        brand: bad.brand,
        partNumber: match.part_number,
        name: bad.name,
        condition: bad.condition,
      });

      fixes.push({
        id: bad.id,
        ebayItemId: bad.ebay_item_id,
        brand: bad.brand,
        condition: bad.condition,
        name: bad.name,
        oldPartNumber: bad.part_number,
        newPartNumber: match.part_number,
        oldCatalogKey: bad.catalog_key,
        newCatalogKey: catalogKey,
        matchedProductId: match.id,
      });

      if (apply) {
        const { error: updateError } = await supabaseAdmin
          .from('products')
          .update({
            part_number: match.part_number,
            model_number: match.part_number,
            catalog_key: catalogKey,
            updated_at: new Date().toISOString(),
          })
          .eq('id', bad.id);

        if (updateError) throw updateError;
      }
    }

    return NextResponse.json({
      success: true,
      apply,
      scanned: badRows?.length || 0,
      badCandidates: candidates.length,
      fixesFound: fixes.length,
      fixes: fixes.slice(0, 50),
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
