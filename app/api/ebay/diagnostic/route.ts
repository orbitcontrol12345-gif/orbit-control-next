import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';
import { getEbayToken } from '@/lib/ebay';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;
const CONCURRENCY = 5;

type FeedRow = {
  ebay_item_id: string;
  sku: string | null;
  site_id: string;
  price: number | null;
  currency: string;
  quantity: number;
};

type DiagnosticRow = {
  ebay_item_id: string;
  browse_item_id: string | null;
  sku: string | null;
  title: string | null;
  brand_item: string | null;
  brand_aspect: string | null;
  brand_final: string;
  mpn: string;
  manufacturer_part_number: string;
  part_number_final: string;
  model: string;
  model_number: string;
  condition: string | null;
  category_path: string | null;
  marketplace: 'EBAY_US';
  site_id: string;
  price: number | null;
  currency: string;
  quantity: number;
  image_url: string | null;
  has_mpn: boolean;
  has_model: boolean;
  mpn_equals_model: boolean;
  fetch_error: string | null;
};

function stringifyError(error: unknown): string {
  if (error instanceof Error) return error.message;

  if (typeof error === 'string') return error;

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function getTag(xml: string, tag: string): string | null {
  const match = xml.match(new RegExp(`<${tag}[^>]*>(.*?)</${tag}>`, 's'));
  return match?.[1]?.trim() || null;
}

function normalizeValue(value: unknown): string {
  return String(value ?? '').trim();
}

function normalizeKey(value: unknown): string {
  return normalizeValue(value).toUpperCase().replace(/\s+/g, ' ');
}

function isUsefulIdentifier(value: unknown): boolean {
  const normalized = normalizeKey(value);

  if (!normalized) return false;

  return !/^(DOES NOT APPLY|NOT APPLICABLE|N\/?A|NA|NONE|UNKNOWN|UNBRANDED)$/i.test(
    normalized
  );
}

function getAspectValues(item: any, names: string[]): string[] {
  const aspects = Array.isArray(item?.localizedAspects)
    ? item.localizedAspects
    : [];

  const acceptedNames = new Set(
    names.map((name) => normalizeKey(name).toLowerCase())
  );

  return aspects
    .filter((aspect: any) =>
      acceptedNames.has(normalizeKey(aspect?.name).toLowerCase())
    )
    .map((aspect: any) => normalizeValue(aspect?.value))
    .filter(Boolean);
}

function getFirstUsefulAspect(item: any, names: string[]): string {
  const values = getAspectValues(item, names);
  return values.find(isUsefulIdentifier) || '';
}

async function createFeedTask(accessToken: string): Promise<string> {
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

  if (!response.ok || !taskId) {
    const body = await response.text().catch(() => '');
    throw new Error(
      `Failed to create eBay feed task (${response.status}): ${body || 'No response body'}`
    );
  }

  return taskId;
}

async function getTaskStatus(
  accessToken: string,
  taskId: string
): Promise<string> {
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
      `Failed to check eBay feed task (${response.status}): ${JSON.stringify(data)}`
    );
  }

  return data?.status || data?.taskStatus || 'UNKNOWN';
}

