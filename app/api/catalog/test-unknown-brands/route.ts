import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

import {
  BRAND_SCORING_ENGINE_VERSION,
  scoreProductBrand,
  type BrandDictionaryEntry,
} from '@/lib/brand-scoring-engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const ROUTE_VERSION = 'TEST-UNKNOWN-BRANDS-V1';

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 200;

type DictionaryApiResponse = {
  success?: boolean;

  exportDictionary?: Array<
    BrandDictionaryEntry & {
      evidence?: unknown;
    }
  >;

  dictionaryVersion?: string;

  error?: string;
};

function getSafeInteger(
  value: string | null,
  fallback: number,
  minimum: number,
  maximum: number
): number {
  const parsed = Number.parseInt(value ?? '', 10);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(
    maximum,
    Math.max(minimum, parsed)
  );
}

function normalizeSpace(value: unknown): string {
  return String(value ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeUpper(value: unknown): string {
  return normalizeSpace(value).toUpperCase();
}

function isUnknownBrand(value: unknown): boolean {
  const brand = normalizeUpper(value);

  return (
    !brand ||
    brand === 'UNKNOWN' ||
    brand === 'UNBRANDED' ||
    brand === 'GENERIC' ||
    brand === 'NO BRAND' ||
    brand === 'NONE' ||
    brand === 'N/A' ||
    brand === 'NA' ||
    brand === 'NOT APPLICABLE' ||
    brand === 'DOES NOT APPLY' ||
    brand === 'OTHER'
  );
}

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);

    const limit = getSafeInteger(
      requestUrl.searchParams.get('limit'),
      DEFAULT_LIMIT,
      1,
      MAX_LIMIT
    );

    const offset = getSafeInteger(
      requestUrl.searchParams.get('offset'),
      0,
      0,
      1_000_000
    );

    /*
     * نستخدم نفس Route بناء القاموس حتى يكون الاختبار
     * على القاموس الحقيقي الناتج من منتجات Orbit Control.
     */
    const dictionaryUrl = new URL(
      '/api/catalog/build-brand-intelligence',
      request.url
    );

    const dictionaryResponse = await fetch(
      dictionaryUrl,
      {
        method: 'GET',
        cache: 'no-store',
        headers: {
          Accept: 'application/json',
        },
      }
    );

    const dictionaryData =
      (await dictionaryResponse
        .json()
        .catch(() => null)) as
        | DictionaryApiResponse
        | null;

    if (
      !dictionaryResponse.ok ||
      !dictionaryData?.success
    ) {
      throw new Error(
        dictionaryData?.error ||
          `Dictionary builder returned HTTP ${dictionaryResponse.status}`
      );
    }

    const dictionary =
      dictionaryData.exportDictionary ?? [];

    if (dictionary.length === 0) {
      throw new Error(
        'Brand dictionary is empty. Run build-brand-intelligence first.'
      );
    }

    /*
     * نجلب دفعة أوسع قليلًا لأن بعض قيم brand قد لا تكون
     * UNKNOWN فعلًا بعد التطبيع.
     */
    const fetchSize = Math.min(
      Math.max(limit * 3, limit),
      1000
    );

    const rangeStart = offset;
    const rangeEnd =
      offset + fetchSize - 1;

    const { data: products, error: productsError } =
      await supabaseAdmin
        .from('products')
        .select(
          'id,name,brand,part_number'
        )
        .or(
          [
            'brand.is.null',
            'brand.eq.UNKNOWN',
            'brand.eq.Unknown',
            'brand.eq.unknown',
            'brand.eq.UNBRANDED',
            'brand.eq.Unbranded',
            'brand.eq.GENERIC',
            'brand.eq.Generic',
            'brand.eq.NO BRAND',
            'brand.eq.None',
            'brand.eq.NONE',
            'brand.eq.N/A',
            'brand.eq.NA',
            'brand.eq.OTHER',
          ].join(',')
        )
        .order('id', {
          ascending: true,
        })
        .range(rangeStart, rangeEnd);

    if (productsError) {
      throw productsError;
    }

    const unknownProducts = (
      products ?? []
    )
      .filter((product) =>
        isUnknownBrand(product.brand)
      )
      .slice(0, limit);

    const results = unknownProducts.map(
      (product) => {
        const scoringResult =
          scoreProductBrand(
            {
              title: product.name,
              partNumber:
                product.part_number,
              manufacturer: null,
              brand: product.brand,
            },
            dictionary
          );

        return {
          id: product.id,

          title: product.name ?? '',
          partNumber:
            product.part_number ?? null,

          currentBrand:
            product.brand ?? null,

          predictedBrand:
            scoringResult.brand,

          matched:
            scoringResult.matched,

          decision:
            scoringResult.decision,

          score:
            scoringResult.score,

          confidence:
            scoringResult.confidence,

          secondPlaceScore:
            scoringResult.secondPlaceScore,

          scoreGap:
            scoringResult.scoreGap,

          evidence:
            scoringResult.evidence.map(
              (item) => ({
                type: item.type,
                matchedValue:
                  item.matchedValue,
                points: item.points,
              })
            ),

          candidates:
            scoringResult.candidates
              .slice(0, 3)
              .map((candidate) => ({
                brand: candidate.brand,
                score: candidate.score,
              })),
        };
      }
    );

    const highConfidence = results.filter(
      (result) =>
        result.decision ===
        'high-confidence'
    ).length;

    const mediumConfidence =
      results.filter(
        (result) =>
          result.decision ===
          'medium-confidence'
      ).length;

    const review = results.filter(
      (result) =>
        result.decision === 'review'
    ).length;

    const unresolved = results.filter(
      (result) =>
        result.decision === 'unresolved'
    ).length;

    const matched = results.filter(
      (result) => result.matched
    ).length;

    const predictedBrandCounts =
      results.reduce<
        Record<string, number>
      >((counts, result) => {
        const brand =
          result.predictedBrand ??
          'UNRESOLVED';

        counts[brand] =
          (counts[brand] ?? 0) + 1;

        return counts;
      }, {});

    const topPredictedBrands =
      Object.entries(predictedBrandCounts)
        .map(([brand, count]) => ({
          brand,
          count,
        }))
        .sort((a, b) => {
          if (b.count !== a.count) {
            return b.count - a.count;
          }

          return a.brand.localeCompare(
            b.brand
          );
        })
        .slice(0, 20);

    return NextResponse.json({
      success: true,
      job: 'test-unknown-brands',
      routeVersion: ROUTE_VERSION,

      engineVersion:
        BRAND_SCORING_ENGINE_VERSION,

      dictionaryVersion:
        dictionaryData.dictionaryVersion ??
        null,

      readOnly: true,
      databaseUpdated: false,

      pagination: {
        requestedLimit: limit,
        requestedOffset: offset,
        fetchedRows:
          products?.length ?? 0,
        processed:
          unknownProducts.length,

        nextOffset:
          offset +
          (products?.length ?? 0),
      },

      summary: {
        dictionaryBrands:
          dictionary.length,

        processed: results.length,
        matched,

        highConfidence,
        mediumConfidence,
        review,
        unresolved,

        matchRate:
          results.length > 0
            ? Number(
                (
                  (matched /
                    results.length) *
                  100
                ).toFixed(2)
              )
            : 0,

        highConfidenceRate:
          results.length > 0
            ? Number(
                (
                  (highConfidence /
                    results.length) *
                  100
                ).toFixed(2)
              )
            : 0,
      },

      topPredictedBrands,
      results,
    });
  } catch (error) {
    console.error(
      'TEST UNKNOWN BRANDS ERROR:',
      error
    );

    return NextResponse.json(
      {
        success: false,
        job: 'test-unknown-brands',
        routeVersion: ROUTE_VERSION,

        engineVersion:
          BRAND_SCORING_ENGINE_VERSION,

        readOnly: true,
        databaseUpdated: false,

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
