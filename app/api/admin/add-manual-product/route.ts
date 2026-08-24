import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase-admin';
import {
  buildManualProductGallery,
  formatValidationError,
  manualProductInputSchema,
  slugifyManualProduct,
} from '@/lib/manual-product';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = manualProductInputSchema.safeParse({
      ...body,
      model_number: body.model_number || body.part_number,
    });

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
    const manualSku = `MANUAL-${Date.now()}-${crypto
      .randomUUID()
      .slice(0, 8)
      .toUpperCase()}`;
    const description = input.description || input.name;
    const brand = input.brand || 'Unknown';
    const galleryUrls = buildManualProductGallery(
      input.image_urls,
      input.image_url,
    );
    const mainImageUrl = galleryUrls[0] || '';

    const product = {
      ebay_item_id: manualSku,
      sku: manualSku,
      part_number: input.model_number,
      model_number: input.model_number,
      brand,
      category: input.category,
      name: input.name,
      condition: input.condition,
      image_url: mainImageUrl,
      r2_image_url: mainImageUrl || null,
      r2_gallery_urls: galleryUrls,
      image_count: galleryUrls.length,
      image_status: galleryUrls.length
        ? 'manual_gallery'
        : 'manual_no_image',
      description,
      slug: slugifyManualProduct(
        `${manualSku}-${brand}-${input.model_number}-${input.name}`,
      ),
      marketplace: 'MANUAL',
      seller: 'orbitcontrol',
      source: 'manual',
      source_type: 'manual',
      quantity: 1,
      price: null,
      currency: 'USD',
      is_active: true,
      catalog_visible: true,
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

    revalidateTag('products', 'max');

    return NextResponse.json({
      success: true,
      product: data,
    });
  } catch (error: unknown) {
    return NextResponse.json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Unable to add manual product',
    }, { status: 500 });
  }
}
