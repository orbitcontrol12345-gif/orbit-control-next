import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getSafePartNumber } from '@/lib/part-number-safe-update';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Number(url.searchParams.get('limit') || 100);
  const offset = Number(url.searchParams.get('offset') || 0);
  const dryRun = url.searchParams.get('dryRun') !== 'false';

  const { data, error } = await supabaseAdmin
    .from('products')
    .select('id, brand, part_number, model_number, name')
    .eq('is_active', true)
    .order('id', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  let changed = 0;
  const sample: any[] = [];

  for (const item of data || []) {
    const safePart = getSafePartNumber({
      title: item.name || '',
      currentPartNumber: item.part_number || '',
      brand: item.brand || '',
    });

    if (safePart && safePart !== item.part_number) {
      changed++;

      sample.push({
        id: item.id,
        old: item.part_number,
        next: safePart,
        name: item.name,
      });

      if (!dryRun) {
        await supabaseAdmin
          .from('products')
          .update({
            part_number: safePart,
            model_number: safePart,
            updated_at: new Date().toISOString(),
          })
          .eq('id', item.id);
      }
    }
  }

  return NextResponse.json({
    success: true,
    dryRun,
    offset,
    limit,
    checked: data?.length || 0,
    changed,
    sample: sample.slice(0, 30),
    nextOffset: offset + limit,
  });
}
