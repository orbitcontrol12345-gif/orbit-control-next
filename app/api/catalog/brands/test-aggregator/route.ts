import { NextResponse } from 'next/server';

import {
  BRAND_EVIDENCE_VALIDATOR_VERSION,
  validateAggregatedEvidenceList,
} from '@/lib/brands/validator';

import {
  supabaseAdmin,
} from '@/lib/supabase-admin';

import {
  getActiveBrands,
} from '@/lib/brands/repository';

import {
  BRAND_EXTRACTOR_VERSION,
  extractBrandEvidence,
} from '@/lib/brands/extractor';

import type {
  ExtractedBrandEvidenceCandidate,
} from '@/lib/brands/extractor';

import {
  aggregateBrandEvidence,
  BRAND_AGGREGATOR_VERSION,
} from '@/lib/brands/aggregator';

import type {
  Brand,
} from '@/lib/brands/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ROUTE_VERSION =
  'TEST-BRAND-AGGREGATOR-V1';

type ProductRecord =
  Record<string, unknown>;

function isRecord(
  value: unknown
): value is ProductRecord {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  );
}

function cleanText(
  value: unknown
): string {
  if (
    typeof value !== 'string' &&
    typeof value !== 'number'
  ) {
    return '';
  }

  return String(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeText(
  value: unknown
): string {
  return cleanText(value)
    .toUpperCase()
    .replace(/[™®©]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function firstTextValue(
  row: ProductRecord,
  keys: string[]
): string | null {
  for (const key of keys) {
    const value =
      cleanText(row[key]);

    if (value) {
      return value;
    }
  }

  return null;
}

function getProductId(
  row: ProductRecord
): number | string {
  const value =
    row.id ??
    row.product_id ??
    row.ebay_item_id ??
    'unknown';

  if (
    typeof value === 'number' ||
    typeof value === 'string'
  ) {
    return value;
  }

  return String(value);
}

function buildBrandLookup(
  brands: Brand[]
): Map<string, Brand> {
  const lookup =
    new Map<string, Brand>();

  for (const brand of brands) {
    const canonical =
      normalizeText(
        brand.canonicalBrand
      );

    const normalized =
      normalizeText(
        brand.normalizedBrand
      );

    if (canonical) {
      lookup.set(
        canonical,
        brand
      );
    }

    if (normalized) {
      lookup.set(
        normalized,
        brand
      );
    }
  }

  return lookup;
}

function findProductBrand(
  row: ProductRecord,
  lookup: Map<string, Brand>
): Brand | null {
  const productBrand =
    firstTextValue(row, [
      'brand',
      'brand_name',
    ]);

  const normalized =
    normalizeText(productBrand);

  if (
    !normalized ||
    normalized === 'UNKNOWN' ||
    normalized === 'UNBRANDED' ||
    normalized === 'GENERIC'
  ) {
    return null;
  }

  return (
    lookup.get(normalized) ??
    null
  );
}

function parseInteger(
  value: string | null,
  fallback: number
): number {
  const parsed =
    Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.floor(parsed);
}

export async function GET(
  request: Request
) {
  try {
    const url =
      new URL(request.url);

    /*
     * الأفضل اختبار 500 أو 1000 منتج
     * للحصول على Purity واقعية.
     */
    const requestedLimit =
      parseInteger(
        url.searchParams.get(
          'limit'
        ),
        500
      );

    const limit =
      Math.min(
        Math.max(
          requestedLimit,
          1
        ),
        5000
      );

    const requestedOffset =
      parseInteger(
        url.searchParams.get(
          'offset'
        ),
        0
      );

    const offset =
      Math.max(
        requestedOffset,
        0
      );

    const brands =
      await getActiveBrands();

    const brandLookup =
      buildBrandLookup(brands);

    const { data, error } =
      await supabaseAdmin
        .from('products')
        .select('*')
        .not('brand', 'is', null)
        .neq('brand', 'UNKNOWN')
        .neq('brand', 'Unknown')
        .neq('brand', 'unknown')
        .order('id', {
          ascending: true,
        })
        .range(
          offset,
          offset + limit - 1
        );

    if (error) {
      throw new Error(
        `Failed loading products: ${error.message}`
      );
    }

    const rows =
      Array.isArray(data)
        ? data.filter(isRecord)
        : [];

    const candidates:
      ExtractedBrandEvidenceCandidate[] =
        [];

    let processedProducts = 0;
    let skippedProducts = 0;
    let productsWithCandidates = 0;
    let productsWithoutCandidates = 0;

    for (const row of rows) {
      const brand =
        findProductBrand(
          row,
          brandLookup
        );

      if (!brand) {
        skippedProducts += 1;
        continue;
      }

      processedProducts += 1;

      const productId =
        getProductId(row);

      const title =
        firstTextValue(row, [
          'title',
          'name',
          'product_name',
        ]);

      const name =
        firstTextValue(row, [
          'name',
          'product_name',
          'title',
        ]);

      const partNumber =
        firstTextValue(row, [
          'part_number',
          'partNumber',
          'mpn',
          'model',
          'model_number',
        ]);

      const manufacturer =
        firstTextValue(row, [
          'manufacturer',
          'manufacturer_name',
        ]);

      const result =
        extractBrandEvidence({
          productId,

          brandId:
            brand.id,

          canonicalBrand:
            brand.canonicalBrand,

          title,
          name,
          partNumber,
          manufacturer,
        });

      if (
        result.candidates.length > 0
      ) {
        productsWithCandidates += 1;

        candidates.push(
          ...result.candidates
        );
      } else {
        productsWithoutCandidates += 1;
      }
    }

    const aggregated =
  aggregateBrandEvidence(
    candidates
  );

const validated =
  validateAggregatedEvidenceList(
    aggregated
  );

const eligible =
  validated.filter(
    (item) =>
      item.validationDecision ===
      'eligible'
  );

const manualReview =
  validated.filter(
    (item) =>
      item.validationDecision ===
      'manual-review'
  );

const blocked =
  validated.filter(
    (item) =>
      item.validationDecision ===
      'blocked'
  );

const conflicts =
  validated.filter(
    (item) =>
      item.distinctBrandCount > 1
  );

const aggregatorAutoApprove =
  validated.filter(
    (item) =>
      item.recommendation ===
      'auto-approve'
  );

const preventedAutoApprove =
  aggregatorAutoApprove.filter(
    (item) =>
      item.validationDecision !==
      'eligible'
  );

    return NextResponse.json({
      success: true,

      job:
        'test-brand-evidence-aggregator',

      routeVersion:
        ROUTE_VERSION,

      extractorVersion:
        BRAND_EXTRACTOR_VERSION,

      aggregatorVersion:
        BRAND_AGGREGATOR_VERSION,
      
       validatorVersion:
       BRAND_EVIDENCE_VALIDATOR_VERSION,
      readOnly: true,

      pagination: {
        offset,
        limit,

        loaded:
          rows.length,

        nextOffset:
          rows.length === limit
            ? offset + limit
            : null,
      },

      summary: {
        loadedProducts:
          rows.length,

        processedProducts,

        skippedProducts,

        productsWithCandidates,

        productsWithoutCandidates,

        extractedCandidates:
          candidates.length,

        uniqueEvidenceValues:
          aggregated.length,

        aggregatorAutoApproveCount:
  aggregatorAutoApprove.length,

eligibleCount:
  eligible.length,

manualReviewCount:
  manualReview.length,

blockedCount:
  blocked.length,

preventedAutoApproveCount:
  preventedAutoApprove.length,

conflictCount:
  conflicts.length,
      },

      eligible:
  eligible.slice(0, 100),

manualReview:
  manualReview.slice(0, 100),

preventedAutoApprove:
  preventedAutoApprove.slice(
    0,
    100
  ),

conflicts:
  conflicts.slice(0, 100),

blocked:
  blocked.slice(0, 100),
    });
  } catch (error) {
    console.error(
      'TEST BRAND AGGREGATOR ERROR:',
      error
    );

    return NextResponse.json(
      {
        success: false,

        job:
          'test-brand-evidence-aggregator',

        routeVersion:
          ROUTE_VERSION,

        extractorVersion:
          BRAND_EXTRACTOR_VERSION,

        aggregatorVersion:
          BRAND_AGGREGATOR_VERSION,
validatorVersion:
  BRAND_EVIDENCE_VALIDATOR_VERSION,
        
        readOnly: true,

        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      {
        status: 500,
      }
    );
  }
}
