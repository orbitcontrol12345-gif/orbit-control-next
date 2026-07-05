import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const JOB_ID = 'catalog-deduplicate';

function normalize(value: any) {
  return String(value || '').trim().toUpperCase();
}

function isSafeCatalogKey(key: any) {
  const v = normalize(key);

  if (!v) return false;
  if (!v.startsWith('PN-')) return false;
  if (v.includes('UNKNOWN')) return false;
  if (!v.includes('::')) return false;

  return true;
}

function scoreProduct(row: any) {
  let score = 0;

  if (row.catalog_visible !== false) score += 20;
  if (row.is_active !== false) score += 20;
  if (row.brand && normalize(row.brand) !== 'UNKNOWN') score += 20;
  if (row.part_number && normalize(row.part_number) !== 'UNKNOWN') score += 20;
  if (row.image_url) score += 10;
  if (row.description) score += 5;

  return score;
}

export async function GET() {
  try {
    const now = new Date().toISOString();

    const { data: job, error: jobError } = await supabaseAdmin
      .from('sync_jobs')
      .select('*')
      .eq('id', JOB_ID)
      .maybeSingle();

    if (jobError) throw jobError;
    if (!job) throw new Error('Missing sync_jobs row for catalog-deduplicate');

    if (job.status === 'finished') {
      return NextResponse.json({
        success: true,
        status: 'finished',
        message: 'Deduplication already completed.',
        offset: job.offset_value,
      });
    }

    const offset = Number(job.offset_value || 0);
    const batchSize = Number(job.batch_size || 100);

    await supabaseAdmin
      .from('sync_jobs')
      .update({
        status: 'running',
        started_at: job.started_at || now,
        updated_at: now,
        last_error: null,
      })
      .eq('id', JOB_ID);

    const { data: groups, error: groupsError } = await supabaseAdmin
      .from('products')
      .select('catalog_key')
      .eq('is_active', true)
      .not('catalog_key', 'is', null)
      .order('catalog_key', { ascending: true })
      .range(offset, offset + batchSize - 1);

    if (groupsError) throw groupsError;

    if (!groups || groups.length === 0) {
      await supabaseAdmin
        .from('sync_jobs')
        .update({
          status: 'finished',
          finished_at: now,
          updated_at: now,
        })
        .eq('id', JOB_ID);

      return NextResponse.json({
        success: true,
        status: 'finished',
        processed: 0,
        hidden: 0,
        skippedUnsafe: 0,
        nextOffset: null,
      });
    }

    const uniqueKeys = [...new Set(groups.map((g) => g.catalog_key).filter(Boolean))];

    let groupsProcessed = 0;
    let hidden = 0;
    let skippedUnsafe = 0;
    const sample: any[] = [];

    for (const catalogKey of uniqueKeys) {
      if (!isSafeCatalogKey(catalogKey)) {
        skippedUnsafe++;
        continue;
      }

      const { data: items, error: itemsError } = await supabaseAdmin
        .from('products')
        .select(`
          id,
          ebay_item_id,
          brand,
          part_number,
          name,
          condition,
          image_url,
          description,
          catalog_key,
          catalog_visible,
          duplicate_of,
          is_active
        `)
        .eq('is_active', true)
        .eq('catalog_key', catalogKey);

      if (itemsError) throw itemsError;
      if (!items || items.length <= 1) continue;

      const conditions = new Set(items.map((x) => normalize(x.condition)));
      const partNumbers = new Set(items.map((x) => normalize(x.part_number)));
      const catalogKeys = new Set(items.map((x) => String(x.catalog_key || '')));

      if (conditions.size !== 1 || partNumbers.size !== 1 || catalogKeys.size !== 1) {
        skippedUnsafe++;
        continue;
      }

      const sorted = [...items].sort((a, b) => {
        const scoreDiff = scoreProduct(b) - scoreProduct(a);
        if (scoreDiff !== 0) return scoreDiff;
        return Number(b.id) - Number(a.id);
      });

      const primary = sorted[0];
      const duplicates = sorted.slice(1);

      await supabaseAdmin
        .from('products')
        .update({
          catalog_visible: true,
          duplicate_of: null,
        })
        .eq('id', primary.id);

      for (const duplicate of duplicates) {
        const { error: updateError } = await supabaseAdmin
          .from('products')
          .update({
            catalog_visible: false,
            duplicate_of: primary.id,
          })
          .eq('id', duplicate.id);

        if (updateError) throw updateError;
        hidden++;
      }

      groupsProcessed++;

      if (sample.length < 10) {
        sample.push({
          catalogKey,
          primaryId: primary.id,
          hiddenIds: duplicates.map((x) => x.id),
        });
      }
    }

    const nextOffset = groups.length < batchSize ? null : offset + batchSize;

    await supabaseAdmin
      .from('sync_jobs')
      .update({
        offset_value: nextOffset || offset,
        processed: Number(job.processed || 0) + groups.length,
        updated: Number(job.updated || 0) + groupsProcessed,
        hidden_duplicates: Number(job.hidden_duplicates || 0) + hidden,
        failed: Number(job.failed || 0) + skippedUnsafe,
        status: nextOffset ? 'running' : 'finished',
        updated_at: now,
        finished_at: nextOffset ? null : now,
      })
      .eq('id', JOB_ID);

    return NextResponse.json({
      success: true,
      status: nextOffset ? 'running' : 'finished',
      offset,
      batchSize,
      processed: groups.length,
      uniqueKeys: uniqueKeys.length,
      groupsProcessed,
      hidden,
      skippedUnsafe,
      nextOffset,
      sample,
    });
  } catch (err: any) {
    await supabaseAdmin
      .from('sync_jobs')
      .update({
        status: 'error',
        last_error: err.message,
        updated_at: new Date().toISOString(),
      })
      .eq('id', JOB_ID);

    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