async function downloadFeedRows(
  accessToken: string,
  taskId: string
): Promise<{
  rawSkuDetails: number;
  usActiveRows: FeedRow[];
  nonUsRows: number;
  zeroQuantityRows: number;
  nonUsdRows: number;
}> {
  const response = await fetch(
    `https://api.ebay.com/sell/feed/v1/task/${encodeURIComponent(
      taskId
    )}/download_result_file`,
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
      `Failed to download eBay feed (${response.status}): ${body || 'No response body'}`
    );
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const zip = await JSZip.loadAsync(buffer);

  const fileName = Object.keys(zip.files).find(
    (name) => !zip.files[name].dir
  );

  if (!fileName) {
    throw new Error('The downloaded eBay ZIP file does not contain an XML file.');
  }

  const xml = await zip.files[fileName].async('string');
  const blocks = xml.match(/<SKUDetails>[\s\S]*?<\/SKUDetails>/g) || [];

  const parsedRows: FeedRow[] = [];

  for (const block of blocks) {
    const ebayItemId = getTag(block, 'ItemID');
    if (!ebayItemId) continue;

    const priceMatch = block.match(
      /<Price currencyID="([^"]+)">([^<]+)<\/Price>/
    );

    parsedRows.push({
      ebay_item_id: normalizeValue(ebayItemId),
      sku: getTag(block, 'SKU'),
      site_id: normalizeValue(getTag(block, 'SiteID')),
      price: priceMatch?.[2] ? Number(priceMatch[2]) : null,
      currency: normalizeValue(priceMatch?.[1] || ''),
      quantity: Number(getTag(block, 'Quantity') || 0),
    });
  }

  const nonUsRows = parsedRows.filter((row) => row.site_id !== '0').length;
  const zeroQuantityRows = parsedRows.filter((row) => row.quantity <= 0).length;
  const nonUsdRows = parsedRows.filter(
    (row) => row.currency && row.currency !== 'USD'
  ).length;

  const usActiveRows = parsedRows.filter(
    (row) =>
      row.site_id === '0' &&
      row.currency === 'USD' &&
      row.quantity > 0
  );

  return {
    rawSkuDetails: blocks.length,
    usActiveRows,
    nonUsRows,
    zeroQuantityRows,
    nonUsdRows,
  };
}

