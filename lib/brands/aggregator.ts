import type {
  ExtractedBrandEvidenceCandidate,
} from '@/lib/brands/extractor';

export const BRAND_AGGREGATOR_VERSION =
  'BRAND-EVIDENCE-AGGREGATOR-V1';

export type EvidenceRecommendation =
  | 'auto-approve'
  | 'review'
  | 'reject';

export interface AggregatedBrandEvidence {
  type:
    ExtractedBrandEvidenceCandidate['type'];

  value: string;
  normalizedValue: string;

  occurrenceCount: number;
  productCount: number;

  distinctBrandCount: number;

  winningBrandId: number;
  winningBrand: string;
  winningBrandCount: number;

  conflictingCount: number;
  purity: number;

  recommendation:
    EvidenceRecommendation;

  reason: string;

  brandDistribution: Array<{
    brandId: number;
    canonicalBrand: string;
    count: number;
    percentage: number;
  }>;

  sampleProductIds: Array<
    number | string
  >;
}

interface EvidenceGroup {
  type:
    ExtractedBrandEvidenceCandidate['type'];

  value: string;
  normalizedValue: string;

  candidates:
    ExtractedBrandEvidenceCandidate[];
}

function roundPercentage(
  value: number
): number {
  return Number(
    value.toFixed(2)
  );
}

function getRecommendation(
  occurrenceCount: number,
  distinctBrandCount: number,
  purity: number,
  normalizedValue: string
): {
  recommendation:
    EvidenceRecommendation;

  reason: string;
} {
  const numericOnly =
    /^\d+$/.test(normalizedValue);

  /*
   * الأدلة الرقمية مثل 1756 تحتاج
   * عدد ظهور أكبر لأنها قد تتكرر
   * بين أكثر من شركة.
   */
  const minimumAutoApproveCount =
    numericOnly ? 5 : 3;

  if (
    occurrenceCount >=
      minimumAutoApproveCount &&
    distinctBrandCount === 1 &&
    purity === 100
  ) {
    return {
      recommendation:
        'auto-approve',

      reason:
        numericOnly
          ? 'Numeric family appeared repeatedly with one brand only'
          : 'Evidence appeared repeatedly with one brand only',
    };
  }

  if (
    occurrenceCount >= 5 &&
    purity >= 98
  ) {
    return {
      recommendation:
        'auto-approve',

      reason:
        'Evidence has very high purity and sufficient occurrences',
    };
  }

  if (
    occurrenceCount >= 2 &&
    purity >= 80
  ) {
    return {
      recommendation:
        'review',

      reason:
        'Evidence is promising but requires manual review',
    };
  }

  if (
    occurrenceCount === 1 &&
    distinctBrandCount === 1
  ) {
    return {
      recommendation:
        'review',

      reason:
        'Evidence appeared once only',
    };
  }

  return {
    recommendation:
      'reject',

    reason:
      distinctBrandCount > 1
        ? 'Evidence conflicts across multiple brands'
        : 'Evidence does not have enough supporting occurrences',
  };
}

function uniqueProductIds(
  candidates:
    ExtractedBrandEvidenceCandidate[]
): Array<number | string> {
  return Array.from(
    new Set(
      candidates.map(
        (candidate) =>
          candidate.productId
      )
    )
  );
}

export function aggregateBrandEvidence(
  candidates:
    ExtractedBrandEvidenceCandidate[]
): AggregatedBrandEvidence[] {
  const groups =
    new Map<string, EvidenceGroup>();

  for (const candidate of candidates) {
    const normalizedValue =
      candidate.normalizedValue
        .trim()
        .toUpperCase();

    if (!normalizedValue) {
      continue;
    }

    const key = [
      candidate.type,
      normalizedValue,
    ].join(':');

    const existing =
      groups.get(key);

    if (existing) {
      existing.candidates.push(
        candidate
      );

      continue;
    }

    groups.set(key, {
      type:
        candidate.type,

      value:
        candidate.value,

      normalizedValue,

      candidates: [
        candidate,
      ],
    });
  }

  const aggregated:
    AggregatedBrandEvidence[] = [];

  for (const group of groups.values()) {
    const productIds =
      uniqueProductIds(
        group.candidates
      );

    /*
     * نحسب عدد المنتجات لكل براند.
     * نستخدم Product ID الفريد حتى لا
     * يحسب المنتج نفسه أكثر من مرة.
     */
    const brandProducts =
      new Map<
        number,
        {
          canonicalBrand: string;
          productIds:
            Set<number | string>;
        }
      >();

    for (
      const candidate
      of group.candidates
    ) {
      const existing =
        brandProducts.get(
          candidate.brandId
        );

      if (existing) {
        existing.productIds.add(
          candidate.productId
        );

        continue;
      }

      brandProducts.set(
        candidate.brandId,
        {
          canonicalBrand:
            candidate.canonicalBrand,

          productIds:
            new Set([
              candidate.productId,
            ]),
        }
      );
    }

    const distribution =
      Array.from(
        brandProducts.entries()
      )
        .map(
          ([
            brandId,
            brandData,
          ]) => ({
            brandId,

            canonicalBrand:
              brandData
                .canonicalBrand,

            count:
              brandData
                .productIds
                .size,
          })
        )
        .sort(
          (a, b) =>
            b.count - a.count
        );

    const winner =
      distribution[0];

    if (!winner) {
      continue;
    }

    const occurrenceCount =
      productIds.length;

    const winningBrandCount =
      winner.count;

    const conflictingCount =
      Math.max(
        occurrenceCount -
          winningBrandCount,
        0
      );

    const purity =
      occurrenceCount > 0
        ? roundPercentage(
            (
              winningBrandCount /
              occurrenceCount
            ) * 100
          )
        : 0;

    const recommendation =
      getRecommendation(
        occurrenceCount,
        distribution.length,
        purity,
        group.normalizedValue
      );

    aggregated.push({
      type:
        group.type,

      value:
        group.value,

      normalizedValue:
        group.normalizedValue,

      occurrenceCount,

      productCount:
        occurrenceCount,

      distinctBrandCount:
        distribution.length,

      winningBrandId:
        winner.brandId,

      winningBrand:
        winner.canonicalBrand,

      winningBrandCount,

      conflictingCount,

      purity,

      recommendation:
        recommendation
          .recommendation,

      reason:
        recommendation.reason,

      brandDistribution:
        distribution.map(
          (item) => ({
            ...item,

            percentage:
              occurrenceCount > 0
                ? roundPercentage(
                    (
                      item.count /
                      occurrenceCount
                    ) * 100
                  )
                : 0,
          })
        ),

      sampleProductIds:
        productIds.slice(0, 10),
    });
  }

  return aggregated.sort(
    (a, b) => {
      const priority:
        Record<
          EvidenceRecommendation,
          number
        > = {
          'auto-approve': 3,
          review: 2,
          reject: 1,
        };

      const priorityDifference =
        priority[
          b.recommendation
        ] -
        priority[
          a.recommendation
        ];

      if (
        priorityDifference !== 0
      ) {
        return priorityDifference;
      }

      if (b.purity !== a.purity) {
        return (
          b.purity -
          a.purity
        );
      }

      return (
        b.occurrenceCount -
        a.occurrenceCount
      );
    }
  );
}
