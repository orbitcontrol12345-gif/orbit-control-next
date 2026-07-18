import { NextResponse } from 'next/server';

import {
  getActiveBrands,
  getApprovedEvidence,
} from '@/lib/brands/repository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ROUTE_VERSION =
  'TEST-BRAND-REPOSITORY-V1';

export async function GET() {
  try {
    const [brands, evidence] =
      await Promise.all([
        getActiveBrands(),
        getApprovedEvidence(),
      ]);

    const brandIds =
      new Set(
        brands.map((brand) => brand.id)
      );

    const orphanEvidence =
      evidence.filter(
        (item) =>
          !brandIds.has(item.brandId)
      );

    return NextResponse.json({
      success: true,

      job:
        'test-brand-repository',

      routeVersion:
        ROUTE_VERSION,

      summary: {
        activeBrands:
          brands.length,

        approvedEvidence:
          evidence.length,

        orphanEvidence:
          orphanEvidence.length,

        brandsWithProducts:
          brands.filter(
            (brand) =>
              brand.productCount > 0
          ).length,

        totalProductCount:
          brands.reduce(
            (sum, brand) =>
              sum +
              brand.productCount,
            0
          ),
      },

      topBrands:
        [...brands]
          .sort(
            (a, b) =>
              b.productCount -
              a.productCount
          )
          .slice(0, 20),

      evidenceTypes:
        evidence.reduce<
          Record<string, number>
        >((result, item) => {
          result[item.type] =
            (result[item.type] ?? 0) +
            1;

          return result;
        }, {}),

      sampleEvidence:
        evidence
          .slice(0, 20)
          .map((item) => ({
            id: item.id,
            brandId:
              item.brandId,
            type: item.type,
            value: item.value,
            normalizedValue:
              item.normalizedValue,
            weight: item.weight,
            purity: item.purity,
            source: item.source,
          })),
    });
  } catch (error) {
    console.error(
      'TEST BRAND REPOSITORY ERROR:',
      error
    );

    return NextResponse.json(
      {
        success: false,

        job:
          'test-brand-repository',

        routeVersion:
          ROUTE_VERSION,

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
