import { NextResponse } from 'next/server';

import { supabaseAdmin } from '@/lib/supabase-admin';

import {
  getActiveBrands,
} from '@/lib/brands/repository';

import {
  BRAND_EXTRACTOR_VERSION,
  extractBrandEvidence,
} from '@/lib/brands/extractor';

import type {
  Brand,
} from '@/lib/brands/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ROUTE_VERSION =
  'TEST-BRAND-EVIDENCE-EXTRACTOR-V1';

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
    .toUpperCase();
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
  brandLookup: Map<string, Brand>
): Brand | null {
  const productBrand =
    firstTextValue(row, [
      'brand',
      'brand_name',
      'manufacturer',
      'manufacturer_name',
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
    brandLookup.get(
      normalized
    ) ?? null
  );
}

function countByValue(
  values: string[]
): Record<string, number> {
  return values.reduce<
    Record<string, number>
  >((result, value) => {
    result[value] =
      (result[value] ?? 0) + 1;

    return result;
  }, {});
}

export async function GET(
  request: Request
) {
  try {
    const url =
      new URL(request.url);

    const requestedLimit =
      Number(
        url.searchParams.get('limit')
      );

    const limit =
      Number.isFinite(requestedLimit)
        ? Math.min(
            Math.max(
              Math.floor(
                requestedLimit
              ),
              1
            ),
            500
          )
        : 100;

    const requestedOffset =
      Number(
        url.searchParams.get('offset')
      );

    const offset =
      Number.isFinite(requestedOffset)
        ? Math.max(
            Math.floor(
              requestedOffset
            ),
            0
          )
        : 0;

    const brands =
      await getActiveBrands();

    const brandLookup =
      buildBrandLookup(brands);

    /*
     * نقرأ منتجات لديها Brand معروف.
     *
     * Route للقراءة فقط:
     * لا يضيف Evidence ولا يعدل المنتجات.
     */
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
        `Failed loading known-brand products: ${error.message}`
      );
    }

    const rows =
      Array.isArray(data)
        ? data.filter(isRecord)
        : [];

    let skippedUnknownRegistryBrand =
      0;

    const extractionResults =
      rows.flatMap((row) => {
        const brand =
          findProductBrand(
            row,
            brandLookup
          );

        /*
         * المنتج لديه قيمة في brand،
         * لكن القيمة غير موجودة ضمن
         * brand_registry النشط.
         */
        if (!brand) {
          skippedUnknownRegistryBrand += 1;

          return [];
        }

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

        const extraction =
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

        return [
          {
            productId,

            productBrand:
              firstTextValue(row, [
                'brand',
                'brand_name',
              ]),

            canonicalBrand:
              brand.canonicalBrand,

            title:
              title ?? name,

            partNumber,

            manufacturer,

            candidateCount:
              extraction
                .candidates
                .length,

            rejectedCount:
              extraction
                .rejected
                .length,

            candidates:
              extraction.candidates,

            rejected:
              extraction.rejected,
          },
        ];
      });

    const allCandidates =
      extractionResults.flatMap(
        (result) =>
          result.candidates
      );

    const allRejected =
      extractionResults.flatMap(
        (result) =>
          result.rejected
      );

    const candidateTypeCounts =
      countByValue(
        allCandidates.map(
          (candidate) =>
            candidate.type
        )
      );

    const rejectionReasonCounts =
      countByValue(
        allRejected.map(
          (rejected) =>
            rejected.reason
        )
      );

    const prefixCounts =
      countByValue(
        allCandidates
          .filter(
            (candidate) =>
              candidate.type ===
              'part-prefix'
          )
          .map(
            (candidate) =>
              candidate.normalizedValue
          )
      );

    const manufacturerCounts =
      countByValue(
        allCandidates
          .filter(
            (candidate) =>
              candidate.type ===
              'manufacturer'
          )
          .map(
            (candidate) =>
              candidate.normalizedValue
          )
      );

    const topPrefixes =
      Object.entries(
        prefixCounts
      )
        .sort(
          (a, b) =>
            b[1] - a[1]
        )
        .slice(0, 30)
        .map(
          ([value, count]) => ({
            value,
            count,
          })
        );

    const topManufacturers =
      Object.entries(
        manufacturerCounts
      )
        .sort(
          (a, b) =>
            b[1] - a[1]
        )
        .slice(0, 30)
        .map(
          ([value, count]) => ({
            value,
            count,
          })
        );

    return NextResponse.json({
      success: true,

      job:
        'test-brand-evidence-extractor',

      routeVersion:
        ROUTE_VERSION,

      extractorVersion:
        BRAND_EXTRACTOR_VERSION,

      readOnly: true,

      pagination: {
        offset,
        limit,

        nextOffset:
          rows.length === limit
            ? offset + limit
            : null,
      },

      summary: {
        loadedProducts:
          rows.length,

        processedProducts:
          extractionResults.length,

        skippedUnknownRegistryBrand,

        productsWithCandidates:
          extractionResults.filter(
            (result) =>
              result.candidateCount > 0
          ).length,

        productsWithoutCandidates:
          extractionResults.filter(
            (result) =>
              result.candidateCount === 0
          ).length,

        totalCandidates:
          allCandidates.length,

        totalRejected:
          allRejected.length,

        candidateTypeCounts,

        rejectionReasonCounts,
      },

      topPrefixes,

      topManufacturers,

      results:
        extractionResults,
    });
  } catch (error) {
    console.error(
      'TEST BRAND EVIDENCE EXTRACTOR ERROR:',
      error
    );

    return NextResponse.json(
      {
        success: false,

        job:
          'test-brand-evidence-extractor',

        routeVersion:
          ROUTE_VERSION,

        extractorVersion:
          BRAND_EXTRACTOR_VERSION,

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
