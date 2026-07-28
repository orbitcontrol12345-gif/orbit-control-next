export type EbayMarketplace =
  | 'EBAY_US'
  | 'EBAY_CA'
  | 'EBAY_GB'
  | 'EBAY_DE'
  | 'EBAY_AU'
  | 'UNKNOWN';

export type EbayFeedStage =
  | 'idle'
  | 'created_feed_task'
  | 'waiting_feed'
  | 'downloading_feed'
  | 'saving_raw_feed'
  | 'completed'
  | 'error';

export interface EbayFeedRow {
  ebayItemId: string;
  sku: string | null;
  quantity: number;
  price: number | null;
  currency: string | null;
  rawXml: string;
  rowIndex: number;
}

export interface EbayFeedDownloadResult {
  taskId: string;
  fileName: string;
  totalSkuDetails: number;
  rows: EbayFeedRow[];
}

export interface EbayRawFeedRecord {
  feed_task_id: string;
  row_index: number;
  ebay_item_id: string;
  sku: string | null;
  quantity: number;
  price: number | null;
  currency: string | null;
  raw_xml: string;
  imported_at: string;
}

export interface EbayFeedRunRecord {
  feed_task_id: string;
  status: EbayFeedStage;
  ebay_status: string | null;
  total_rows: number;
  saved_rows: number;
  failed_rows: number;
  next_offset: number;
  file_name: string | null;
  started_at: string;
  completed_at: string | null;
  updated_at: string;
  last_error: string | null;
}

export interface FeedLoaderReport {
  feedTaskId: string;
  stage: EbayFeedStage;
  ebayStatus: string | null;
  totalRows: number;
  savedRows: number;
  failedRows: number;
  nextOffset: number;
  remaining: number;
  batchSize: number;
}
