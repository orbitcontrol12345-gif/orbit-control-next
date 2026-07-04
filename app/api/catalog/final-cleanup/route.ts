import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { detectIndustrialBrand } from '@/lib/industrial-brand';
import { extractIndustrialPartNumberV2 } from '@/lib/industrial-part-number-v2';
import { makeCatalogIdentity } from '@/lib/catalog-identity';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const JOB_ID = 'catalog-final-cleanup';

function isBadPartNumber(value: any) {
  const v = String(value || '').trim().toUpperCase();

  return (
    !v ||
    v === 'UNKNOWN' ||
    v === 'PN' ||
    v === 'P/N' ||
    v === 'I/O' ||
    v === 'W/O' ||
    /^27\d{10}$/.test(v) ||
    /^\d{12,13}$/.test(v) ||
    /^\d+\/\d+HZ$/.test(v) ||
    /^\d+(\.\d+)?(VAC|VDC|AC|DC|V|HZ|KW|W|A|MA)$/.test(v) ||
    ['INPUT', 'OUTPUT', 'SYSTEM', 'MODULE', 'BOARD', 'RELAY', 'POWER', 'SUPPLY'].includes(v)
  );
}

function normalizePart(value: any) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\s*-\s*/g, '-')
    .replace(/\s+/g, '-');
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

    if (!job) {
      return NextResponse.json(
        { success: false, error: 'Missing sync_jobs row. Run SQL first.' },
        { status: 500 }
      );
    }

    if (job.status === 'finished') {
      return NextResponse.json({
        success: true,
        status: 'finished',
        message: 'Final cleanup already completed.',
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

    const { data: rows, error: rowsError } = await supabaseAdmin
      .from('products')
      .select(`
        id,
        ebay_item_id,
        sku,
        brand,
        part_number,
        model_number,
        name,
        description,
        condition,
        catalog_key
      `)
      .order('id', { ascending: true })
      .range(offset, offset + batchSize - 1);

    if (rowsError) throw rowsError;

    if (!rows || rows.length === 0) {
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
        nextOffset: null,
      });
    }

    let updated = 0;
    let failed = 0;
    const sample: any[] = [];

    for (const row of rows) {
      try {
        const sourceText = [
          row.brand,
          row.description,
          row.name,
          row.part_number,
          row.model_number,
        ]
          .filter(Boolean)
          .join(' ');

        const detectedBrand = detectIndustrialBrand(sourceText);
        const cleanBrand =
          detectedBrand && detectedBrand !== 'UNKNOWN'
            ? detectedBrand
            : row.brand || 'UNKNOWN';

        const extractedPart = normalizePart(
          extractIndustrialPartNumberV2(`${row.description || ''} ${row.name || ''}`)
        );

        const currentPart = normalizePart(row.part_number);

        const finalPart =
          extractedPart && !isBadPartNumber(extractedPart)
            ? extractedPart
            : !isBadPartNumber(currentPart)
              ? currentPart
              : 'UNKNOWN';

        const { catalogKey } = makeCatalogIdentity({
          brand: cleanBrand,
          partNumber: finalPart,
          name: row.name,
          condition: row.condition,
        });

        const updates: any = {
          brand: cleanBrand,
          part_number: finalPart,
          model_number: finalPart,
          catalog_key: catalogKey,
          updated_at: now,
        };

        const { error: updateError } = await supabaseAdmin
          .from('products')
          .update(updates)
          .eq('id', row.id);

        if (updateError) throw updateError;

        updated++;

        if (sample.length < 10) {
          sample.push({
            id: row.id,
            brandBefore: row.brand,
            brandAfter: cleanBrand,
            partBefore: row.part_number,
            partAfter: finalPart,
            catalogKey,
          });
        }
      } catch (err: any) {
        failed++;
        if (sample.length < 10) {
          sample.push({
            id: row.id,
            error: err.message,
          });
        }
      }
    }

    const nextOffset = rows.length < batchSize ? null : offset + batchSize;

    await supabaseAdmin
      .from('sync_jobs')
      .update({
        offset_value: nextOffset || offset,
        processed: Number(job.processed || 0) + rows.length,
        updated: Number(job.updated || 0) + updated,
        failed: Number(job.failed || 0) + failed,
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
      processed: rows.length,
      updated,
      failed,
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
