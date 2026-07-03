import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function isEbayId(value: any) {
  const v = String(value || '').trim();
  return /^27\d{10}$/.test(v) || /^\d{12,13}$/.test(v);
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const offset = Number(url.searchParams.get('offset') || 0);
    const limit = Number(url.searchParams.get('limit') || 1000);
    const dryRun = url.searchParams.get('dryRun') !== 'false';

    const { data, error } = await supabaseAdmin
  .from('products')
  .select('id, name, brand, part_number, model_number')
  .range(offset, offset + limit - 1);

    if (error) throw error;

    const rows = (data || []).filter(
      (p) => isEbayId(p.part_number) || isEbayId(p.model_number)
    );

    if (!dryRun) {
      for (const p of rows) {
        await supabaseAdmin
          .from('products')
          .update({
            part_number: 'UNKNOWN',
            model_number: 'UNKNOWN',
            updated_at: new Date().toISOString(),
          })
          .eq('id', p.id);
      }
    }

    return NextResponse.json({
      success: true,
      dryRun,
      offset,
      limit,
      found: rows.length,
      updated: dryRun ? 0 : rows.length,
      sample: rows.slice(0, 20),
      nextOffset: data && data.length === limit ? offset + limit : null,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
