import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { downloadImageToBuffer } from '@/lib/image-uploader';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const LIMIT = 25;
const MARKETPLACE = 'EBAY_US';
const APPLY_FIX = true;
type ProductRow = {
  id: number;
  ebay_item_id: string | null;
  part_number: string | null;
  name: string | null;
  image_count: number | null;
  r2_gallery_urls: string[] | null;
};

function cleanUrls(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((url) => String(url || '').trim())
    .filter((url) => /^https?:\/\//i.test(url));
}

function hashBuffer(buffer: Buffer): string {
  return createHash('sha256')
    .update(buffer)
    .digest('hex');
}

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('products')
      .select(`
        id,
        ebay_item_id,
        part_number,
        name,
        image_count,
        r2_gallery_urls
      `)
      .eq('marketplace', MARKETPLACE)
      .eq('image_count', 2)
      .not('r2_gallery_urls', 'is', null)
      .order('id', { ascending: true })
      .limit(LIMIT);

    if (error) {
      throw error;
    }

    const products = (data ?? []) as ProductRow[];

    let exactDuplicates = 0;
    let differentImages = 0;
    let failed = 0;

    const results: Array<Record<string, unknown>> = [];

    for (const product of products) {
      try {
        const urls = cleanUrls(
          product.r2_gallery_urls
        );

        if (urls.length < 2) {
          results.push({
            id: product.id,
            ebay_item_id: product.ebay_item_id,
            part_number: product.part_number,
            status: 'insufficient_urls',
            url_count: urls.length,
          });

          failed++;
          continue;
        }

        const first =
          await downloadImageToBuffer(urls[0]);

        const second =
          await downloadImageToBuffer(urls[1]);

        const firstHash =
          hashBuffer(first.buffer);

        const secondHash =
          hashBuffer(second.buffer);

        const isDuplicate =
          firstHash === secondHash;

       if (isDuplicate) {
  exactDuplicates++;

  if (APPLY_FIX) {
    const { error: markError } =
      await supabaseAdmin
        .from('products')
        .update({
          image_status: 'repair_duplicate_gallery',
          updated_at: new Date().toISOString(),
        })
        .eq('id', product.id);

    if (markError) {
      throw markError;
    }
  }
} else {
  differentImages++;
}
        results.push({
          id: product.id,
          ebay_item_id: product.ebay_item_id,
          part_number: product.part_number,
          name: product.name,
          image_count: product.image_count,

          status: isDuplicate
            ? 'exact_duplicate'
            : 'different_images',

          first_url: urls[0],
          second_url: urls[1],

          first_hash: firstHash,
          second_hash: secondHash,
        });
      } catch (productError) {
        failed++;

        results.push({
          id: product.id,
          ebay_item_id: product.ebay_item_id,
          part_number: product.part_number,

          status: 'failed',

          error:
            productError instanceof Error
              ? productError.message
              : String(productError),
        });
      }
    }

    return NextResponse.json({
      success: true,
      mode: 'READ_ONLY_DUPLICATE_SCAN',

      processed: products.length,

      exactDuplicates,
      differentImages,
      failed,

      note:
        'This route only compares image hashes. It does not update Supabase or delete any R2 files.',

      results,
    });
  } catch (error) {
    console.error(
      'FIND DUPLICATE IMAGES ERROR:',
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}
