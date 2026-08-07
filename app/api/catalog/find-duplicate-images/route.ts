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
const JOB_KEY = 'duplicate-image-scan';

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

async function ensureJobRow() {
  const { data, error } = await supabaseAdmin
    .from('catalog_jobs')
    .select('job_key, cursor_offset')
    .eq('job_key', JOB_KEY)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (data) {
    return data;
  }

  const { data: inserted, error: insertError } =
    await supabaseAdmin
      .from('catalog_jobs')
      .insert({
        job_key: JOB_KEY,
        cursor_offset: 0,
        last_processed: 0,
        last_updated: 0,
        last_unresolved: 0,
        last_failed: 0,
        last_rate_limited: false,
        updated_at: new Date().toISOString(),
      })
      .select('job_key, cursor_offset')
      .single();

  if (insertError) {
    throw insertError;
  }

  return inserted;
}

export async function GET() {
  try {
    const job = await ensureJobRow();

    const currentCursor = Math.max(
      0,
      Number(job?.cursor_offset || 0),
    );

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
      .gt('id', currentCursor)
      .order('id', { ascending: true })
      .limit(LIMIT);

    if (error) {
      throw error;
    }

    const products = (data ?? []) as ProductRow[];

    if (products.length === 0) {
      return NextResponse.json({
        success: true,
        mode: APPLY_FIX
          ? 'DUPLICATE_FIX_MODE'
          : 'READ_ONLY_DUPLICATE_SCAN',
        status: 'SCAN_COMPLETE',

        currentCursor,
        nextCursor: currentCursor,

        processed: 0,
        exactDuplicates: 0,
        differentImages: 0,
        failed: 0,

        message:
          'No more products with image_count = 2 remain after the current cursor.',
      });
    }

    let exactDuplicates = 0;
    let differentImages = 0;
    let failed = 0;
    let markedForRepair = 0;

    const results: Array<Record<string, unknown>> = [];

    for (const product of products) {
      try {
        const urls = cleanUrls(
          product.r2_gallery_urls,
        );

        if (urls.length < 2) {
          failed++;

          results.push({
            id: product.id,
            ebay_item_id: product.ebay_item_id,
            part_number: product.part_number,
            status: 'insufficient_urls',
            url_count: urls.length,
          });

          continue;
        }

        const first =
          await downloadImageToBuffer(urls[0]);

        const second =
          await downloadImageToBuffer(urls[1]);

        const firstHash = hashBuffer(
          first.buffer,
        );

        const secondHash = hashBuffer(
          second.buffer,
        );

        const isDuplicate =
          firstHash === secondHash;

        if (isDuplicate) {
          exactDuplicates++;

          if (APPLY_FIX) {
            const { error: markError } =
              await supabaseAdmin
                .from('products')
                .update({
                  image_status:
                    'repair_duplicate_gallery',
                  updated_at:
                    new Date().toISOString(),
                })
                .eq('id', product.id);

            if (markError) {
              throw markError;
            }

            markedForRepair++;
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

          marked_for_repair:
            isDuplicate && APPLY_FIX,

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

    const nextCursor =
      products[products.length - 1]?.id ??
      currentCursor;

    const { error: jobUpdateError } =
      await supabaseAdmin
        .from('catalog_jobs')
        .update({
          cursor_offset: nextCursor,
          last_processed: products.length,
          last_updated: markedForRepair,
          last_failed: failed,
          updated_at: new Date().toISOString(),
        })
        .eq('job_key', JOB_KEY);

    if (jobUpdateError) {
      throw jobUpdateError;
    }

    const { count: totalMarked, error: countError } =
      await supabaseAdmin
        .from('products')
        .select('*', {
          count: 'exact',
          head: true,
        })
        .eq(
          'image_status',
          'repair_duplicate_gallery',
        );

    if (countError) {
      throw countError;
    }

    return NextResponse.json({
      success: true,

      mode: APPLY_FIX
        ? 'DUPLICATE_FIX_MODE'
        : 'READ_ONLY_DUPLICATE_SCAN',

      status: 'BATCH_COMPLETE',

      currentCursor,
      nextCursor,

      processed: products.length,

      exactDuplicates,
      differentImages,
      markedForRepair,
      totalMarkedForRepair: totalMarked ?? 0,
      failed,

      note: APPLY_FIX
        ? 'Exact duplicate images are marked as repair_duplicate_gallery. Different images are not modified.'
        : 'Read-only mode. No products were modified.',

      results,
    });
  } catch (error) {
    console.error(
      'FIND DUPLICATE IMAGES ERROR:',
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 },
    );
  }
}
