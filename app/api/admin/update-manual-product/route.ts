import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';

import {
  buildManualProductGallery,
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
    image_url: form.get('image_url') || '',
    image_urls: form.get('image_urls'),
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
  const galleryUrls = buildManualProductGallery(
    input.image_urls,
    input.image_url,
  );
  const mainImageUrl = galleryUrls[0] || '';
  const updateData = {
    name: input.name,
    brand,
    part_number: input.model_number,
    model_number: input.model_number,
    category: input.category,
    condition: input.condition,
    image_url: mainImageUrl,
    r2_image_url: mainImageUrl || null,
    r2_gallery_urls: galleryUrls,
    image_count: galleryUrls.length,
    image_status: galleryUrls.length
      ? 'manual_gallery'
      : 'manual_no_image',
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

  revalidateTag('products', 'max');

  return NextResponse.redirect(
    new URL('/admin/products?updated=1', request.url),
    303,
  );
}
