import JSZip from 'jszip';

import type { EbayFeedDownloadResult } from './types';
import { parseActiveInventoryXml } from './parser';

function formatUnknownError(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export async function createActiveInventoryTask(
  accessToken: string
): Promise<string> {
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

  const taskId =
    location?.split('/').filter(Boolean).pop() || null;

  if (!response.ok || !taskId) {
    const body = await response.text().catch(() => '');

    throw new Error(
      `Failed to create eBay feed task (${response.status}): ${body}`
    );
  }

  return taskId;
}

export async function getFeedTaskStatus(
  accessToken: string,
  taskId: string
): Promise<string> {
  const response = await fetch(
    `https://api.ebay.com/sell/feed/v1/task/${encodeURIComponent(taskId)}`,
    {
      method: 'GET',
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
      `Failed to read eBay feed task (${response.status}): ${formatUnknownError(
        data
      )}`
    );
  }

  return data?.status || data?.taskStatus || 'UNKNOWN';
}

export async function downloadActiveInventoryFeed(
  accessToken: string,
  taskId: string
): Promise<EbayFeedDownloadResult> {
  const response = await fetch(
    `https://api.ebay.com/sell/feed/v1/task/${encodeURIComponent(
      taskId
    )}/download_result_file`,
    {
      method: 'GET',
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
      `Failed to download eBay feed (${response.status}): ${body}`
    );
  }

  const zipBuffer = Buffer.from(
    await response.arrayBuffer()
  );

  const zip = await JSZip.loadAsync(zipBuffer);

  const fileName = Object.keys(zip.files).find(
    (name) => !zip.files[name].dir
  );

  if (!fileName) {
    throw new Error(
      'The eBay ZIP file does not contain a feed file.'
    );
  }

  const xml = await zip.files[fileName].async('string');

  const rows = parseActiveInventoryXml(xml);

  return {
    taskId,
    fileName,
    totalSkuDetails: rows.length,
    rows,
  };
}
