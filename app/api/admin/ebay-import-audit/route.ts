import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';
import { getEbayToken } from '@/lib/ebay';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DEFAULT_PROBE_LIMIT = 100;
const MAX_PROBE_LIMIT = 500;
const CONCURRENCY = 5;
const SUPABASE_PAGE_SIZE = 1000;

type FeedRow = {
  ebay_item_id: string;
  sku: string | null;
  price: number | null;
  currency: string;
  quantity: number;
};

type MissingReason =
  | 'READY_TO_IMPORT'
  | 'EXCLUDED_NON_USD'
  | 'EXCLUDED_ZERO_QUANTITY';

type ProbeResult = {
  ebay_item_id: string;
  success: boolean;
  http_status: number | null;
  status:
    | 'READY_TO_IMPORT'
    | 'EBAY_API_401'
    | 'EBAY_API_403'
    | 'EBAY_API_404'
    | 'EBAY_API_429'
    | 'EBAY_API_ERROR'
    | 'NO_TITLE'
    | 'FETCH_FAILED';
  message: string | null;
  title: string | null;
};

function getTag(xml: string, tag: string) {
  const match = xml.match(new RegExp(`<${tag}[^>]*>(.*?)</${tag}>`, 's'));
  return match?.[1]?.trim() || null;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function createFeedTask(accessToken: string) {
  const response = await fetch(
    'https://api.ebay.com/sell/feed/v1/inventory_task',
    {
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
      cache: 'no-store',
    }
  );

  const location = response.headers.get('location');
  const taskId = location?.split('/').pop() || null;
  const body = await response.text().catch(() => '');

  if (!response.ok || !taskId) {
    throw new Error(
      `Failed to create eBay feed task (${response.status}): ${body.slice(0, 500)}`
    );
  }

  return taskId;
}

async function getTaskStatus(accessToken: string, taskId: string) {
  const response = await fetch(
    `https://api.ebay.com/sell/feed/v1/task/${encodeURIComponent(taskId)}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Accept-Language': 'en-US',
      },
      cache: 'no-store',
    }
  );

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      `Failed to check eBay feed task (${response.status}): ${JSON.stringify(data).slice(0, 500)}`
    );
  }

  return String(data?.status || data?.taskStatus || 'UNKNOWN');
}

async function downloadFeedRows(accessToken: string, taskId: string) {
  const response = await fetch(
    `https://api.ebay.com/sell/feed/v1/task/${encodeURIComponent(taskId)}/download_result_file`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Accept-Language': 'en-US',
      },
      cache: 'no-store',
    }
  );

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(
      `Failed to download eBay feed (${response.status}): ${body.slice(0, 500)}`
    );
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const zip = await JSZip.loadAsync(buffer);
  const fileName = Object.keys(zip.files).find((name) => !zip.files[name].dir);

  if (!fileName) {
    throw new Error('The downloaded eBay feed ZIP is empty.');
  }

  const xml = await zip.files[fileName].async('string');
  const blocks = xml.match(/<SKUDetails>[\s\S]*?<\/SKUDetails>/g) || [];

  const rows = blocks
    .map((block): FeedRow | null => {
      const ebayItemId = getTag(block, 'ItemID');
      if (!ebayItemId) return null;

      const priceMatch = block.match(
        /<Price currencyID="([^"]+)">([^<]+)<\/Price>/
      );

      return {
        ebay_item_id: String(ebayItemId).trim(),
        sku: getTag(block, 'SKU'),
        price: priceMatch?.[2] ? Number(priceMatch[2]) : null,
        currency: String(priceMatch?.[1] || 'USD').trim().toUpperCase(),
        quantity: Number(getTag(block, 'Quantity') || 0),
      };
    })
    .filter((row): row is FeedRow => row !== null);

  // A defensive de-duplication in case the feed contains the same Item ID twice.
  const unique = new Map<string, FeedRow>();
  for (const row of rows) unique.set(row.ebay_item_id, row);

  return Array.from(unique.values());
}

async function getAllSupabaseEbayItemIds() {
  const ids = new Set<string>();

  for (let from = 0; ; from += SUPABASE_PAGE_SIZE) {
    const to = from + SUPABASE_PAGE_SIZE - 1;

    const { data, error } = await supabaseAdmin
      .from('products')
      .select('ebay_item_id')
      .not('ebay_item_id', 'is', null)
      .range(from, to);

    if (error) throw error;

    for (const row of data || []) {
      const id = String(row.ebay_item_id || '').trim();
      if (id) ids.add(id);
    }

    if (!data || data.length < SUPABASE_PAGE_SIZE) break;
  }

  return ids;
}

function classifyMissingRow(row: FeedRow): MissingReason {
  if (row.quantity <= 0) return 'EXCLUDED_ZERO_QUANTITY';
  if (row.currency !== 'USD') return 'EXCLUDED_NON_USD';
  return 'READY_TO_IMPORT';
}

function extractEbayErrorMessage(data: any, fallback: string) {
  const error = Array.isArray(data?.errors) ? data.errors[0] : null;

  return String(
    error?.longMessage ||
      error?.message ||
      data?.message ||
      data?.error_description ||
      fallback
  ).slice(0, 1000);
}

