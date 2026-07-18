import { supabaseAdmin } from '@/lib/supabase-admin';

import type {
  BrandDictionaryEntry,
} from '@/lib/brand-scoring-engine';

export const BRAND_INTELLIGENCE_SERVICE_VERSION =
  'BRAND-INTELLIGENCE-SERVICE-V1';

const DEFAULT_CACHE_TTL_MS =
  5 * 60 * 1000;

type BrandRegistryRow = {
  id: number;
  canonical_brand: string;
  normalized_brand: string;
  product_count: number | null;
  status: string;
};

type BrandEvidenceRow = {
  id: number;
  brand_id: number;
  evidence_type: string;
  evidence_value: string;
  normalized_value: string;
  occurrence_count: number | null;
  matching_brand_count: number | null;
  conflicting_brand_count: number | null;
  purity: number | string | null;
  weight: number | null;
  status: string;
  source: string;
  metadata: Record<string, unknown> | null;
};

export type LoadedBrandEvidence = {
  id: number;
  type:
    | 'canonical'
    | 'alias'
    | 'part-prefix'
    | 'manufacturer'
    | 'title-token'
    | 'manual';

  value: string;
  normalizedValue: string;

  occurrenceCount: number;
  matchingBrandCount: number;
  conflictingBrandCount: number;

  purity: number;
  weight: number;

  source: string;
  metadata: Record<string, unknown>;
};

export type LoadedBrandDictionaryEntry =
  BrandDictionaryEntry & {
    brandId: number;
    normalizedBrand: string;
    productCount: number;

    manufacturers: string[];
    titleTokens: string[];

    evidence: LoadedBrandEvidence[];
  };

export type BrandDictionarySnapshot = {
  success: true;

  serviceVersion: string;
  dictionaryVersion: string;

  generatedAt: string;

  totalBrands: number;
  totalEvidence: number;

  dictionary: LoadedBrandDictionaryEntry[];
};

type BrandDictionaryCache = {
  snapshot: BrandDictionarySnapshot;
  expiresAt: number;
};

let dictionaryCache:
  | BrandDictionaryCache
  | null = null;

