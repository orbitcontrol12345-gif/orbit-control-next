import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';
import { getEbayToken } from '@/lib/ebay';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { normalizeEbayItem } from '@/lib/ebay-product-normalizer';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const JOB_ID = 'ebay-auto-import';
const DEFAULT_LIMIT = 50;
const CONCURRENCY = 8;
const FEED_CHUNK_SIZE = 500;

async function createFeedTask(accessToken: string) {
  const res = await fetch('https://api.ebay.com/sell/feed/v1/inventory_task', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Accept-Language': 'en-US',
    },
    body: JSON.stringify({
      feedType: 'LMS_ACTIVE_INVENTORY_REPORT',
      schemaVersion: '1.0',
    }),
  });

  const location = res.headers.get('location');
  const taskId = location?.split('/').pop() || null;

  if (!res.ok || !taskId) {
    throw new Error(`Failed to create feed task: ${res.status}`);
  }

  return taskId;
}

async function getTaskStatus(accessToken: string, taskId: string) {
  const res = await fetch(`https://api.ebay.com/sell/feed/v1/task/${taskId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Accept-Language': 'en-US',
    },
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(`Failed to check task: ${res.status}`);
  }

  return data?.status || data?.taskStatus || 'UNKNOWN';
}

async function downloadFeedRows(accessToken: string, taskId: string) {
  const res = await fetch(
    `https://api.ebay.com/sell/feed/v1/task/${taskId}/download_result_file`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Accept-Language': 'en-US',
      },
    }
  );

  if (!res.ok) {
    throw new Error(`Failed to download feed: ${res.status}`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  const zip = await JSZip.loadAsync(buffer);
  const fileName = Object.keys(zip.files)[0];
  const xml = await zip.files[fileName].async('string');

  const blocks = xml.match(/<SKUDetails>[\s\S]*?<\/SKUDetails>/g) || [];

  return blocks
    .map((block) => {
      const ebay_item_id = getTag(block, 'ItemID');
      if (!ebay_item_id) return null;

      const priceMatch = block.match(
        /<Price currencyID="([^"]+)">([^<]+)<\/Price>/
      );

      return {
        ebay_item_id,
        sku: getTag(block, 'SKU'),
        price: priceMatch?.[2] ? Number(priceMatch[2]) : null,
        currency: priceMatch?.[1] || 'USD',
        quantity: Number(getTag(block, 'Quantity') || 0),
      };
    })
    .filter((row): row is any => row !== null)
    .filter((row) => row.currency === 'USD' && row.quantity > 0);
}

async function findMissingRows(rows: any[], offset: number) {
  const safeOffset = Math.max(0, Math.min(offset, rows.length));
  const end = Math.min(safeOffset + FEED_CHUNK_SIZE, rows.length);
  const chunk = rows.slice(safeOffset, end);

  if (!chunk.length) {
    return {
      missing: [] as any[],
      nextOffset: end,
      finished: true,
      scanned: 0,
      total: rows.length,
    };
  }

  const ids = chunk.map((row) => String(row.ebay_item_id));

  const { data, error } = await supabaseAdmin
    .from('products')
    .select('ebay_item_id')
    .in('ebay_item_id', ids);

  if (error) throw error;

  const existing = new Set(
    (data || []).map((row) => String(row.ebay_item_id))
  );

  const missing = chunk.filter(
    (row) => !existing.has(String(row.ebay_item_id))
  );

  return {
    missing,
    nextOffset: end,
    finished: end >= rows.length,
    scanned: chunk.length,
    total: rows.length,
  };
}

