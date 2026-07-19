import { NextResponse } from 'next/server';

import { supabaseAdmin } from '@/lib/supabase-admin';
import {
  getActiveBrands,
  getApprovedEvidence,
} from '@/lib/brands/repository';
import { buildBrandDictionary } from '@/lib/brands/dictionary';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const ROUTE_VERSION = 'APPLY-KNOWN-BRAND-CANDIDATES-V1';

const DEFAULT_LIMIT = 1000;
const MAX_LIMIT = 5000;
const DEFAULT_CONCURRENCY = 10;
const MAX_CONCURRENCY = 25;

type ProductRow = {
  id: number | string;
  name?: string | null;
  brand?: string | null;
  part_number?: string | null;
  model_number?: string | null;
};

type MatchResult = {
  brand: string;
  matchedText: string;
  tokenLength: number;
};

type UpdateResult = {
  productId: number | string;
  brand: string;
  success: boolean;
  error?: string;
};

function parseInteger(value: unknown, fallback: number): number {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clampInteger(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number
): number {
  return Math.min(
    Math.max(parseInteger(value, fallback), minimum),
    maximum
  );
}

function parseBoolean(value: unknown, fallback: boolean): boolean {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  const normalized = String(value).trim().toLowerCase();

  if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) {
    return true;
  }

  if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) {
    return false;
  }

  return fallback;
}

