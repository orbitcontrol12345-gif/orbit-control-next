import { NextResponse } from 'next/server';

import {
  getActiveBrands,
} from '@/lib/brands/repository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ROUTE_VERSION =
  'AUDIT-BRAND-REGISTRY-V1';

const GENERIC_WORDS = new Set([
  'RELAY',
  'PCB',
  'PLC',
  'MODULE',
  'BOARD',
  'POWER',
  'DRIVE',
  'SENSOR',
  'CONTROLLER',
  'CONTROL',
  'PANEL',
  'SWITCH',
  'MOTOR',
  'CABLE',
  'VALVE',
  'PUMP',
  'FILTER',
  'DISPLAY',
  'SCREEN',
  'UNIT',
  'DEVICE',
  'SYSTEM',
  'ELECTRIC',
  'ELECTRICAL',
  'ELECTRONIC',
  'AUTOMATION',
  'INDUSTRIAL',
  'PART',
  'PARTS',
  'PRODUCT',
  'EQUIPMENT',
  'MACHINE',
  'METER',
  'TRANSFORMER',
  'BREAKER',
  'CONTACTOR',
  'INVERTER',
  'ENCODER',
  'TRANSMITTER',
  'RECEIVER',
  'TERMINAL',
  'CONNECTOR',
  'ADAPTER',
  'AMPLIFIER',
  'PROCESSOR',
  'CPU',
  'HMI',
  'VFD',
  'SERVO',
]);

const ALLOWED_SHORT_BRANDS = new Set([
  'ABB',
  'GE',
  'SEW',
  'SICK',
  'SMC',
  'IFM',
  'FESTO',
  'OMRON',
  'MOXA',
  'EATON',
]);

function normalize(
  value: unknown
): string {
  return String(value ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function isNumericOnly(
  value: string
): boolean {
  return /^[0-9]+$/.test(value);
}

function isCodeLike(
  value: string
): boolean {
  return (
    /^[A-Z0-9_-]+$/.test(value) &&
    /[A-Z]/.test(value) &&
    /[0-9]/.test(value) &&
    value.length >= 5
  );
}

function getReasons(
  brandName: string
): string[] {
  const normalized =
    normalize(brandName);

  const reasons: string[] = [];

  if (!normalized) {
    reasons.push('empty');
    return reasons;
  }

  if (
    GENERIC_WORDS.has(normalized)
  ) {
    reasons.push('generic-word');
  }

  if (
    normalized.length <= 2 &&
    !ALLOWED_SHORT_BRANDS.has(
      normalized
    )
  ) {
    reasons.push('too-short');
  }

  if (
    isNumericOnly(normalized)
  ) {
    reasons.push('numeric-only');
  }

  if (
    isCodeLike(normalized)
  ) {
    reasons.push('code-like');
  }

  if (
    normalized.startsWith('LOT ')
  ) {
    reasons.push('lot-value');
  }

  if (
    /\bPCS?\b/.test(normalized)
  ) {
    reasons.push('quantity-word');
  }

  if (
    /\bNEW\b|\bUSED\b|\bOPEN BOX\b/.test(
      normalized
    )
  ) {
    reasons.push('condition-word');
  }

  return reasons;
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
        : 200;

    const brands =
      await getActiveBrands();

    const suspicious =
      brands
        .map((brand) => ({
          ...brand,
          reasons:
            getReasons(
              brand.canonicalBrand
            ),
        }))
        .filter(
          (brand) =>
            brand.reasons.length > 0
        )
        .sort((a, b) => {
          if (
            b.productCount !==
            a.productCount
          ) {
            return (
              b.productCount -
              a.productCount
            );
          }

          return a.canonicalBrand.localeCompare(
            b.canonicalBrand
          );
        });

    const reasonCounts =
      suspicious.reduce<
        Record<string, number>
      >((result, brand) => {
        for (
          const reason of
          brand.reasons
        ) {
          result[reason] =
            (result[reason] ?? 0) + 1;
        }

        return result;
      }, {});

    return NextResponse.json({
      success: true,

      job:
        'audit-brand-registry',

      routeVersion:
        ROUTE_VERSION,

      readOnly: true,

      summary: {
        activeBrands:
          brands.length,

        suspiciousBrands:
          suspicious.length,

        suspiciousProductCount:
          suspicious.reduce(
            (sum, brand) =>
              sum +
              brand.productCount,
            0
          ),

        reasonCounts,
      },

      suspicious:
        suspicious.slice(
          0,
          limit
        ),
    });
  } catch (error) {
    console.error(
      'AUDIT BRAND REGISTRY ERROR:',
      error
    );

    return NextResponse.json(
      {
        success: false,

        job:
          'audit-brand-registry',

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
