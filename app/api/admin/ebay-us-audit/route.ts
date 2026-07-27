import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';
import { getEbayToken } from '@/lib/ebay';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

const DEFAULT_PROBE_LIMIT = 100;
const MAX_PROBE_LIMIT = 500;
const CONCURRENCY = 5;
const SUPABASE_PAGE_SIZE = 1000;

const US_SITE_VALUES = new Set([
  'US',
  'USA',
  'UNITED STATES',
  'EBAY_US',
  'EBAY.COM',
]);

type FeedRow = {
  ebay_item_id: string;
  sku: string | null;
  price: number | null;
  currency: string;
  quantity: number;
  site: string | null;
};

type ProbeStatus =
  | 'CONFIRMED_EBAY_US'
  | 'EBAY_API_401'
  | 'EBAY_API_403'
  | 'EBAY_API_404'
  | 'EBAY_API_429'
  | 'EBAY_API_ERROR'
  | 'NO_TITLE'
  | 'FETCH_FAILED';

type ProbeResult = {
  ebay_item_id: string;
  success: boolean;
  http_status: number | null;
  status: ProbeStatus;
  message: string | null;
  title: string | null;
  item_web_url: string | null;
};

function decodeXml(value: string) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function getTag(xml: string, tag: string) {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match?.[1] ? decodeXml(match[1].trim()) : null;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeSite(site: string | null) {
  return String(site || '').trim().toUpperCase();
}

function isExplicitUsSite(site: string | null) {
  return US_SITE_VALUES.has(normalizeSite(site));
}

function isExplicitNonUsSite(site: string | null) {
  const normalized = normalizeSite(site);
  return Boolean(normalized) && !US_SITE_VALUES.has(normalized);
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
      `Failed to create eBay feed task (${response.status}): ${body.slice(0, 700)}`
    );
  }

  return taskId;
}

async function getTaskStatus(accessToken: string, taskId: string) {
  let lastError = '';

  for (let attempt = 1; attempt <= 3; attempt++) {
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

    if (response.ok) {
      return String(data?.status || data?.taskStatus || 'UNKNOWN');
    }

    lastError = `Failed to check eBay feed task (${response.status}): ${JSON.stringify(data).slice(0, 700)}`;

    if ((response.status === 429 || response.status >= 500) && attempt < 3) {
      const retryAfter = Number(response.headers.get('retry-after') || 0);
      await sleep(retryAfter > 0 ? retryAfter * 1000 : attempt * 2000);
      continue;
    }

    throw new Error(lastError);
  }

  throw new Error(lastError || 'Failed to check eBay feed task.');
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
      `Failed to download eBay feed (${response.status}): ${body.slice(0, 700)}`
    );
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const zip = await JSZip.loadAsync(buffer);
  const fileName = Object.keys(zip.files).find((name) => !zip.files[name].dir);

  if (!fileName) throw new Error('The downloaded eBay feed ZIP is empty.');

  const xml = await zip.files[fileName].async('string');
  const blocks = xml.match(/<SKUDetails>[\s\S]*?<\/SKUDetails>/gi) || [];

  const rawRows = blocks
    .map((block): FeedRow | null => {
      const ebayItemId = getTag(block, 'ItemID');
      if (!ebayItemId) return null;

      const priceMatch = block.match(
        /<Price\s+currencyID="([^"]+)">([^<]+)<\/Price>/i
      );

      return {
        ebay_item_id: String(ebayItemId).trim(),
        sku: getTag(block, 'SKU'),
        price: priceMatch?.[2] ? Number(priceMatch[2]) : null,
        currency: String(priceMatch?.[1] || '').trim().toUpperCase(),
        quantity: Number(getTag(block, 'Quantity') || 0),
        site:
          getTag(block, 'Site') ||
          getTag(block, 'MarketplaceID') ||
          getTag(block, 'MarketplaceId') ||
          null,
      };
    })
    .filter((row): row is FeedRow => row !== null);

  const uniqueByItemId = new Map<string, FeedRow>();

  for (const row of rawRows) {
    const current = uniqueByItemId.get(row.ebay_item_id);

    if (!current) {
      uniqueByItemId.set(row.ebay_item_id, row);
      continue;
    }

    // Prefer an explicitly identified US row if duplicate rows exist.
    if (!isExplicitUsSite(current.site) && isExplicitUsSite(row.site)) {
      uniqueByItemId.set(row.ebay_item_id, row);
    }
  }

  return {
    rawRows,
    uniqueRows: Array.from(uniqueByItemId.values()),
  };
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

async function probeUsItem(
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
            message: 'eBay US returned the item but no title was present.',
            title: null,
            item_web_url: null,
          };
        }

        return {
          ebay_item_id: ebayItemId,
          success: true,
          http_status: response.status,
          status: 'CONFIRMED_EBAY_US',
          message: null,
          title,
          item_web_url: String(data?.itemWebUrl || '').trim() || null,
        };
      }

      if ((response.status === 429 || response.status >= 500) && attempt < 3) {
        const retryAfter = Number(response.headers.get('retry-after') || 0);
        await sleep(retryAfter > 0 ? retryAfter * 1000 : attempt * 1500);
        continue;
      }

      const status: ProbeStatus =
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
          `eBay US Browse API returned HTTP ${response.status}.`
        ),
        title: null,
        item_web_url: null,
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
        item_web_url: null,
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
    item_web_url: null,
  };
}

async function probeInBatches(accessToken: string, itemIds: string[]) {
  const results: ProbeResult[] = [];

  for (let index = 0; index < itemIds.length; index += CONCURRENCY) {
    const chunk = itemIds.slice(index, index + CONCURRENCY);
    const chunkResults = await Promise.all(
      chunk.map((itemId) => probeUsItem(accessToken, itemId))
    );
    results.push(...chunkResults);
  }

  return results;
}

