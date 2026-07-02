import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function normalizeName(name: string) {
  return String(name || '')
    .toUpperCase()
    .replace(/\bLOT OF\b/g, ' ')
    .replace(/\bLOT\b/g, ' ')
    .replace(/\bPIECES\b/g, ' ')
    .replace(/\bPIECE\b/g, ' ')
    .replace(/\bPCS\b/g, ' ')
    .replace(/\b3PCS\b/g, ' ')
    .replace(/\b3 PCS\b/g, ' ')
    .replace(/\bRELAYS\b/g, 'RELAY')
    .replace(/\bHEAVY[- ]?DUTY\b/g, ' ')
    .replace(/[.,()/_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function groupKey(item: any) {
  return [
    String(item.brand || 'UNKNOWN').trim().toUpperCase(),
    String(item.part_number || '').trim().toUpperCase(),
    String(item.condition || 'UNKNOWN').trim().toUpperCase(),
    String(item.image_url || '').trim(),
    normalizeName(item.name || ''),
  ].join('::');
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const dryRun = url.searchParams.get('dryRun') !== 'false';

  const { data, error } = await supabaseAdmin
    .from('products')
    .select('id, ebay_item_id, brand, part_number, condition, image_url, name, catalog_visible')
    .eq('is_active', true)
    .neq('catalog_visible', false)
    .not('part_number', 'is', null)
    .order('id', { ascending: false })
    .limit(20000);

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  const groups = new Map<string, any[]>();

  for (const item of data || []) {
    if (!item.part_number || !item.image_url) continue;

    const key = groupKey(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }

  const toHide: any[] = [];

  for (const items of groups.values()) {
    if (items.length <= 1) continue;

    const sorted = [...items].sort((a, b) => Number(b.id) - Number(a.id));
    const keep = sorted[0];
    const hide = sorted.slice(1);

    for (const item of hide) {
      toHide.push({
        id: item.id,
        ebay_item_id: item.ebay_item_id,
        part_number: item.part_number,
        keep_id: keep.id,
        name: item.name,
      });
    }
  }

  if (!dryRun && toHide.length > 0) {
    const ids = toHide.map((x) => x.id);

    const { error: updateError } = await supabaseAdmin
      .from('products')
      .update({
        catalog_visible: false,
        updated_at: new Date().toISOString(),
      })
      .in('id', ids);

    if (updateError) {
      return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
    }
  }

  return NextResponse.json({
    success: true,
    dryRun,
    checked: data?.length || 0,
    duplicatesFound: toHide.length,
    sample: toHide.slice(0, 50),
  });
}