function normalizeSpace(
  value: unknown
): string {
  return String(value ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeUpper(
  value: unknown
): string {
  return normalizeSpace(value)
    .toUpperCase();
}

function uniqueStrings(
  values: string[]
): string[] {
  return Array.from(
    new Set(
      values
        .map(normalizeSpace)
        .filter(Boolean)
    )
  );
}

function numericValue(
  value: unknown,
  fallback = 0
): number {
  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : fallback;
}

function buildDictionaryVersion(
  brands: BrandRegistryRow[],
  evidence: BrandEvidenceRow[]
): string {
  const brandIdTotal = brands.reduce(
    (sum, brand) =>
      sum + numericValue(brand.id),
    0
  );

  const evidenceIdTotal = evidence.reduce(
    (sum, item) =>
      sum + numericValue(item.id),
    0
  );

  return [
    'DB',
    brands.length,
    evidence.length,
    brandIdTotal,
    evidenceIdTotal,
  ].join('-');
}

function mapEvidence(
  row: BrandEvidenceRow
): LoadedBrandEvidence {
  return {
    id: row.id,

    type:
      row.evidence_type as
        LoadedBrandEvidence['type'],

    value:
      normalizeSpace(
        row.evidence_value
      ),

    normalizedValue:
      normalizeUpper(
        row.normalized_value ||
          row.evidence_value
      ),

    occurrenceCount:
      numericValue(
        row.occurrence_count
      ),

    matchingBrandCount:
      numericValue(
        row.matching_brand_count
      ),

    conflictingBrandCount:
      numericValue(
        row.conflicting_brand_count
      ),

    purity:
      numericValue(row.purity),

    weight:
      numericValue(row.weight),

    source:
      normalizeSpace(row.source),

    metadata:
      row.metadata ?? {},
  };
}

async function fetchAllActiveBrands():
  Promise<BrandRegistryRow[]> {
  const pageSize = 1000;

  const rows: BrandRegistryRow[] = [];

  let offset = 0;

  while (true) {
    const { data, error } =
      await supabaseAdmin
        .from('brand_registry')
        .select(
          [
            'id',
            'canonical_brand',
            'normalized_brand',
            'product_count',
            'status',
          ].join(',')
        )
        .eq('status', 'active')
        .order('id', {
          ascending: true,
        })
        .range(
          offset,
          offset + pageSize - 1
        );

    if (error) {
      throw new Error(
        `Failed loading brand_registry: ${error.message}`
      );
    }

    const page =
      (data ?? []) as BrandRegistryRow[];

    rows.push(...page);

    if (page.length < pageSize) {
      break;
    }

    offset += pageSize;
  }

  return rows;
}

async function fetchAllApprovedEvidence():
  Promise<BrandEvidenceRow[]> {
  const pageSize = 1000;

  const rows: BrandEvidenceRow[] = [];

  let offset = 0;

  while (true) {
    const { data, error } =
      await supabaseAdmin
        .from('brand_evidence')
        .select(
          [
            'id',
            'brand_id',
            'evidence_type',
            'evidence_value',
            'normalized_value',
            'occurrence_count',
            'matching_brand_count',
            'conflicting_brand_count',
            'purity',
            'weight',
            'status',
            'source',
            'metadata',
          ].join(',')
        )
        .eq('status', 'approved')
        .order('id', {
          ascending: true,
        })
        .range(
          offset,
          offset + pageSize - 1
        );

    if (error) {
      throw new Error(
        `Failed loading brand_evidence: ${error.message}`
      );
    }

    const page =
      (data ?? []) as BrandEvidenceRow[];

    rows.push(...page);

    if (page.length < pageSize) {
      break;
    }

    offset += pageSize;
  }

  return rows;
}

function buildDictionary(
  brands: BrandRegistryRow[],
  evidenceRows: BrandEvidenceRow[]
): LoadedBrandDictionaryEntry[] {
  const evidenceByBrandId =
    new Map<number, LoadedBrandEvidence[]>();

  for (const row of evidenceRows) {
    const evidence =
      mapEvidence(row);

    const current =
      evidenceByBrandId.get(
        row.brand_id
      ) ?? [];

    current.push(evidence);

    evidenceByBrandId.set(
      row.brand_id,
      current
    );
  }

  const dictionary =
    brands.map((brand) => {
      const evidence =
        evidenceByBrandId.get(
          brand.id
        ) ?? [];

      const aliases: string[] = [];

      const partNumberPrefixes:
        string[] = [];

      const manufacturers:
        string[] = [];

      const titleTokens:
        string[] = [];

      /*
       * اسم البراند الرسمي دائمًا Alias صالح،
       * حتى لو لم يوجد canonical evidence لسبب ما.
       */
      aliases.push(
        brand.canonical_brand
      );

      for (const item of evidence) {
        if (
          item.type === 'canonical' ||
          item.type === 'alias' ||
          item.type === 'manual'
        ) {
          aliases.push(item.value);
        }

        if (
          item.type === 'part-prefix'
        ) {
          partNumberPrefixes.push(
            item.value
          );
        }

        if (
          item.type ===
          'manufacturer'
        ) {
          manufacturers.push(
            item.value
          );
        }

        if (
          item.type === 'title-token'
        ) {
          titleTokens.push(
            item.value
          );
        }
      }

      return {
        brandId: brand.id,

        brand:
          normalizeSpace(
            brand.canonical_brand
          ),

        normalizedBrand:
          normalizeUpper(
            brand.normalized_brand
          ),

        productCount:
          numericValue(
            brand.product_count
          ),

        aliases:
          uniqueStrings(aliases),

        partNumberPrefixes:
          uniqueStrings(
            partNumberPrefixes
          ),

        manufacturers:
          uniqueStrings(
            manufacturers
          ),

        titleTokens:
          uniqueStrings(
            titleTokens
          ),

        evidence,
      };
    });

  dictionary.sort((a, b) => {
    if (
      b.productCount !==
      a.productCount
    ) {
      return (
        b.productCount -
        a.productCount
      );
    }

    return a.brand.localeCompare(
      b.brand
    );
  });

  return dictionary;
}

export async function loadBrandDictionary(
  options?: {
    forceRefresh?: boolean;
    cacheTtlMs?: number;
  }
): Promise<BrandDictionarySnapshot> {
  const forceRefresh =
    options?.forceRefresh ?? false;

  const cacheTtlMs =
    Math.max(
      0,
      options?.cacheTtlMs ??
        DEFAULT_CACHE_TTL_MS
    );

  const now = Date.now();

  if (
    !forceRefresh &&
    dictionaryCache &&
    dictionaryCache.expiresAt > now
  ) {
    return dictionaryCache.snapshot;
  }

  const [brands, evidenceRows] =
    await Promise.all([
      fetchAllActiveBrands(),
      fetchAllApprovedEvidence(),
    ]);

  const dictionary =
    buildDictionary(
      brands,
      evidenceRows
    );

  const snapshot:
    BrandDictionarySnapshot = {
      success: true,

      serviceVersion:
        BRAND_INTELLIGENCE_SERVICE_VERSION,

      dictionaryVersion:
        buildDictionaryVersion(
          brands,
          evidenceRows
        ),

      generatedAt:
        new Date().toISOString(),

      totalBrands:
        dictionary.length,

      totalEvidence:
        evidenceRows.length,

      dictionary,
    };

  dictionaryCache = {
    snapshot,
    expiresAt:
      now + cacheTtlMs,
  };

  return snapshot;
}

export async function getScoringDictionary(
  options?: {
    forceRefresh?: boolean;
    cacheTtlMs?: number;
  }
): Promise<
  BrandDictionaryEntry[]
> {
  const snapshot =
    await loadBrandDictionary(
      options
    );

  return snapshot.dictionary.map(
    (entry) => ({
      brand: entry.brand,
      aliases: entry.aliases,

      partNumberPrefixes:
        entry.partNumberPrefixes,
    })
  );
}

export async function getBrandByName(
  brandName: string
): Promise<
  LoadedBrandDictionaryEntry | null
> {
  const normalized =
    normalizeUpper(brandName);

  if (!normalized) {
    return null;
  }

  const snapshot =
    await loadBrandDictionary();

  return (
    snapshot.dictionary.find(
      (entry) =>
        entry.normalizedBrand ===
          normalized ||
        entry.aliases.some(
          (alias) =>
            normalizeUpper(alias) ===
            normalized
        )
    ) ?? null
  );
}

export async function getBrandById(
  brandId: number
): Promise<
  LoadedBrandDictionaryEntry | null
> {
  const snapshot =
    await loadBrandDictionary();

  return (
    snapshot.dictionary.find(
      (entry) =>
        entry.brandId === brandId
    ) ?? null
  );
}

export function clearBrandDictionaryCache():
  void {
  dictionaryCache = null;
}
