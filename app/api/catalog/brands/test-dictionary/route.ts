import { NextResponse } from 'next/server';

import {
  getActiveBrands,
  getApprovedEvidence,
} from '@/lib/brands/repository';

import {
  buildBrandDictionary,
  findBrandByName,
} from '@/lib/brands/dictionary';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ROUTE_VERSION =
  'TEST-BRAND-DICTIONARY-V1';

export async function GET() {
  try {
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

    const testNames = [
      'ABB',
      'Siemens',
      'Schneider Electric',
      'Honeywell',
      'Yokogawa',
    ];

    const lookupTests =
      testNames.map((name) => {
        const found =
          findBrandByName(
            dictionary,
            name
          );

        return {
          searched: name,
          found:
            found !== null,
          brandId:
            found?.brandId ?? null,
          brand:
            found?.brand ?? null,
          normalizedBrand:
            found?.normalizedBrand ??
            null,
        };
      });

    return NextResponse.json({
      success: true,

      job:
        'test-brand-dictionary',

      routeVersion:
        ROUTE_VERSION,

      summary: {
        totalBrands:
          dictionary.totalBrands,

        totalEvidence:
          dictionary.totalEvidence,

        brandsWithAliases:
          dictionary.entries.filter(
            (entry) =>
              entry.aliases.length > 1
          ).length,

        brandsWithPartPrefixes:
          dictionary.entries.filter(
            (entry) =>
              entry
                .partNumberPrefixes
                .length > 0
          ).length,

        brandsWithManufacturers:
          dictionary.entries.filter(
            (entry) =>
              entry.manufacturers
                .length > 0
          ).length,

        brandsWithTitleTokens:
          dictionary.entries.filter(
            (entry) =>
              entry.titleTokens.length > 0
          ).length,
      },

      lookupTests,

      topEntries:
        dictionary.entries
          .slice(0, 20)
          .map((entry) => ({
            brandId:
              entry.brandId,

            brand:
              entry.brand,

            normalizedBrand:
              entry.normalizedBrand,

            productCount:
              entry.productCount,

            aliases:
              entry.aliases,

            partNumberPrefixes:
              entry
                .partNumberPrefixes,

            manufacturers:
              entry.manufacturers,

            titleTokens:
              entry.titleTokens,

            evidenceCount:
              entry.evidence.length,
          })),
    });
  } catch (error) {
    console.error(
      'TEST BRAND DICTIONARY ERROR:',
      error
    );

    return NextResponse.json(
      {
        success: false,

        job:
          'test-brand-dictionary',

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