async function fetchEbayItem(accessToken: string, ebayItemId: string) {
  const res = await fetch(
    `https://api.ebay.com/buy/browse/v1/item/get_item_by_legacy_id?legacy_item_id=${ebayItemId}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
        'Accept-Language': 'en-US',
      },
    }
  );

  if (!res.ok) return null;
  return res.json();
}

async function ensureJob() {
  const { data } = await supabaseAdmin
    .from('sync_jobs')
    .select('*')
    .eq('id', JOB_ID)
    .maybeSingle();

  if (data) return data;

  const { data: created, error } = await supabaseAdmin
    .from('sync_jobs')
    .insert({
      id: JOB_ID,
      status: 'idle',
      stage: 'idle',
      offset_value: 0,
      batch_size: DEFAULT_LIMIT,
      processed: 0,
      updated: 0,
      failed: 0,
    })
    .select('*')
    .single();

  if (error) throw error;
  return created;
}

export async function GET(req: NextRequest) {
  try {
    const now = new Date().toISOString();
    const { access_token } = await getEbayToken();
    const accessToken = String(access_token || '').trim();

    if (!accessToken) {
      return NextResponse.json(
        { success: false, error: 'No eBay access token' },
        { status: 500 }
      );
    }

    const job = await ensureJob();
    let taskId = job.feed_task_id as string | null;

    if (!taskId || job.stage === 'idle' || job.stage === 'done') {
      taskId = await createFeedTask(accessToken);

      await supabaseAdmin
        .from('sync_jobs')
        .update({
          status: 'running',
          stage: 'waiting_feed',
          feed_task_id: taskId,
          offset_value: 0,
          processed: 0,
          updated: 0,
          failed: 0,
          last_error: null,
          started_at: now,
          finished_at: null,
          updated_at: now,
        })
        .eq('id', JOB_ID);

      return NextResponse.json({
        success: true,
        stage: 'created_feed_task',
        taskId,
        offset: 0,
        chunkSize: FEED_CHUNK_SIZE,
        message: 'Feed task created. Run the route again to check its status.',
      });
    }

    const status = await getTaskStatus(accessToken, taskId);

    if (status === 'FAILED' || status === 'CANCELED') {
      throw new Error(`eBay feed task ${status.toLowerCase()}: ${taskId}`);
    }

    if (status !== 'COMPLETED') {
      return NextResponse.json({
        success: true,
        stage: 'waiting_feed',
        taskId,
        ebayStatus: status,
        currentOffset: Number(job.offset_value || 0),
      });
    }

    const feedRows = await downloadFeedRows(accessToken, taskId);
    const currentOffset = Math.max(0, Number(job.offset_value || 0));
    const result = await findMissingRows(feedRows, currentOffset);
    const missingRows = result.missing;

    let inserted = 0;
    let failed = 0;
    const sample: any[] = [];

    for (let i = 0; i < missingRows.length; i += CONCURRENCY) {
      const chunk = missingRows.slice(i, i + CONCURRENCY);
      const details = await Promise.all(
        chunk.map((row) => fetchEbayItem(accessToken, row.ebay_item_id))
      );

      for (let index = 0; index < chunk.length; index++) {
        const row = chunk[index];
        const item = details[index];

        try {
          if (!item?.title) {
            failed++;
            sample.push({
              ebayItemId: row.ebay_item_id,
              error: 'Browse API returned no item title',
            });
            continue;
          }

          const product = normalizeEbayItem(item, row, now, {
            source: 'ebay-auto-import',
          });

          if (!product) {
            throw new Error('Unable to normalize eBay item');
          }

          // Auto-import must only add missing listings. The unique conflict key
          // remains a final safety guard against duplicate eBay item IDs.
          const { error } = await supabaseAdmin
            .from('products')
            .upsert(product, { onConflict: 'ebay_item_id' });

          if (error) throw error;

          inserted++;
          sample.push({
            ebayItemId: product.ebay_item_id,
            brand: product.brand,
            partNumber: product.part_number,
            modelNumber: product.model_number,
            name: product.name,
          });
        } catch (error) {
          failed++;
          sample.push({
            ebayItemId: row.ebay_item_id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    await supabaseAdmin
      .from('sync_jobs')
      .update({
        status: result.finished ? 'idle' : 'running',
        stage: result.finished ? 'done' : 'scanning_feed',
        offset_value: result.finished ? 0 : result.nextOffset,
        processed: Number(job.processed || 0) + result.scanned,
        updated: Number(job.updated || 0) + inserted,
        failed: Number(job.failed || 0) + failed,
        feed_task_id: result.finished ? null : taskId,
        finished_at: result.finished ? now : null,
        updated_at: now,
      })
      .eq('id', JOB_ID);

    return NextResponse.json({
      success: true,
      stage: result.finished ? 'done' : 'scanning_feed',
      taskId,
      totalActiveFeedItems: result.total,
      scannedThisRun: result.scanned,
      currentOffset,
      nextOffset: result.finished ? 0 : result.nextOffset,
      remaining: Math.max(result.total - result.nextOffset, 0),
      missingInChunk: missingRows.length,
      inserted,
      failed,
      sample: sample.slice(0, 10),
      message: result.finished
        ? 'Feed scan completed.'
        : 'Chunk completed. Run the route again to continue.',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    await supabaseAdmin
      .from('sync_jobs')
      .update({
        status: 'error',
        last_error: message,
        updated_at: new Date().toISOString(),
      })
      .eq('id', JOB_ID);

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
