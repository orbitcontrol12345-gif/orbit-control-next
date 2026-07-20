import {
  insertEvidence,
  insertRegistryBrand,
  loadRegistryBrands,
  loadUnknownProducts,
  updateProductsBrand,
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

function extractCandidate(
  title: string,
): string | null {
  const words = title
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((word) => word.trim())
    .filter(Boolean);

  if (words.length === 0) {
    return null;
  }

  const firstWord = normalizeBrand(
    words[0],
  );

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

function calculateConfidence(
  productCount: number,
): number {
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

function getErrorMessage(
  error: unknown,
): string {
  if (error instanceof Error) {
    return (
      error.stack ??
      error.message
    );
  }

  try {
    return JSON.stringify(
      error,
      null,
      2,
    );
  } catch {
    return String(error);
  }
}

export class BrandEngine {
  async learn() {
    const extracted =
      await this.extract();

    const promoted =
      await this.promote(
        extracted.candidates,
      );

    const resolved =
      await this.resolve();

    return {
      success:
        promoted.failed === 0 &&
        resolved.failed === 0,

      unknownProducts:
        extracted.unknownProducts,

      knownBrands:
        extracted.knownBrands,

      candidates:
        extracted.candidates.length,

      promoted:
        promoted.inserted,

      promotionSkipped:
        promoted.skipped,

      promotionFailed:
        promoted.failed,

      resolved:
        resolved.updatedProducts,

      unresolved:
        resolved.unresolvedProducts,

      resolutionFailed:
        resolved.failed,

      promotionFailures:
        promoted.failures,

      resolutionFailures:
        resolved.failures,
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
      const candidate =
        extractCandidate(
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

      if (
        knownBrands.has(
          normalizedBrand,
        )
      ) {
        continue;
      }

      const current =
        candidatesMap.get(
          normalizedBrand,
        ) ?? {
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
        current.sampleProductIds
          .length < 10
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
      .map((candidate) => ({
        ...candidate,

        confidence:
          calculateConfidence(
            candidate.productCount,
          ),
      }))
      .filter((candidate) => {
        const rejectionReason =
          shouldRejectCandidate(
            candidate.canonicalBrand,
            candidate.confidence,
            candidate.productCount,
            55,
            3,
          );

        return (
          rejectionReason === null
        );
      })
      .sort(
        (a, b) =>
          b.confidence -
            a.confidence ||
          b.productCount -
            a.productCount,
      );

    return {
      success: true,
      unknownProducts:
        products.length,
      knownBrands:
        registry.length,
      candidates,
    };
  }

  async promote(
    candidates: BrandCandidate[],
  ) {
    const registry =
      await loadRegistryBrands();

    const existingBrands =
      new Set(
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
          candidate:
            candidate.canonicalBrand,

          error:
            getErrorMessage(error),
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
    return this.resolve();
  }

  async resolve() {
    const products =
      await loadUnknownProducts(5000);

    const registry =
      await loadRegistryBrands();

    const registryMap = new Map<
      string,
      string
    >();

    for (const brand of registry) {
      if (
        brand.status &&
        brand.status !== 'active'
      ) {
        continue;
      }

      const normalized =
        normalizeBrand(
          brand.normalized_brand ||
            brand.canonical_brand,
        );

      if (!normalized) {
        continue;
      }

      registryMap.set(
        normalized,
        brand.canonical_brand,
      );
    }

    const productsByBrand =
      new Map<string, number[]>();

    let unresolvedProducts = 0;

    for (const product of products) {
      const candidate =
        extractCandidate(
          String(product.name ?? ''),
        );

      if (!candidate) {
        unresolvedProducts += 1;
        continue;
      }

      const normalizedCandidate =
        normalizeBrand(candidate);

      const canonicalBrand =
        registryMap.get(
          normalizedCandidate,
        );

      if (!canonicalBrand) {
        unresolvedProducts += 1;
        continue;
      }

      const ids =
        productsByBrand.get(
          canonicalBrand,
        ) ?? [];

      ids.push(product.id);

      productsByBrand.set(
        canonicalBrand,
        ids,
      );
    }

    let updatedProducts = 0;
    let failed = 0;

    const failures: Array<{
      brand: string;
      productCount: number;
      error: string;
    }> = [];

    for (
      const [
        canonicalBrand,
        productIds,
      ] of productsByBrand
    ) {
      try {
        const updated =
          await updateProductsBrand(
            productIds,
            canonicalBrand,
          );

        updatedProducts += updated;
      } catch (error) {
        failed += 1;

        failures.push({
          brand: canonicalBrand,
          productCount:
            productIds.length,
          error:
            getErrorMessage(error),
        });
      }
    }

    return {
      success: failed === 0,
      scannedProducts:
        products.length,
      matchedBrands:
        productsByBrand.size,
      updatedProducts,
      unresolvedProducts,
      failed,
      failures,
    };
  }
}

export const brandEngine =
  new BrandEngine();
