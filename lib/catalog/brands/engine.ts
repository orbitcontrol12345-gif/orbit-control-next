import {
  insertEvidence,
  insertRegistryBrand,
  loadRegistryBrands,
  loadUnknownProducts,
} from './brand-repository';

import {
  normalizeBrand,
  shouldRejectCandidate,
} from './promotion-filters';

type BrandCandidate = {
  canonicalBrand: string;
  normalizedBrand: string;
  productCount: number;
  occurrenceCount: number;
  confidence: number;
  sampleProductIds: number[];
};

const MULTI_WORD_PREFIXES = new Set([
  'ACTIVE',
  'ADVANCED',
  'AMERICAN',
  'AUTOMATIC',
  'GENERAL',
  'GLOBAL',
  'INTERNATIONAL',
  'NATIONAL',
  'PRECISION',
  'UNITED',
]);

function extractCandidate(title: string): string | null {
  const words = title
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((word) => word.trim())
    .filter(Boolean);

  if (words.length === 0) {
    return null;
  }

  const firstWord = normalizeBrand(words[0]);

  if (!firstWord) {
    return null;
  }

  if (
    MULTI_WORD_PREFIXES.has(firstWord) &&
    words.length >= 2
  ) {
    return `${words[0]} ${words[1]}`;
  }

  return words[0];
}

function calculateConfidence(productCount: number): number {
  if (productCount >= 20) {
    return 95;
  }

  if (productCount >= 10) {
    return 85;
  }

  if (productCount >= 5) {
    return 70;
  }

  if (productCount >= 3) {
    return 55;
  }

  if (productCount >= 2) {
    return 35;
  }

  return 15;
}

export class BrandEngine {
  async learn() {
    const extracted = await this.extract();
    const promoted = await this.promote(
      extracted.candidates,
    );

    return {
      success: promoted.failed === 0,
      unknownProducts:
        extracted.unknownProducts,
      knownBrands:
        extracted.knownBrands,
      candidates:
        extracted.candidates.length,
      promoted:
        promoted.inserted,
      skipped:
        promoted.skipped,
      failed:
        promoted.failed,
      failures:
        promoted.failures,
    };
  }

  async extract(): Promise<{
    success: true;
    unknownProducts: number;
    knownBrands: number;
    candidates: BrandCandidate[];
  }> {
    const products =
      await loadUnknownProducts(5000);

    const registry =
      await loadRegistryBrands();

    const knownBrands = new Set(
      registry.map((brand) =>
        normalizeBrand(
          brand.normalized_brand ||
            brand.canonical_brand,
        ),
      ),
    );

    const candidatesMap = new Map<
      string,
      BrandCandidate
    >();

    for (const product of products) {
      const candidate = extractCandidate(
        String(product.name ?? ''),
      );

      if (!candidate) {
        continue;
      }

      const normalizedBrand =
        normalizeBrand(candidate);

      if (!normalizedBrand) {
        continue;
      }

      if (knownBrands.has(normalizedBrand)) {
        continue;
      }

      const current =
        candidatesMap.get(normalizedBrand) ?? {
          canonicalBrand: candidate
            .trim()
            .toUpperCase(),
          normalizedBrand,
          productCount: 0,
          occurrenceCount: 0,
          confidence: 0,
          sampleProductIds: [],
        };

      current.productCount += 1;
      current.occurrenceCount += 1;

      if (
        current.sampleProductIds.length < 10
      ) {
        current.sampleProductIds.push(
          product.id,
        );
      }

      candidatesMap.set(
        normalizedBrand,
        current,
      );
    }

    const candidates = Array.from(
      candidatesMap.values(),
    )
      .map((candidate) => {
        const confidence =
          calculateConfidence(
            candidate.productCount,
          );

        return {
          ...candidate,
          confidence,
        };
      })
      .filter((candidate) => {
        const rejectionReason =
          shouldRejectCandidate(
            candidate.canonicalBrand,
            candidate.confidence,
            candidate.productCount,
            55,
            3,
          );

        return rejectionReason === null;
      })
      .sort(
        (a, b) =>
          b.confidence - a.confidence ||
          b.productCount - a.productCount,
      );

    return {
      success: true,
      unknownProducts: products.length,
      knownBrands: registry.length,
      candidates,
    };
  }

  async promote(
    candidates: BrandCandidate[],
  ) {
    const registry =
      await loadRegistryBrands();

    const existingBrands = new Set(
      registry.map((brand) =>
        normalizeBrand(
          brand.normalized_brand ||
            brand.canonical_brand,
        ),
      ),
    );

    let inserted = 0;
    let skipped = 0;
    let failed = 0;

    const failures: Array<{
      candidate: string;
      error: string;
    }> = [];

    for (const candidate of candidates) {
      if (
        existingBrands.has(
          candidate.normalizedBrand,
        )
      ) {
        skipped += 1;
        continue;
      }

      try {
        const registryBrand =
          await insertRegistryBrand(
            candidate.canonicalBrand,
            candidate.normalizedBrand,
            candidate.productCount,
            'promotion-engine',
            {
              confidence:
                candidate.confidence,
              occurrenceCount:
                candidate.occurrenceCount,
              sampleProductIds:
                candidate.sampleProductIds,
            },
          );

        await insertEvidence(
          registryBrand.id,
          candidate.canonicalBrand,
          candidate.occurrenceCount,
          candidate.confidence,
        );

        existingBrands.add(
          candidate.normalizedBrand,
        );

        inserted += 1;
      } catch (error) {
        failed += 1;

        failures.push({
          candidate.canonicalBrand,
          error: JSON.stringify(error, null, 2),
        });
      }
    }

    return {
      success: failed === 0,
      inserted,
      skipped,
      failed,
      failures,
    };
  }

  async apply() {
    throw new Error('Not implemented');
  }

  async resolve() {
    throw new Error('Not implemented');
  }
}

export const brandEngine =
  new BrandEngine();
