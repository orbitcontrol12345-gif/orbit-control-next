import { NextRequest, NextResponse } from 'next/server';

import { supabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

const ROUTE_VERSION = 'REPAIR-DESCRIPTIONS-V1-SAFE';

type ProductRow = {
  id: string | number;
  name: string | null;
  description: string | null;
};

function normalizeText(value: unknown): string {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : String(error);
}

function repairDescription(
  description: unknown,
  productName: unknown
): string {
  const originalDescription = normalizeText(description);
  const name = normalizeText(productName);

  const cleaned = originalDescription
    .replace(
      /we(?:'|’)?ll\s+reply\s+as\s+soon\s+as\s+possible[.!…]*/gi,
      ''
    )
    .replace(
      /we\s+will\s+reply\s+as\s+soon\s+as\s+possible[.!…]*/gi,
      ''
    )
    .replace(
      /they\s+are\s+not\s+included\s+in\s+the\s+item\s+price[.!…]*/gi,
      ''
    )
    .replace(/\s+/g, ' ')
    .trim();

  if (cleaned) {
    return cleaned;
  }

  return name ? `${name}.` : 'Product details available upon request.';
}

export async function GET(request: NextRequest) {
  try {
    const requestedLimit = Number(
      request.nextUrl.searchParams.get('limit') ||
        DEFAULT_LIMIT
    );

    const limit = Math.max(
      1,
      Math.min(
        Number.isFinite(requestedLimit)
          ? Math.floor(requestedLimit)
          : DEFAULT_LIMIT,
        MAX_LIMIT
      )
    );

    const dryRun =
      request.nextUrl.searchParams.get('dryRun') === '1';

    const {
      data: products,
      error: productsError,
    } = await supabaseAdmin
      .from('products')
      .select('id, name, description')
      .or(
        [
          'description.ilike.%reply as soon%',
          'description.ilike.%not included in the item price%',
        ].join(',')
      )
      .order('id', { ascending: true })
      .limit(limit);

    if (productsError) {
      throw productsError;
    }

    const rows = (products ?? []) as ProductRow[];

    let updated = 0;
    let unchanged = 0;
    let failed = 0;

    const results: Array<Record<string, unknown>> = [];

    for (const product of rows) {
      try {
        const beforeDescription = normalizeText(
          product.description
        );

        const afterDescription = repairDescription(
          product.description,
          product.name
        );

        if (
          !afterDescription ||
          afterDescription === beforeDescription
        ) {
          unchanged++;

          results.push({
            id: product.id,
            action: 'unchanged',
            beforeDescription,
            afterDescription,
          });

          continue;
        }

        if (dryRun) {
          results.push({
            id: product.id,
            action: 'dry_run',
            beforeDescription,
            afterDescription,
          });

          continue;
        }

        const { error: updateError } =
          await supabaseAdmin
            .from('products')
            .update({
              description: afterDescription,
              updated_at: new Date().toISOString(),
            })
            .eq('id', product.id);

        if (updateError) {
          throw updateError;
        }

        updated++;

        results.push({
          id: product.id,
          action: 'updated',
          beforeDescription,
          afterDescription,
        });
      } catch (error) {
        failed++;

        results.push({
          id: product.id,
          action: 'failed',
          error: getErrorMessage(error),
        });
      }
    }

    return NextResponse.json({
      success: true,
      routeVersion: ROUTE_VERSION,
      dryRun,
      safety: {
        updatesOnly: ['description', 'updated_at'],
        neverUpdates: [
          'name',
          'part_number',
          'model_number',
          'brand',
          'category',
          'condition',
          'sku',
          'slug',
          'images',
          'ebay_item_id',
        ],
      },
      summary: {
        loaded: rows.length,
        updated,
        unchanged,
        failed,
      },
      results,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        routeVersion: ROUTE_VERSION,
        error: getErrorMessage(error),
      },
      {
        status: 500,
      }
    );
  }
}
