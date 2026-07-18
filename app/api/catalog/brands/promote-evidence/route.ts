import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  BRAND_PROMOTER_VERSION,
  promoteEvidence,
} from '@/lib/brands/promoter';

import type {
  ValidatedBrandEvidence,
} from '@/lib/brands/validator';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ROUTE_VERSION =
  'PROMOTE-BRAND-EVIDENCE-V1';

const MAX_LIMIT = 2000;

interface AggregatorResponse {
  success: boolean;

  eligible?: ValidatedBrandEvidence[];

  summary?: {
    loadedProducts?: number;
    processedProducts?: number;
    uniqueEvidenceValues?: number;
    eligibleCount?: number;
    manualReviewCount?: number;
    blockedCount?: number;
  };

  pagination?: {
    offset?: number;
    limit?: number;
    loaded?: number;
    nextOffset?: number | null;
  };

  error?: string;
}

interface PromotionDetail {
  evidenceType: string;
  evidenceValue: string;
  normalizedValue: string;
  brandId: number;
  brand: string | null;
  validationScore: number;
  result:
    | 'inserted'
    | 'already-exists'
    | 'dry-run'
    | 'skipped'
    | 'failed';
  reason: string;
  error?: string;
}

function parseInteger(
  value: string | null,
  fallback: number
): number {
  const parsed = Number.parseInt(
    value ?? '',
    10
  );

  if (
    !Number.isFinite(parsed) ||
    parsed < 0
  ) {
    return fallback;
  }

  return parsed;
}

function parseBoolean(
  value: string | null,
  fallback: boolean
): boolean {
  if (value === null) {
    return fallback;
  }

  const normalized =
    value.trim().toLowerCase();

  if (
    normalized === 'true' ||
    normalized === '1' ||
    normalized === 'yes'
  ) {
    return true;
  }

  if (
    normalized === 'false' ||
    normalized === '0' ||
    normalized === 'no'
  ) {
    return false;
  }

  return fallback;
}

