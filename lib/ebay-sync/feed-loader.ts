import { supabaseAdmin } from '@/lib/supabase-admin';

import {
  createActiveInventoryTask,
  downloadActiveInventoryFeed,
  getFeedTaskStatus,
} from './ebay-api';

import type {
  EbayFeedRunRecord,
  EbayRawFeedRecord,
  FeedLoaderReport,
} from './types';

const DEFAULT_BATCH_SIZE = 500;
const MAX_BATCH_SIZE = 1000;

function nowIso(): string {
  return new Date().toISOString();
}

function stringifyError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

async function getRun(
  taskId: string
): Promise<EbayFeedRunRecord | null> {
  const { data, error } = await supabaseAdmin
    .from('ebay_feed_runs')
    .select('*')
    .eq('feed_task_id', taskId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as EbayFeedRunRecord | null;
}

async function saveRun(
  taskId: string,
  patch: Partial<EbayFeedRunRecord>
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('ebay_feed_runs')
    .upsert(
      {
        feed_task_id: taskId,
        updated_at: nowIso(),
        ...patch,
      },
      {
        onConflict: 'feed_task_id',
      }
    );

  if (error) {
    throw error;
  }
}

export async function startFeedLoader(
  accessToken: string
): Promise<FeedLoaderReport> {
  const taskId = await createActiveInventoryTask(accessToken);
  const now = nowIso();

  await saveRun(taskId, {
    status: 'created_feed_task',
    ebay_status: null,
    total_rows: 0,
    saved_rows: 0,
    failed_rows: 0,
    next_offset: 0,
    file_name: null,
    started_at: now,
    completed_at: null,
    last_error: null,
  });

  return {
    feedTaskId: taskId,
    stage: 'created_feed_task',
    ebayStatus: null,
    totalRows: 0,
    savedRows: 0,
    failedRows: 0,
    nextOffset: 0,
    remaining: 0,
    batchSize: 0,
  };
}

export async function continueFeedLoader(params: {
  accessToken: string;
  taskId: string;
  batchSize?: number;
}): Promise<FeedLoaderReport> {
  const batchSize = Math.min(
    Math.max(
      params.batchSize || DEFAULT_BATCH_SIZE,
      1
    ),
    MAX_BATCH_SIZE
  );

  const existingRun = await getRun(params.taskId);

  if (!existingRun) {
    throw new Error(
      `Feed run ${params.taskId} does not exist in ebay_feed_runs.`
    );
  }

  try {
    const ebayStatus = await getFeedTaskStatus(
      params.accessToken,
      params.taskId
    );

    if (ebayStatus !== 'COMPLETED') {
      await saveRun(params.taskId, {
        status: 'waiting_feed',
        ebay_status: ebayStatus,
        last_error: null,
      });

      return {
        feedTaskId: params.taskId,
        stage: 'waiting_feed',
        ebayStatus,
        totalRows: existingRun.total_rows || 0,
        savedRows: existingRun.saved_rows || 0,
        failedRows: existingRun.failed_rows || 0,
        nextOffset: existingRun.next_offset || 0,
        remaining: Math.max(
          (existingRun.total_rows || 0) -
            (existingRun.next_offset || 0),
          0
        ),
        batchSize,
      };
    }

    const feed = await downloadActiveInventoryFeed(
      params.accessToken,
      params.taskId
    );

    const offset = existingRun.next_offset || 0;

    const batch = feed.rows.slice(
      offset,
      offset + batchSize
    );

    const importedAt = nowIso();

    const records: EbayRawFeedRecord[] = batch.map(
      (row) => ({
        feed_task_id: params.taskId,
        row_index: row.rowIndex,
        ebay_item_id: row.ebayItemId,
        sku: row.sku,
        quantity: row.quantity,
        price: row.price,
        currency: row.currency,
        raw_xml: row.rawXml,
        imported_at: importedAt,
      })
    );

    if (records.length > 0) {
      const { error } = await supabaseAdmin
        .from('ebay_feed_raw')
        .upsert(records, {
          onConflict: 'feed_task_id,row_index',
          ignoreDuplicates: false,
        });

      if (error) {
        throw error;
      }
    }

    const nextOffset = offset + records.length;
    const completed = nextOffset >= feed.rows.length;

    await saveRun(params.taskId, {
      status: completed
        ? 'completed'
        : 'saving_raw_feed',
      ebay_status: ebayStatus,
      total_rows: feed.rows.length,
      saved_rows: nextOffset,
      failed_rows: existingRun.failed_rows || 0,
      next_offset: nextOffset,
      file_name: feed.fileName,
      completed_at: completed ? importedAt : null,
      last_error: null,
    });

    return {
      feedTaskId: params.taskId,
      stage: completed
        ? 'completed'
        : 'saving_raw_feed',
      ebayStatus,
      totalRows: feed.rows.length,
      savedRows: nextOffset,
      failedRows: existingRun.failed_rows || 0,
      nextOffset,
      remaining: Math.max(
        feed.rows.length - nextOffset,
        0
      ),
      batchSize,
    };
  } catch (error) {
    const message = stringifyError(error);

    await saveRun(params.taskId, {
      status: 'error',
      last_error: message,
    });

    throw new Error(message);
  }
}
