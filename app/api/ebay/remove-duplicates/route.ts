import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('products')
      .select('id, brand, part_number, name, created_at')
      .eq('marketplace', 'EBAY_US')
      .eq('is_active', true)
      .not('part_number', 'is', null)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const seen = new Set<string>();
    const deactivateIds: number[] = [];

    for (const product of data || []) {
      const brand = String(product.brand || '').trim().toUpperCase();
      const part = String(product.part_number || '').trim().toUpperCase();

      if (!brand || !part || brand === 'UNKNOWN') continue;

      const key = `${brand}::${part}`;

      if (seen.has(key)) {
        deactivateIds.push(product.id);
      } else {
        seen.add(key);
      }
    }

    if (deactivateIds.length) {
      const { error: updateError } = await supabaseAdmin
        .from('products')
        .update({
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .in('id', deactivateIds);

      if (updateError) throw updateError;
    }

    return NextResponse.json({
      success: true,
      scanned: data?.length || 0,
      deactivated: deactivateIds.length,
      sample: deactivateIds.slice(0, 20),
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