async function fetchEbayItem(
  accessToken: string,
  ebayItemId: string
): Promise<any> {
  const response = await fetch(
    `https://api.ebay.com/buy/browse/v1/item/get_item_by_legacy_id?legacy_item_id=${encodeURIComponent(
      ebayItemId
    )}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
        'Accept-Language': 'en-US',
      },
      cache: 'no-store',
    }
  );

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      `Browse API ${response.status}: ${JSON.stringify(body)}`
    );
  }

  return body;
}

function buildDiagnosticRow(
  feedRow: FeedRow,
  item: any,
  fetchError: string | null
): DiagnosticRow {
  const brandItem = normalizeValue(item?.brand);
  const brandAspect = getFirstUsefulAspect(item, ['Brand']);

  const mpn = getFirstUsefulAspect(item, ['MPN']);
  const manufacturerPartNumber = getFirstUsefulAspect(item, [
    'Manufacturer Part Number',
  ]);

  const model = getFirstUsefulAspect(item, ['Model']);
  const modelNumber = getFirstUsefulAspect(item, ['Model Number']);

  const finalPartNumber =
    [mpn, manufacturerPartNumber].find(isUsefulIdentifier) || 'UNKNOWN';

  const finalModel =
    [model, modelNumber].find(isUsefulIdentifier) || 'UNKNOWN';

  const finalBrand =
    [brandItem, brandAspect].find(isUsefulIdentifier) || 'UNKNOWN';

  const imageUrl =
    item?.image?.imageUrl ||
    item?.thumbnailImages?.[0]?.imageUrl ||
    item?.additionalImages?.[0]?.imageUrl ||
    null;

  return {
    ebay_item_id: feedRow.ebay_item_id,
    browse_item_id: normalizeValue(item?.itemId) || null,
    sku: feedRow.sku,
    title: normalizeValue(item?.title) || null,
    brand_item: brandItem || null,
    brand_aspect: brandAspect || null,
    brand_final: finalBrand,
    mpn: mpn || 'UNKNOWN',
    manufacturer_part_number: manufacturerPartNumber || 'UNKNOWN',
    part_number_final: finalPartNumber,
    model: model || 'UNKNOWN',
    model_number: modelNumber || 'UNKNOWN',
    condition: normalizeValue(item?.condition) || null,
    category_path: normalizeValue(item?.categoryPath) || null,
    marketplace: 'EBAY_US',
    site_id: feedRow.site_id,
    price: feedRow.price,
    currency: feedRow.currency,
    quantity: feedRow.quantity,
    image_url: imageUrl,
    has_mpn: finalPartNumber !== 'UNKNOWN',
    has_model: finalModel !== 'UNKNOWN',
    mpn_equals_model:
      finalPartNumber !== 'UNKNOWN' &&
      finalModel !== 'UNKNOWN' &&
      normalizeKey(finalPartNumber) === normalizeKey(finalModel),
    fetch_error: fetchError,
  };
}

function buildDuplicateGroups(
  rows: DiagnosticRow[],
  field: 'part_number_final' | 'model'
) {
  const groups = new Map<string, DiagnosticRow[]>();

  for (const row of rows) {
    const rawValue =
      field === 'part_number_final'
        ? row.part_number_final
        : row.model !== 'UNKNOWN'
          ? row.model
          : row.model_number;

    const key = normalizeKey(rawValue);

    if (!key || key === 'UNKNOWN') continue;

    const existing = groups.get(key) || [];
    existing.push(row);
    groups.set(key, existing);
  }

  return [...groups.entries()]
    .filter(([, groupedRows]) => {
      const uniqueItemIds = new Set(
        groupedRows.map((row) => row.ebay_item_id)
      );
      return uniqueItemIds.size > 1;
    })
    .map(([value, groupedRows]) => ({
      value,
      count: groupedRows.length,
      ebay_item_ids: groupedRows.map((row) => row.ebay_item_id),
      skus: groupedRows.map((row) => row.sku),
      titles: groupedRows.map((row) => row.title),
      parts: groupedRows.map((row) => row.part_number_final),
      models: groupedRows.map((row) =>
        row.model !== 'UNKNOWN' ? row.model : row.model_number
      ),
    }))
    .sort((a, b) => b.count - a.count);
}

export async function GET(req: NextRequest) {
  try {
    const requestedLimit = Number(
      req.nextUrl.searchParams.get('limit') || DEFAULT_LIMIT
    );

    const limit = Math.min(
      Math.max(Number.isFinite(requestedLimit) ? requestedLimit : DEFAULT_LIMIT, 1),
      MAX_LIMIT
    );

    const offset = Math.max(
      Number(req.nextUrl.searchParams.get('offset') || 0),
      0
    );

    const taskIdParam = normalizeValue(
      req.nextUrl.searchParams.get('taskId')
    );

    const { access_token } = await getEbayToken();
    const accessToken = normalizeValue(access_token);

    if (!accessToken) {
      throw new Error('eBay access token is empty.');
    }

    if (!taskIdParam) {
      const taskId = await createFeedTask(accessToken);

      return NextResponse.json({
        success: true,
        readOnly: true,
        stage: 'created_feed_task',
        taskId,
        message:
          'Diagnostic feed task created. Run this route again with ?taskId=YOUR_TASK_ID after eBay completes the task.',
        nextUrl: `/api/ebay/diagnostic?taskId=${encodeURIComponent(
          taskId
        )}&limit=${limit}&offset=${offset}`,
      });
    }

    const status = await getTaskStatus(accessToken, taskIdParam);

    if (status !== 'COMPLETED') {
      return NextResponse.json({
        success: true,
        readOnly: true,
        stage: 'waiting_feed',
        taskId: taskIdParam,
        ebayStatus: status,
        message:
          'The diagnostic route has not modified Supabase. Run the same URL again after the feed is completed.',
      });
    }

    const feed = await downloadFeedRows(accessToken, taskIdParam);

    const uniqueFeedMap = new Map<string, FeedRow>();
    let duplicatesRemovedByItemId = 0;

    for (const row of feed.usActiveRows) {
      if (uniqueFeedMap.has(row.ebay_item_id)) {
        duplicatesRemovedByItemId++;
        continue;
      }

      uniqueFeedMap.set(row.ebay_item_id, row);
    }

    const uniqueRows = [...uniqueFeedMap.values()];
    const selectedRows = uniqueRows.slice(offset, offset + limit);
    const diagnosticRows: DiagnosticRow[] = [];

    for (let i = 0; i < selectedRows.length; i += CONCURRENCY) {
      const chunk = selectedRows.slice(i, i + CONCURRENCY);

      const results = await Promise.allSettled(
        chunk.map((row) => fetchEbayItem(accessToken, row.ebay_item_id))
      );

      for (let index = 0; index < chunk.length; index++) {
        const feedRow = chunk[index];
        const result = results[index];

        if (result.status === 'fulfilled') {
          diagnosticRows.push(
            buildDiagnosticRow(feedRow, result.value, null)
          );
        } else {
          diagnosticRows.push(
            buildDiagnosticRow(
              feedRow,
              null,
              stringifyError(result.reason)
            )
          );
        }
      }
    }

    const sameMpnDifferentItemIds = buildDuplicateGroups(
      diagnosticRows,
      'part_number_final'
    );

    const sameModelDifferentItemIds = buildDuplicateGroups(
      diagnosticRows,
      'model'
    );

    const summary = {
      rawSkuDetails: feed.rawSkuDetails,
      usActiveFeedRows: feed.usActiveRows.length,
      uniqueUsActiveItems: uniqueRows.length,
      duplicatesRemovedByEbayItemId,
      excludedNonUsRows: feed.nonUsRows,
      excludedZeroQuantityRows: feed.zeroQuantityRows,
      excludedNonUsdRows: feed.nonUsdRows,
      sampleOffset: offset,
      sampleLimit: limit,
      sampleReturned: diagnosticRows.length,
      successfulBrowseFetches: diagnosticRows.filter(
        (row) => !row.fetch_error
      ).length,
      failedBrowseFetches: diagnosticRows.filter(
        (row) => row.fetch_error
      ).length,
      withMpn: diagnosticRows.filter((row) => row.has_mpn).length,
      withoutMpn: diagnosticRows.filter((row) => !row.has_mpn).length,
      withModel: diagnosticRows.filter((row) => row.has_model).length,
      withoutModel: diagnosticRows.filter((row) => !row.has_model).length,
      brandFromItem: diagnosticRows.filter(
        (row) => Boolean(row.brand_item)
      ).length,
      brandFromAspectOnly: diagnosticRows.filter(
        (row) => !row.brand_item && Boolean(row.brand_aspect)
      ).length,
      withoutBrand: diagnosticRows.filter(
        (row) => row.brand_final === 'UNKNOWN'
      ).length,
      mpnEqualsModel: diagnosticRows.filter(
        (row) => row.mpn_equals_model
      ).length,
      sameMpnDifferentItemIdGroups: sameMpnDifferentItemIds.length,
      sameModelDifferentItemIdGroups: sameModelDifferentItemIds.length,
    };

    return NextResponse.json({
      success: true,
      readOnly: true,
      stage: 'diagnostic_complete',
      taskId: taskIdParam,
      summary,
      duplicateGroups: {
        sameMpnDifferentItemIds,
        sameModelDifferentItemIds,
      },
      rows: diagnosticRows,
      pagination: {
        currentOffset: offset,
        nextOffset:
          offset + selectedRows.length < uniqueRows.length
            ? offset + selectedRows.length
            : null,
        remaining: Math.max(
          uniqueRows.length - (offset + selectedRows.length),
          0
        ),
        nextUrl:
          offset + selectedRows.length < uniqueRows.length
            ? `/api/ebay/diagnostic?taskId=${encodeURIComponent(
                taskIdParam
              )}&limit=${limit}&offset=${offset + selectedRows.length}`
            : null,
      },
      safety:
        'This route is read-only. It does not insert, update, reactivate, deactivate, or delete Supabase products.',
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        readOnly: true,
        error: stringifyError(error),
        safety:
          'The diagnostic route does not write to the products table.',
      },
      { status: 500 }
    );
  }
}
