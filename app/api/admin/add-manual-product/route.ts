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
  try {
    const body = await request.json();

    const name = String(body.name || '').trim();
    const brand = String(body.brand || 'UNKNOWN').trim();
    const modelNumber = String(body.model_number || body.part_number || '').trim();

    if (!name || !modelNumber) {
      return NextResponse.json({
        success: false,
        error: 'Product name and model number are required',
      }, { status: 400 });
    }

    const manualSku = `MANUAL-${Date.now()}`;

    const product = {
      ebay_item_id: null,
      sku: manualSku,
      part_number: modelNumber,
      model_number: modelNumber,
      brand,
      category: body.category || 'Industrial Automation',
      name,
      condition: body.condition || 'Used',
      image_url: body.image_url || '',
      description: body.description || name,
      slug: slugify(`${manualSku}-${brand}-${modelNumber}-${name}`),
      marketplace: 'MANUAL',
      seller: 'orbitcontrol',
      source: 'manual',
      source_type: 'manual',
      quantity: Number(body.quantity || 1),
      price: body.price ? Number(body.price) : null,
      currency: body.currency || 'USD',
      is_active: true,
      last_seen_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseAdmin
      .from('products')
      .insert(product)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      product: data,
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}
