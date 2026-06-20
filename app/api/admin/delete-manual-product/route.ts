import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function deleteManualProduct(sku: string) {
  return supabaseAdmin
    .from('products')
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq('sku', sku)
    .eq('source_type', 'manual')
    .select();
}

export async function POST(request: Request) {
  const body = await request.json();
  const sku = String(body.sku || '').trim();

  if (!sku) {
    return NextResponse.json({ success: false, error: 'Missing sku' }, { status: 400 });
  }

  const { data, error } = await deleteManualProduct(sku);

  return NextResponse.json({
    success: !error,
    deleted: data?.length || 0,
    error,
  });
}

export async function GET(request: Request) {
  const sku = new URL(request.url).searchParams.get('sku') || '';

  if (!sku) {
    return NextResponse.json({ success: false, error: 'Missing sku' }, { status: 400 });
  }

  const { data, error } = await deleteManualProduct(sku);

  return NextResponse.json({
    success: !error,
    deleted: data?.length || 0,
    error,
  });
}
