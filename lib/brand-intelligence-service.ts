import { NextResponse } from 'next/server';

import {
  loadBrandDictionary,
  BRAND_INTELLIGENCE_SERVICE_VERSION,
} from '@/lib/brand-intelligence-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ROUTE_VERSION =
  'TEST-BRAND-INTELLIGENCE-SERVICE-V1';

export async function GET(
  request: Request
) {
  try {
    const url =
      new URL(request.url);

    const forceRefresh =
      url.searchParams.get(
        'refresh'
      ) === '1';

    const snapshot =
      await loadBrandDictionary({
        forceRefresh,
      });

    return NextResponse.json({
      success: true,

      job:
        'test-brand-intelligence-service',

      routeVersion:
        ROUTE_VERSION,

      serviceVersion:
        BRAND_INTELLIGENCE_SERVICE_VERSION,

      dictionaryVersion:
        snapshot.dictionaryVersion,

      generatedAt:
        snapshot.generatedAt,

      summary: {
        totalBrands:
          snapshot.totalBrands,

        totalEvidence:
          snapshot.totalEvidence,

        brandsWithAliases:
          snapshot.dictionary.filter(
            (entry) =>
              entry.aliases.length > 1
          ).length,

        brandsWithPartPrefixes:
          snapshot.dictionary.filter(
            (entry) =>
              entry
                .partNumberPrefixes
                .length > 0
          ).length,

        brandsWithManufacturers:
          snapshot.dictionary.filter(
            (entry) =>
              entry.manufacturers
                .length > 0
          ).length,
      },

      sample:
        snapshot.dictionary
          .slice(0, 20)
          .map((entry) => ({
            brandId:
              entry.brandId,

            brand:
              entry.brand,

            productCount:
              entry.productCount,

            aliases:
              entry.aliases,

            partNumberPrefixes:
              entry
                .partNumberPrefixes,

            evidenceCount:
              entry.evidence.length,
          })),
    });
  } catch (error) {
    console.error(
      'TEST BRAND INTELLIGENCE SERVICE ERROR:',
      error
    );

    return NextResponse.json(
      {
        success: false,

        job:
          'test-brand-intelligence-service',

        routeVersion:
          ROUTE_VERSION,

        serviceVersion:
          BRAND_INTELLIGENCE_SERVICE_VERSION,

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
