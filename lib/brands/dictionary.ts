import type {
  Brand,
  BrandDictionary,
  BrandDictionaryEntry,
  BrandEvidence,
} from '@/lib/brands/types';

function normalizeText(
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
  return normalizeText(value)
    .toUpperCase();
}

function uniqueValues(
  values: string[]
): string[] {
  const seen =
    new Set<string>();

  const result: string[] = [];

  for (const value of values) {
    const cleaned =
      normalizeText(value);

    const normalized =
      normalizeUpper(cleaned);

    if (
      !cleaned ||
      !normalized ||
      seen.has(normalized)
    ) {
      continue;
    }

    seen.add(normalized);
    result.push(cleaned);
  }

  return result;
}

function groupEvidenceByBrand(
  evidence: BrandEvidence[]
): Map<number, BrandEvidence[]> {
  const grouped =
    new Map<number, BrandEvidence[]>();

  for (const item of evidence) {
    const current =
      grouped.get(item.brandId) ?? [];

    current.push(item);

    grouped.set(
      item.brandId,
      current
    );
  }

  return grouped;
}

function buildEntry(
  brand: Brand,
  evidence: BrandEvidence[]
): BrandDictionaryEntry {
  const aliases: string[] = [
    brand.canonicalBrand,
  ];

  const partNumberPrefixes:
    string[] = [];

  const manufacturers:
    string[] = [];

  const titleTokens:
    string[] = [];

  for (const item of evidence) {
    switch (item.type) {
      case 'canonical':
      case 'alias':
      case 'manual':
        aliases.push(item.value);
        break;

      case 'part-prefix':
        partNumberPrefixes.push(
          item.value
        );
        break;

      case 'manufacturer':
        manufacturers.push(
          item.value
        );
        break;

      case 'title-token':
        titleTokens.push(
          item.value
        );
        break;
    }
  }

  return {
    brandId: brand.id,

    brand:
      normalizeText(
        brand.canonicalBrand
      ),

    normalizedBrand:
      normalizeUpper(
        brand.normalizedBrand ||
          brand.canonicalBrand
      ),

    productCount:
      brand.productCount,

    aliases:
      uniqueValues(aliases),

    partNumberPrefixes:
      uniqueValues(
        partNumberPrefixes
      ),

    manufacturers:
      uniqueValues(
        manufacturers
      ),

    titleTokens:
      uniqueValues(
        titleTokens
      ),

    evidence,
  };
}

export function buildBrandDictionary(
  brands: Brand[],
  evidence: BrandEvidence[]
): BrandDictionary {
  const evidenceByBrand =
    groupEvidenceByBrand(evidence);

  const entries =
    brands.map((brand) => {
      const brandEvidence =
        evidenceByBrand.get(
          brand.id
        ) ?? [];

      return buildEntry(
        brand,
        brandEvidence
      );
    });

  entries.sort((a, b) => {
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

  return {
    generatedAt:
      new Date().toISOString(),

    totalBrands:
      entries.length,

    totalEvidence:
      evidence.length,

    entries,
  };
}

export function findBrandById(
  dictionary: BrandDictionary,
  brandId: number
): BrandDictionaryEntry | null {
  return (
    dictionary.entries.find(
      (entry) =>
        entry.brandId === brandId
    ) ?? null
  );
}

export function findBrandByName(
  dictionary: BrandDictionary,
  brandName: string
): BrandDictionaryEntry | null {
  const normalized =
    normalizeUpper(brandName);

  if (!normalized) {
    return null;
  }

  return (
    dictionary.entries.find(
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
