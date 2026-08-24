import { NextResponse } from 'next/server';

import {
  formatValidationError,
  manualProductInputSchema,
  slugifyManualProduct,
} from '@/lib/manual-product';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  const form = await request.formData();
  const sku = String(form.get('sku') || '').trim();
  const parsed = manualProductInputSchema.safeParse({
    name: form.get('name'),
    brand: form.get('brand'),
    model_number: form.get('model_number'),
    category: form.get('category'),
    condition: form.get('condition'),
    quantity: form.get('quantity'),
    image_url: form.get('image_url'),
    description: form.get('description'),
  });

  if (!sku || !sku.startsWith('MANUAL-')) {
    return NextResponse.json(
      {
        success: false,
        error: 'Invalid manual product SKU',
      },
      { status: 400 },
    );
  }

  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: formatValidationError(parsed.error),
      },
      { status: 400 },
    );
  }

  const input = parsed.data;
  const brand = input.brand || 'Unknown';
  const updateData = {
    name: input.name,
    brand,
    part_number: input.model_number,
    model_number: input.model_number,
    category: input.category || 'Industrial Automation',
    condition: input.condition,
    quantity: input.quantity,
    image_url: input.image_url,
    description: input.description || input.name,
    slug: slugifyManualProduct(
      `${sku}-${brand}-${input.model_number}-${input.name}`,
    ),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseAdmin
    .from('products')
    .update(updateData)
    .eq('sku', sku)
    .eq('source_type', 'manual')
    .select('id,sku');

  if (error) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 },
    );
  }

  if (!data?.length) {
    return NextResponse.json(
      {
        success: false,
        error: 'Manual product not found',
      },
      { status: 404 },
    );
  }

  return NextResponse.redirect(
    new URL('/admin/products?updated=1', request.url),
    303,
  );
}

