import type {
  BrandConfidence,
  BrandDictionary,
  BrandResolutionQueueItem,
  BrandScoringProduct,
  BrandScoringResult,
} from '@/lib/brands/types';

import {
  scoreProductBrand,
} from '@/lib/brands/scorer';

export const BRAND_UNKNOWN_RESOLVER_VERSION =
  'BRAND-UNKNOWN-RESOLVER-V1';

export interface UnknownBrandProduct
  extends BrandScoringProduct {
  id: number | string;
}

export type UnknownResolutionAction =
  | 'auto-resolve'
  | 'queue-review'
  | 'leave-unresolved';

export interface UnknownBrandResolution {
  productId: number | string;

  action: UnknownResolutionAction;

  suggestedBrandId: number | null;
  suggestedBrand: string | null;
  normalizedBrand: string | null;

  score: number;
  confidence: BrandConfidence;

  reasons: BrandScoringResult['reasons'];
  alternatives: BrandScoringResult['alternatives'];

  queueItem: BrandResolutionQueueItem | null;
}

export interface UnknownBrandResolutionSummary {
  processed: number;

  autoResolveCount: number;
  reviewCount: number;
  unresolvedCount: number;

  highConfidenceCount: number;
  mediumConfidenceCount: number;
}

export interface UnknownBrandResolutionBatch {
  resolverVersion: string;

  generatedAt: string;

  summary: UnknownBrandResolutionSummary;

  results: UnknownBrandResolution[];
}

function cleanText(
  value: unknown
): string {
  return String(value ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeExistingBrand(
  value: unknown
): string {
  return cleanText(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '');
}

/**
 * يحدد هل المنتج فعلًا بحاجة إلى حل البراند.
 *
 * لا نعتمد فقط على UNKNOWN، بل نعتبر القيم الفارغة
 * والقيم العامة غير المفيدة بحاجة إلى معالجة أيضًا.
 */
export function isUnknownBrand(
  value: unknown
): boolean {
  const normalized =
    normalizeExistingBrand(value);

  if (!normalized) {
    return true;
  }

  return [
    'UNKNOWN',
    'UNBRANDED',
    'NOBRAND',
    'NOTSPECIFIED',
    'NOTAPPLICABLE',
    'NA',
    'NONE',
    'GENERIC',
  ].includes(normalized);
}

function determineAction(
  result: BrandScoringResult
): UnknownResolutionAction {
  /*
   * نسمح بالتحديث التلقائي فقط عند الثقة العالية.
   *
   * medium لا نحدثه تلقائيًا في الإصدار الأول،
   * بل نرسله إلى المراجعة حمايةً للبيانات.
   */
  if (
    result.matched &&
    result.confidence === 'high' &&
    result.brandId !== null
  ) {
    return 'auto-resolve';
  }

  if (
    result.matched &&
    (
      result.confidence === 'medium' ||
      result.confidence === 'review'
    )
  ) {
    return 'queue-review';
  }

  return 'leave-unresolved';
}

function buildQueueItem(
  productId: number | string,
  result: BrandScoringResult,
  action: UnknownResolutionAction
): BrandResolutionQueueItem | null {
  if (action === 'leave-unresolved') {
    return null;
  }

  return {
    productId,

    suggestedBrandId:
      result.brandId,

    suggestedBrand:
      result.brand,

    score:
      result.score,

    confidence:
      result.confidence,

    reasons:
      result.reasons,

    status:
      action === 'auto-resolve'
        ? 'resolved'
        : 'pending',
  };
}

/**
 * يحلل منتجًا واحدًا.
 *
 * لا يكتب إلى قاعدة البيانات.
 * لا يعدّل المنتج.
 * يعيد القرار فقط.
 */
export function resolveUnknownBrand(
  product: UnknownBrandProduct,
  dictionary: BrandDictionary
): UnknownBrandResolution {
  const scoringProduct: BrandScoringProduct = {
    id: product.id,

    name:
      product.name ?? null,

    title:
      product.title ?? null,

    partNumber:
      product.partNumber ?? null,

    manufacturer:
      product.manufacturer ?? null,

    /*
     * لأننا نحل منتجات UNKNOWN،
     * لا نريد إعطاء نقاط للبراند الحالي غير المفيد.
     */
    existingBrand:
      isUnknownBrand(
        product.existingBrand
      )
        ? null
        : product.existingBrand,
  };

  const result =
    scoreProductBrand(
      scoringProduct,
      dictionary
    );

  const action =
    determineAction(result);

  return {
    productId:
      product.id,

    action,

    suggestedBrandId:
      result.brandId,

    suggestedBrand:
      result.brand,

    normalizedBrand:
      result.normalizedBrand,

    score:
      result.score,

    confidence:
      result.confidence,

    reasons:
      result.reasons,

    alternatives:
      result.alternatives,

    queueItem:
      buildQueueItem(
        product.id,
        result,
        action
      ),
  };
}

/**
 * يحلل مجموعة منتجات ويعيد إحصائيات كاملة.
 *
 * لا توجد أي كتابة في قاعدة البيانات.
 */
export function resolveUnknownBrands(
  products: UnknownBrandProduct[],
  dictionary: BrandDictionary
): UnknownBrandResolutionBatch {
  const results =
    products.map((product) =>
      resolveUnknownBrand(
        product,
        dictionary
      )
    );

  const autoResolveCount =
    results.filter(
      (item) =>
        item.action ===
        'auto-resolve'
    ).length;

  const reviewCount =
    results.filter(
      (item) =>
        item.action ===
        'queue-review'
    ).length;

  const unresolvedCount =
    results.filter(
      (item) =>
        item.action ===
        'leave-unresolved'
    ).length;

  const highConfidenceCount =
    results.filter(
      (item) =>
        item.confidence === 'high'
    ).length;

  const mediumConfidenceCount =
    results.filter(
      (item) =>
        item.confidence === 'medium'
    ).length;

  return {
    resolverVersion:
      BRAND_UNKNOWN_RESOLVER_VERSION,

    generatedAt:
      new Date().toISOString(),

    summary: {
      processed:
        results.length,

      autoResolveCount,

      reviewCount,

      unresolvedCount,

      highConfidenceCount,

      mediumConfidenceCount,
    },

    results,
  };
}
