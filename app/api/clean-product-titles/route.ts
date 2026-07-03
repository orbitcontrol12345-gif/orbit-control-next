import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { normalizeProductTitle } from '@/lib/normalize-product-title';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const dryRun = url.searchParams.get('dryRun') !== 'false';

  const { data, error } = await supabaseAdmin
    .from('products')
    .select('id, name')
    .eq('is_active', true)
    .range(0, 999);

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  const changed = [];

  for (const item of data || []) {
    const nextName = normalizeProductTitle(item.name || '');

    if (nextName && nextName !== item.name) {
      changed.push({ id: item.id, old: item.name, next: nextName });

      if (!dryRun) {
        await supabaseAdmin
          .from('products')
          .update({ name: nextName, updated_at: new Date().toISOString() })
          .eq('id', item.id);
      }
    }
  }

  return NextResponse.json({
    success: true,
    dryRun,
    checked: data?.length || 0,
    changed: changed.length,
    sample: changed.slice(0, 30),
  });
}
