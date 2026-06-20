import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 180);
}

export async function POST(request: Request) {
  const form = await request.formData();

  const sku = String(form.get('sku') || '').trim();
  const name = String(form.get('name') || '').trim();
  const brand = String(form.get('brand') || '').trim();
  const modelNumber = String(form.get('model_number') || '').trim();

  if (!sku || !name || !modelNumber) {
    return NextResponse.json({
      success: false,
      error: 'Missing sku, name, or model number',
    }, { status: 400 });
  }

  const updateData = {
    name,
    brand,
    part_number: modelNumber,
    model_number: modelNumber,
    category: String(form.get('category') || 'Industrial Automation').trim(),
    condition: String(form.get('condition') || 'Used').trim(),
    quantity: Number(form.get('quantity') || 1),
    image_url: String(form.get('image_url') || '').trim(),
    description: String(form.get('description') || name).trim(),
    slug: slugify(`${sku}-${brand}-${modelNumber}-${name}`),
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabaseAdmin
    .from('products')
    .update(updateData)
    .eq('sku', sku);

  if (error) {
    return NextResponse.json({ success: false, error }, { status: 500 });
  }

  return NextResponse.redirect(
    new URL('/admin/products', request.url)
  );
}