async function probeEbayItem(
  accessToken: string,
  ebayItemId: string
): Promise<ProbeResult> {
  const url =
    'https://api.ebay.com/buy/browse/v1/item/get_item_by_legacy_id' +
    `?legacy_item_id=${encodeURIComponent(ebayItemId)}`;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
          'Accept-Language': 'en-US',
        },
        cache: 'no-store',
      });

      const data = await response.json().catch(() => null);

      if (response.ok) {
        const title = String(data?.title || '').trim();

        if (!title) {
          return {
            ebay_item_id: ebayItemId,
            success: false,
            http_status: response.status,
            status: 'NO_TITLE',
            message: 'eBay returned the item but no title was present.',
            title: null,
          };
        }

        return {
          ebay_item_id: ebayItemId,
          success: true,
          http_status: response.status,
          status: 'READY_TO_IMPORT',
          message: null,
          title,
        };
      }

      const retryable = response.status === 429 || response.status >= 500;

      if (retryable && attempt < 3) {
        const retryAfter = Number(response.headers.get('retry-after') || 0);
        const delay = retryAfter > 0 ? retryAfter * 1000 : attempt * 1500;
        await sleep(delay);
        continue;
      }

      const status: ProbeResult['status'] =
        response.status === 401
          ? 'EBAY_API_401'
          : response.status === 403
            ? 'EBAY_API_403'
            : response.status === 404
              ? 'EBAY_API_404'
              : response.status === 429
                ? 'EBAY_API_429'
                : 'EBAY_API_ERROR';

      return {
        ebay_item_id: ebayItemId,
        success: false,
        http_status: response.status,
        status,
        message: extractEbayErrorMessage(
          data,
          `eBay API returned HTTP ${response.status}.`
        ),
        title: null,
      };
    } catch (error) {
      if (attempt < 3) {
        await sleep(attempt * 1500);
        continue;
      }

      return {
        ebay_item_id: ebayItemId,
        success: false,
        http_status: null,
        status: 'FETCH_FAILED',
        message: error instanceof Error ? error.message : String(error),
        title: null,
      };
    }
  }

  return {
    ebay_item_id: ebayItemId,
    success: false,
    http_status: null,
    status: 'FETCH_FAILED',
    message: 'Unexpected probe termination.',
    title: null,
  };
}

async function probeInBatches(
  accessToken: string,
  itemIds: string[]
): Promise<ProbeResult[]> {
  const results: ProbeResult[] = [];

  for (let index = 0; index < itemIds.length; index += CONCURRENCY) {
    const chunk = itemIds.slice(index, index + CONCURRENCY);
    const chunkResults = await Promise.all(
      chunk.map((itemId) => probeEbayItem(accessToken, itemId))
    );
    results.push(...chunkResults);
  }

  return results;
}

export async function GET(request: NextRequest) {
  try {
    const { access_token } = await getEbayToken();
    const accessToken = String(access_token || '').trim();

    if (!accessToken) {
      throw new Error('eBay access token is empty.');
    }

    const taskId = request.nextUrl.searchParams.get('taskId')?.trim() || null;

    if (!taskId) {
      const createdTaskId = await createFeedTask(accessToken);

      return NextResponse.json({
        success: true,
        stage: 'FEED_TASK_CREATED',
        taskId: createdTaskId,
        next:
          `/api/admin/ebay-import-audit?taskId=${encodeURIComponent(createdTaskId)}`,
        message:
          'The eBay feed task was created. Call the next URL after eBay finishes preparing it.',
      });
    }

    const feedStatus = await getTaskStatus(accessToken, taskId);

    if (feedStatus !== 'COMPLETED') {
      return NextResponse.json({
        success: true,
        stage: 'WAITING_FOR_FEED',
        taskId,
        ebayStatus: feedStatus,
        message: 'The eBay inventory report is not ready yet.',
      });
    }

    const feedRows = await downloadFeedRows(accessToken, taskId);
    const supabaseIds = await getAllSupabaseEbayItemIds();

    const missingRows = feedRows
      .filter((row) => !supabaseIds.has(row.ebay_item_id))
      .map((row) => ({
        ...row,
        reason: classifyMissingRow(row),
      }));

    const readyToImport = missingRows.filter(
      (row) => row.reason === 'READY_TO_IMPORT'
    );

    const requestedProbeLimit = Number(
      request.nextUrl.searchParams.get('probeLimit') || DEFAULT_PROBE_LIMIT
    );
    const probeLimit = Math.max(
      0,
      Math.min(
        Number.isFinite(requestedProbeLimit)
          ? requestedProbeLimit
          : DEFAULT_PROBE_LIMIT,
        MAX_PROBE_LIMIT
      )
    );

    const probeResults =
      probeLimit > 0
        ? await probeInBatches(
            accessToken,
            readyToImport
              .slice(0, probeLimit)
              .map((row) => row.ebay_item_id)
          )
        : [];

    const probeSummary = probeResults.reduce<Record<string, number>>(
      (summary, result) => {
        summary[result.status] = (summary[result.status] || 0) + 1;
        return summary;
      },
      {}
    );

    return NextResponse.json({
      success: true,
      stage: 'AUDIT_COMPLETE',
      generatedAt: new Date().toISOString(),
      taskId,
      summary: {
        totalEbayFeedItems: feedRows.length,
        totalSupabaseEbayItems: supabaseIds.size,
        missingFromSupabase: missingRows.length,
        readyToImport: readyToImport.length,
        excludedNonUsd: missingRows.filter(
          (row) => row.reason === 'EXCLUDED_NON_USD'
        ).length,
        excludedZeroQuantity: missingRows.filter(
          (row) => row.reason === 'EXCLUDED_ZERO_QUANTITY'
        ).length,
        probed: probeResults.length,
        probeSummary,
      },
      missingRows,
      probeResults,
      safety: {
        auditOnly: true,
        databaseWritesPerformed: false,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    return NextResponse.json(
      {
        success: false,
        stage: 'AUDIT_FAILED',
        error: message,
        safety: {
          auditOnly: true,
          databaseWritesPerformed: false,
        },
      },
      { status: 500 }
    );
  }
}
