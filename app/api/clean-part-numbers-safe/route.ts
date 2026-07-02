import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getSafePartNumber } from '@/lib/part-number-safe-update';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DEFAULT_LIMIT = 500;
const MAX_LOOPS = 20;

function isReviewCase(oldPart: string, nextPart: string) {
  const oldValue = String(oldPart || '').toUpperCase();

  if (oldValue.includes(' REV ')) return true;
  if (oldValue.includes(' REV.')) return true;

  return false;
}

async function processBatch({
  offset,
  limit,
  dryRun,
}: {
  offset: number;
  limit: number;
  dryRun: boolean;
}) {
  const { data, error } = await supabaseAdmin
    .from('products')
    .select('id, brand, part_number, model_number, name')
    .eq('is_active', true)
    .order('id', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;

  let changed = 0;
  let updated = 0;
  const sample: any[] = [];
  const needsReview: any[] = [];

  for (const item of data || []) {
    const safePart = getSafePartNumber({
      title: item.name || '',
      currentPartNumber: item.part_number || '',
      brand: item.brand || '',
    });

    if (safePart && safePart !== item.part_number) {
      changed++;

      const row = {
        id: item.id,
        old: item.part_number,
        next: safePart,
        name: item.name,
      };

      if (isReviewCase(item.part_number || '', safePart)) {
        needsReview.push(row);
        continue;
      }

      sample.push(row);

      if (!dryRun) {
        const { error: updateError } = await supabaseAdmin
          .from('products')
          .update({
            part_number: safePart,
            model_number: safePart,
            updated_at: new Date().toISOString(),
          })
          .eq('id', item.id);

        if (updateError) throw updateError;

        updated++;
      }
    }
  }

  return {
    offset,
    limit,
    checked: data?.length || 0,
    changed,
    updated,
    sample: sample.slice(0, 20),
    needsReview: needsReview.slice(0, 20),
    hasMore: (data?.length || 0) === limit,
  };
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);

    const limit = Number(url.searchParams.get('limit') || DEFAULT_LIMIT);
    const offset = Number(url.searchParams.get('offset') || 0);
    const dryRun = url.searchParams.get('dryRun') !== 'false';
    const auto = url.searchParams.get('auto') === 'true';

    if (!auto) {
      const result = await processBatch({ offset, limit, dryRun });

      return NextResponse.json({
        success: true,
        dryRun,
        ...result,
        nextOffset: offset + limit,
      });
    }

    let currentOffset = offset;
    let totalChecked = 0;
    let totalChanged = 0;
    let totalUpdated = 0;
    const reports: any[] = [];
    const reviewItems: any[] = [];

    for (let i = 0; i < MAX_LOOPS; i++) {
      const result = await processBatch({
        offset: currentOffset,
        limit,
        dryRun,
      });

      totalChecked += result.checked;
      totalChanged += result.changed;
      totalUpdated += result.updated;

      if (result.changed > 0 || result.needsReview.length > 0) {
        reports.push(result);
      }

      if (result.needsReview.length > 0) {
        reviewItems.push(...result.needsReview);
      }

      if (!result.hasMore) {
        return NextResponse.json({
          success: true,
          mode: 'auto',
          dryRun,
          finished: true,
          totalChecked,
          totalChanged,
          totalUpdated,
          nextOffset: null,
          reports,
          reviewItems: reviewItems.slice(0, 50),
        });
      }

      currentOffset += limit;
    }

    return NextResponse.json({
      success: true,
      mode: 'auto',
      dryRun,
      finished: false,
      totalChecked,
      totalChanged,
      totalUpdated,
      nextOffset: currentOffset,
      reports,
      reviewItems: reviewItems.slice(0, 50),
      message: 'Run again using nextOffset to continue.',
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
