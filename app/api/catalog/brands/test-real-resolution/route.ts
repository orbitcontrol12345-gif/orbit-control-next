import { NextResponse } from 'next/server';
import {
  resolveUnknownBrands,
} from '@/lib/brands/unknown-resolver';
import { supabaseAdmin } from '@/lib/supabase-admin';

import {
  getActiveBrands,
  getApprovedEvidence,
} from '@/lib/brands/repository';

import {
  buildBrandDictionary,
} from '@/lib/brands/dictionary';

import type {
  BrandScoringProduct,
} from '@/lib/brands/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ROUTE_VERSION =
  'TEST-REAL-BRAND-RESOLUTION-V1';

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  );
}

function stringValue(
  value: unknown
): string | null {
  if (
    typeof value === 'string' ||
    typeof value === 'number'
  ) {
    const result =
      String(value).trim();

    return result || null;
  }

  return null;
}

function firstValue(
  row: Record<string, unknown>,
  keys: string[]
): string | null {
  for (const key of keys) {
    const result =
      stringValue(row[key]);

    if (result) {
      return result;
    }
  }

  return null;
}

function mapProduct(
  row: Record<string, unknown>
): BrandScoringProduct {
  return {
    id:
      row.id == null
        ? undefined
        : String(row.id),

    name:
      firstValue(row, [
        'name',
        'product_name',
      ]),

    title:
      firstValue(row, [
        'title',
        'name',
        'product_name',
      ]),

    partNumber:
      firstValue(row, [
        'part_number',
        'partNumber',
        'mpn',
        'model',
      ]),

    manufacturer:
      firstValue(row, [
        'manufacturer',
        'manufacturer_name',
      ]),

    existingBrand:
      firstValue(row, [
        'brand',
        'brand_name',
      ]),
  };
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

    const [brands, evidence] =
      await Promise.all([
        getActiveBrands(),
        getApprovedEvidence(),
      ]);

    const dictionary =
      buildBrandDictionary(
        brands,
        evidence
      );

    /*
     * قراءة منتجات UNKNOWN فقط.
     * هذا Route لا يعدل قاعدة البيانات.
     */
    const { data, error } =
      await supabaseAdmin
        .from('products')
        .select('*')
        .or(
          [
            'brand.is.null',
            'brand.eq.UNKNOWN',
            'brand.eq.Unknown',
            'brand.eq.unknown',
          ].join(',')
        )
        .order('id', {
          ascending: true,
        })
        .limit(limit);

    if (error) {
      throw new Error(
        `Failed loading UNKNOWN products: ${error.message}`
      );
    }

    const rows =
      Array.isArray(data)
        ? data.filter(isRecord)
        : [];

    const products = rows.map(mapProduct);

const resolutionBatch =
  resolveUnknownBrands(
    products
      .filter(
        (product): product is {
          id: number | string;
          name?: string | null;
          title?: string | null;
          partNumber?: string | null;
          manufacturer?: string | null;
          existingBrand?: string | null;
        } => product.id != null
      ),
    dictionary
  );

const results =
  resolutionBatch.results;

    const countConfidence = (
      confidence:
        | 'high'
        | 'medium'
        | 'review'
        | 'unresolved'
    ) =>
      results.filter(
        (item) =>
          item.confidence ===
          confidence
      ).length;

    return NextResponse.json({
      success: true,

      job:
        'test-real-brand-resolution',

      routeVersion:
        ROUTE_VERSION,

      readOnly: true,

     summary: {
  ...resolutionBatch.summary,

  matched:
    results.filter(
      (item) =>
        item.suggestedBrand !== null
    ).length,
  
      results:
resolutionBatch.results,
    });
  } catch (error) {
    console.error(
      'REAL BRAND RESOLUTION ERROR:',
      error
    );

    return NextResponse.json(
      {
        success: false,

        job:
          'test-real-brand-resolution',

        routeVersion:
          ROUTE_VERSION,

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