function normalizeText(value: unknown): string {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return '';
  }

  return String(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' AND ')
    .replace(/[^A-Za-z0-9+._/\-\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeBrand(value: unknown): string {
  return normalizeText(value)
    .replace(/^[\s._/+:-]+|[\s._/+:-]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function cleanName(value: unknown): string {
  let name = normalizeText(value);

  const removablePrefixes = [
    'NEW ',
    'USED ',
    'OPEN BOX ',
    'REFURBISHED ',
    'LOT ',
    'PCS ',
  ];

  let changed = true;

  while (changed && name) {
    changed = false;
    const upper = name.toUpperCase();

    for (const prefix of removablePrefixes) {
      if (upper.startsWith(prefix)) {
        name = name.slice(prefix.length).trim();
        changed = true;
        break;
      }
    }
  }

  return name;
}

function getKnownBrandNames(dictionary: any): string[] {
  const names = new Set<string>();

  const possibleCollections = [
    dictionary?.brands,
    dictionary?.brandNames,
    dictionary?.entries,
    dictionary?.aliases,
  ];

  for (const collection of possibleCollections) {
    if (!Array.isArray(collection)) {
      continue;
    }

    for (const item of collection) {
      if (typeof item === 'string') {
        const normalized = normalizeBrand(item);
        if (normalized) names.add(normalized);
        continue;
      }

      if (!item || typeof item !== 'object') {
        continue;
      }

      const record = item as Record<string, unknown>;
      const values = [
        record.name,
        record.brand,
        record.canonicalBrand,
        record.canonical_name,
        record.alias,
        record.value,
        record.label,
      ];

      for (const value of values) {
        if (typeof value !== 'string') {
          continue;
        }

        const normalized = normalizeBrand(value);
        if (normalized) names.add(normalized);
      }
    }
  }

  return [...names].filter(Boolean);
}

function buildBrandLookup(knownBrandNames: string[]): Map<string, string> {
  const lookup = new Map<string, string>();

  for (const brand of knownBrandNames) {
    const normalized = normalizeBrand(brand);
    if (!normalized) continue;

    if (!lookup.has(normalized)) {
      lookup.set(normalized, brand);
    }
  }

  return lookup;
}

function findKnownBrandFromName(
  productName: unknown,
  brandLookup: Map<string, string>
): MatchResult | null {
  const cleaned = cleanName(productName);
  if (!cleaned) return null;

  const tokens = cleaned
    .split(' ')
    .map((token) => token.trim())
    .filter(Boolean);

  if (tokens.length === 0) return null;

  const maxTokens = Math.min(tokens.length, 4);

  for (let tokenLength = maxTokens; tokenLength >= 1; tokenLength -= 1) {
    const candidate = normalizeBrand(tokens.slice(0, tokenLength).join(' '));
    if (!candidate) continue;

    const knownBrand = brandLookup.get(candidate);
    if (!knownBrand) continue;

    return {
      brand: knownBrand,
      matchedText: candidate,
      tokenLength,
    };
  }

  return null;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return [];

  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function runWorker() {
    while (true) {
      const currentIndex = nextIndex;
      nextIndex += 1;

      if (currentIndex >= items.length) {
        return;
      }

      results[currentIndex] = await worker(items[currentIndex], currentIndex);
    }
  }

  const workerCount = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => runWorker()));

  return results;
}

function isUnknownBrand(value: unknown): boolean {
  const normalized = String(value ?? '').trim().toUpperCase();
  return normalized === '' || normalized === 'UNKNOWN';
}

export async function GET(request: Request) {
  const startedAt = Date.now();

  try {
    const url = new URL(request.url);

    const dryRun = parseBoolean(url.searchParams.get('dryRun'), true);
    const limit = clampInteger(
      url.searchParams.get('limit'),
      DEFAULT_LIMIT,
      1,
      MAX_LIMIT
    );
    const afterId = clampInteger(url.searchParams.get('afterId'), 0, 0, Number.MAX_SAFE_INTEGER);
    const concurrency = clampInteger(
      url.searchParams.get('concurrency'),
      DEFAULT_CONCURRENCY,
      1,
      MAX_CONCURRENCY
    );

    const [brands, evidence] = await Promise.all([
      getActiveBrands(),
      getApprovedEvidence(),
    ]);

    const dictionary = buildBrandDictionary(brands, evidence);
    const knownBrandNames = getKnownBrandNames(dictionary);
    const brandLookup = buildBrandLookup(knownBrandNames);

    const { data, error } = await supabaseAdmin
      .from('products')
      .select('id,name,brand,part_number,model_number')
      .or('brand.is.null,brand.eq.UNKNOWN,brand.eq.Unknown,brand.eq.unknown')
      .gt('id', afterId)
      .order('id', { ascending: true })
      .limit(limit);

    if (error) {
      throw new Error(`Failed loading UNKNOWN products: ${error.message}`);
    }

    const rawRows: unknown[] = Array.isArray(data)
      ? (data as unknown[])
      : [];

    const rows: ProductRow[] = rawRows.filter(
      (row): row is ProductRow => {
        if (typeof row !== 'object' || row === null) {
          return false;
        }

        const record = row as Record<string, unknown>;
        return (
          typeof record.id === 'number' ||
          typeof record.id === 'string'
        );
      }
    );

    const matches = rows
      .map((product) => {
        if (!isUnknownBrand(product.brand)) {
          return null;
        }

        const match = findKnownBrandFromName(product.name, brandLookup);
        if (!match) return null;

        return {
          product,
          match,
        };
      })
      .filter(
        (
          item
        ): item is {
          product: ProductRow;
          match: MatchResult;
        } => Boolean(item)
      );

    let updateResults: UpdateResult[] = [];

    if (!dryRun && matches.length > 0) {
      updateResults = await mapWithConcurrency(
        matches,
        concurrency,
        async ({ product, match }): Promise<UpdateResult> => {
          try {
            const { error: updateError } = await supabaseAdmin
              .from('products')
              .update({
                brand: match.brand,
                updated_at: new Date().toISOString(),
              })
              .eq('id', product.id)
              .or('brand.is.null,brand.eq.UNKNOWN,brand.eq.Unknown,brand.eq.unknown');

            if (updateError) {
              return {
                productId: product.id,
                brand: match.brand,
                success: false,
                error: updateError.message,
              };
            }

            return {
              productId: product.id,
              brand: match.brand,
              success: true,
            };
          } catch (updateException) {
            return {
              productId: product.id,
              brand: match.brand,
              success: false,
              error:
                updateException instanceof Error
                  ? updateException.message
                  : String(updateException),
            };
          }
        }
      );
    }

    const updated = dryRun
      ? 0
      : updateResults.filter((result) => result.success).length;

    const failed = dryRun
      ? 0
      : updateResults.filter((result) => !result.success).length;

    const lastProcessedId =
      rows.length > 0 ? Number(rows[rows.length - 1].id) : afterId;

    const completed = rows.length < limit;

    const brandCounts = new Map<string, number>();
    for (const { match } of matches) {
      brandCounts.set(match.brand, (brandCounts.get(match.brand) ?? 0) + 1);
    }

    const topMatchedBrands = [...brandCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 50)
      .map(([brand, count]) => ({ brand, count }));

    return NextResponse.json({
      success: true,
      job: 'apply-known-brand-candidates',
      routeVersion: ROUTE_VERSION,
      dryRun,
      writeEnabled: !dryRun,

      dictionary: {
        totalBrands: dictionary.totalBrands,
        totalEvidence: dictionary.totalEvidence,
        knownBrandNamesLoaded: knownBrandNames.length,
        generatedAt: dictionary.generatedAt,
      },

      scan: {
        requestedLimit: limit,
        afterId,
        processed: rows.length,
        completed,
        lastProcessedId,
      },

      summary: {
        processed: rows.length,
        matched: matches.length,
        updated,
        failed,
        unmatched: rows.length - matches.length,
      },

      continuation: {
        completed,
        nextAfterId: completed ? null : lastProcessedId,
      },

      topMatchedBrands,

      samples: matches.slice(0, 100).map(({ product, match }) => ({
        productId: product.id,
        name: product.name ?? null,
        partNumber: product.part_number ?? null,
        modelNumber: product.model_number ?? null,
        matchedBrand: match.brand,
        matchedText: match.matchedText,
        matchedTokenLength: match.tokenLength,
      })),

      failures: dryRun
        ? []
        : updateResults
            .filter((result) => !result.success)
            .slice(0, 100),

      timing: {
        durationMs: Date.now() - startedAt,
      },
    });
  } catch (error) {
    console.error('APPLY KNOWN BRAND CANDIDATES ERROR:', error);

    return NextResponse.json(
      {
        success: false,
        job: 'apply-known-brand-candidates',
        routeVersion: ROUTE_VERSION,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
