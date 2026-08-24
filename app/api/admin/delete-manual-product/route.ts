import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function hideProduct(sku: string) {
  return supabaseAdmin
    .from('products')
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq('sku', sku)
    .eq('source_type', 'manual')
    .select('sku,is_active');
}

export async function POST(request: Request) {
  const isJson = request.headers
    .get('content-type')
    ?.includes('application/json');
  const input = isJson
    ? await request.json()
    : Object.fromEntries(await request.formData());
  const sku = String(input.sku || '').trim();

  if (!sku || !sku.startsWith('MANUAL-')) {
    return NextResponse.json({ success: false, error: 'Missing sku' }, { status: 400 });
  }

  const { data, error } = await hideProduct(sku);

  if (!error && data?.length) {
    revalidateTag('products', 'max');
  }

  if (!isJson && !error && data?.length) {
    return NextResponse.redirect(
      new URL('/admin/products?hidden=1', request.url),
      303,
    );
  }

  return NextResponse.json({
    success: !error,
    hidden: data?.length || 0,
    data,
    error,
  });
}
