import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const sku = new URL(request.url).searchParams.get('sku');

  if (!sku) {
    return NextResponse.json({
      success: false,
      error: 'Missing sku',
    });
  }

  const { data, error } = await supabaseAdmin
    .from('products')
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq('sku', sku)
    .select();

  return NextResponse.json({
    success: !error,
    deleted: data?.length || 0,
    error,
  });
}