export async function GET(request: NextRequest) {
  try {
    const { access_token } = await getEbayToken();
    const accessToken = String(access_token || '').trim();

    if (!accessToken) throw new Error('eBay access token is empty.');

    const taskId = request.nextUrl.searchParams.get('taskId')?.trim() || null;

    if (!taskId) {
      const createdTaskId = await createFeedTask(accessToken);

      return NextResponse.json({
        success: true,
        stage: 'FEED_TASK_CREATED',
        taskId: createdTaskId,
        next: `/api/admin/ebay-us-audit?taskId=${encodeURIComponent(createdTaskId)}&probeLimit=${DEFAULT_PROBE_LIMIT}`,
        message:
          'The eBay feed task was created. Open the next URL after eBay finishes preparing it.',
        safety: {
          auditOnly: true,
          databaseWritesPerformed: false,
          marketplace: 'EBAY_US',
        },
      });
    }

    const feedStatus = await getTaskStatus(accessToken, taskId);

    if (feedStatus !== 'COMPLETED') {
      return NextResponse.json({
        success: true,
        stage: 'WAITING_FOR_FEED',
        taskId,
        ebayStatus: feedStatus,
        next: `/api/admin/ebay-us-audit?taskId=${encodeURIComponent(taskId)}&probeLimit=${DEFAULT_PROBE_LIMIT}`,
        message: 'The eBay inventory report is not ready yet.',
        safety: {
          auditOnly: true,
          databaseWritesPerformed: false,
          marketplace: 'EBAY_US',
        },
      });
    }

    const { rawRows, uniqueRows } = await downloadFeedRows(accessToken, taskId);
    const supabaseIds = await getAllSupabaseEbayItemIds();

    const explicitUsRows = uniqueRows.filter((row) => isExplicitUsSite(row.site));
    const explicitNonUsRows = uniqueRows.filter((row) =>
      isExplicitNonUsSite(row.site)
    );
    const rowsWithoutSite = uniqueRows.filter((row) => !normalizeSite(row.site));

    // If the report does not expose Site, USD is only a candidate filter.
    // Final US confirmation is still done through Browse API with EBAY_US.
    const usCandidateRows = uniqueRows.filter((row) => {
      if (isExplicitUsSite(row.site)) return true;
      if (isExplicitNonUsSite(row.site)) return false;
      return row.currency === 'USD';
    });

    const activeUsCandidates = usCandidateRows.filter((row) => row.quantity > 0);
    const missingUsCandidates = activeUsCandidates.filter(
      (row) => !supabaseIds.has(row.ebay_item_id)
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

    const rowsToProbe = missingUsCandidates.slice(0, probeLimit);
    const probeResults =
      rowsToProbe.length > 0
        ? await probeInBatches(
            accessToken,
            rowsToProbe.map((row) => row.ebay_item_id)
          )
        : [];

    const confirmedMissingUsIds = new Set(
      probeResults
        .filter((result) => result.status === 'CONFIRMED_EBAY_US')
        .map((result) => result.ebay_item_id)
    );

    const confirmedMissingUsRows = rowsToProbe
      .filter((row) => confirmedMissingUsIds.has(row.ebay_item_id))
      .map((row) => ({
        ...row,
        marketplace: 'EBAY_US' as const,
        reason: 'CONFIRMED_MISSING_FROM_SUPABASE' as const,
      }));

    const probeSummary = probeResults.reduce<Record<string, number>>(
      (summary, result) => {
        summary[result.status] = (summary[result.status] || 0) + 1;
        return summary;
      },
      {}
    );

    return NextResponse.json({
      success: true,
      stage: 'US_AUDIT_COMPLETE',
      generatedAt: new Date().toISOString(),
      taskId,
      summary: {
        totalFeedRows: rawRows.length,
        uniqueFeedItemIds: uniqueRows.length,
        duplicateFeedRowsRemoved: rawRows.length - uniqueRows.length,
        rowsWithExplicitUsSite: explicitUsRows.length,
        rowsWithExplicitNonUsSite: explicitNonUsRows.length,
        rowsWithoutSite: rowsWithoutSite.length,
        activeUsCandidates: activeUsCandidates.length,
        totalSupabaseEbayItems: supabaseIds.size,
        missingUsCandidates: missingUsCandidates.length,
        probedThisRun: probeResults.length,
        confirmedMissingUsThisRun: confirmedMissingUsRows.length,
        remainingUnprobedCandidates: Math.max(
          0,
          missingUsCandidates.length - probeResults.length
        ),
        probeSummary,
      },
      interpretation: {
        marketplaceRule:
          'Only EBAY_US is accepted. Explicit non-US marketplace rows are excluded. Rows with no Site are treated as candidates only when currency is USD and are confirmed through Browse API using X-EBAY-C-MARKETPLACE-ID=EBAY_US.',
        noCrossMarketImports: true,
        noDatabaseChanges: true,
      },
      confirmedMissingUsRows,
      probeResults,
      diagnosticSamples: {
        explicitNonUs: explicitNonUsRows.slice(0, 20),
        noSiteUsdCandidates: rowsWithoutSite
          .filter((row) => row.currency === 'USD')
          .slice(0, 20),
      },
      safety: {
        auditOnly: true,
        databaseWritesPerformed: false,
        marketplace: 'EBAY_US',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    return NextResponse.json(
      {
        success: false,
        stage: 'US_AUDIT_FAILED',
        error: message,
        safety: {
          auditOnly: true,
          databaseWritesPerformed: false,
          marketplace: 'EBAY_US',
        },
      },
      { status: 500 }
    );
  }
}