export async function POST(
  request: NextRequest
) {
  const startedAt = new Date();

  try {
    const searchParams =
      request.nextUrl.searchParams;

    const offset = parseInteger(
      searchParams.get('offset'),
      0
    );

    const requestedLimit = parseInteger(
      searchParams.get('limit'),
      1000
    );

    const limit = Math.min(
      Math.max(requestedLimit, 1),
      MAX_LIMIT
    );

    /*
     * الأمان أولًا:
     *
     * الوضع الافتراضي لا يكتب في قاعدة البيانات.
     */
    const dryRun = parseBoolean(
      searchParams.get('dryRun'),
      true
    );

    const confirmation =
      searchParams.get('confirm');

    /*
     * لا نسمح بالكتابة الحقيقية إلا مع:
     *
     * dryRun=false
     * confirm=PROMOTE
     */
    if (
      dryRun === false &&
      confirmation !== 'PROMOTE'
    ) {
      return NextResponse.json(
        {
          success: false,
          job: 'promote-brand-evidence',
          routeVersion: ROUTE_VERSION,
          promoterVersion:
            BRAND_PROMOTER_VERSION,
          dryRun,
          error:
            'Real promotion requires confirm=PROMOTE',
          requiredParameters:
            '?dryRun=false&confirm=PROMOTE',
        },
        {
          status: 400,
        }
      );
    }

    /*
     * نستدعي Route التجميع الذي اختبرناه سابقًا.
     * هذا يمنع تكرار كود:
     *
     * Extractor
     * Aggregator
     * Validator
     */
    const aggregatorUrl = new URL(
      '/api/catalog/brands/test-aggregator',
      request.nextUrl.origin
    );

    aggregatorUrl.searchParams.set(
      'offset',
      String(offset)
    );

    aggregatorUrl.searchParams.set(
      'limit',
      String(limit)
    );

    const aggregatorResponse =
      await fetch(
        aggregatorUrl.toString(),
        {
          method: 'GET',
          cache: 'no-store',
          headers: {
            Accept:
              'application/json',
          },
        }
      );

    const aggregatorData =
      (await aggregatorResponse.json()) as
        AggregatorResponse;

    if (
      !aggregatorResponse.ok ||
      !aggregatorData.success
    ) {
      return NextResponse.json(
        {
          success: false,
          job: 'promote-brand-evidence',
          routeVersion: ROUTE_VERSION,
          promoterVersion:
            BRAND_PROMOTER_VERSION,
          dryRun,
          error:
            aggregatorData.error ??
            'Aggregator route failed',
          aggregatorStatus:
            aggregatorResponse.status,
        },
        {
          status: 500,
        }
      );
    }

    const eligible =
      aggregatorData.eligible ?? [];

    const details: PromotionDetail[] = [];

    let insertedCount = 0;
    let alreadyExistsCount = 0;
    let dryRunCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    /*
     * Sequential processing متعمد.
     *
     * لا نريد إرسال عشرات عمليات الكتابة
     * إلى Supabase في اللحظة نفسها.
     */
    for (const evidence of eligible) {
      try {
        const result =
          await promoteEvidence(
            evidence,
            dryRun
          );

        let resultType:
          PromotionDetail['result'];

        if (result.inserted) {
          insertedCount += 1;
          resultType = 'inserted';
        } else if (
          result.reason ===
          'already-exists'
        ) {
          alreadyExistsCount += 1;
          resultType =
            'already-exists';
        } else if (
          result.reason === 'dry-run'
        ) {
          dryRunCount += 1;
          resultType = 'dry-run';
        } else {
          skippedCount += 1;
          resultType = 'skipped';
        }

        details.push({
          evidenceType:
            evidence.type,

          evidenceValue:
            evidence.value,

          normalizedValue:
            evidence.normalizedValue,

          brandId:
            evidence.winningBrandId,

          brand:
            evidence.winningBrand ??
            null,

          validationScore:
            evidence.validationScore,

          result: resultType,

          reason: result.reason,
        });
      } catch (error) {
        failedCount += 1;

        details.push({
          evidenceType:
            evidence.type,

          evidenceValue:
            evidence.value,

          normalizedValue:
            evidence.normalizedValue,

          brandId:
            evidence.winningBrandId,

          brand:
            evidence.winningBrand ??
            null,

          validationScore:
            evidence.validationScore,

          result: 'failed',

          reason:
            'promotion-error',

          error:
            error instanceof Error
              ? error.message
              : String(error),
        });
      }
    }

    const finishedAt = new Date();

    return NextResponse.json({
      success:
        failedCount === 0,

      job:
        'promote-brand-evidence',

      routeVersion:
        ROUTE_VERSION,

      promoterVersion:
        BRAND_PROMOTER_VERSION,

      dryRun,

      writeEnabled:
        dryRun === false,

      pagination:
        aggregatorData.pagination,

      aggregatorSummary:
        aggregatorData.summary,

      promotionSummary: {
        eligibleReceived:
          eligible.length,

        insertedCount,

        alreadyExistsCount,

        dryRunCount,

        skippedCount,

        failedCount,
      },

      details,

      timing: {
        startedAt:
          startedAt.toISOString(),

        finishedAt:
          finishedAt.toISOString(),

        durationMs:
          finishedAt.getTime() -
          startedAt.getTime(),
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,

        job:
          'promote-brand-evidence',

        routeVersion:
          ROUTE_VERSION,

        promoterVersion:
          BRAND_PROMOTER_VERSION,

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

/*
 * نمنع تشغيل الكتابة عن طريق فتح الرابط
 * من المتصفح بالخطأ.
 */
export async function GET() {
  return NextResponse.json(
    {
      success: false,

      job:
        'promote-brand-evidence',

      routeVersion:
        ROUTE_VERSION,

      message:
        'Use POST. Dry-run is enabled by default.',

      dryRunExample:
        'POST /api/catalog/brands/promote-evidence?limit=2000&dryRun=true',

      realWriteExample:
        'POST /api/catalog/brands/promote-evidence?limit=2000&dryRun=false&confirm=PROMOTE',
    },
    {
      status: 405,
    }
  );
}
