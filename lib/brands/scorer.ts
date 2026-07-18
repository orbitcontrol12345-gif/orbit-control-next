import type {
  BrandCandidateScore,
  BrandConfidence,
  BrandDictionary,
  BrandDictionaryEntry,
  BrandScoringProduct,
  BrandScoringResult,
  BrandScoreEvidence,
} from '@/lib/brands/types';

function cleanText(value: unknown): string {
  return String(value ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeText(value: unknown): string {
  return cleanText(value)
    .toUpperCase()
    .replace(/[^A-Z0-9+&./_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizePartNumber(value: unknown): string {
  return normalizeText(value)
    .replace(/[\s./_-]+/g, '');
}

function containsWholeExpression(
  source: string,
  expression: string
): boolean {
  if (!source || !expression) {
    return false;
  }

  const escaped = expression.replace(
    /[.*+?^${}()|[\]\\]/g,
    '\\$&'
  );

  const regex = new RegExp(
    `(^|[^A-Z0-9])${escaped}([^A-Z0-9]|$)`,
    'i'
  );

  return regex.test(source);
}

function addEvidence(
  target: BrandScoreEvidence[],
  evidence: BrandScoreEvidence
): void {
  const exists = target.some(
    (item) =>
      item.type === evidence.type &&
      normalizeText(item.value) ===
        normalizeText(evidence.value)
  );

  if (!exists) {
    target.push(evidence);
  }
}

function scoreDictionaryEntry(
  product: BrandScoringProduct,
  entry: BrandDictionaryEntry
): BrandCandidateScore {
  const title = normalizeText(
    product.title || product.name
  );

  const manufacturer = normalizeText(
    product.manufacturer
  );

  const existingBrand = normalizeText(
    product.existingBrand
  );

  const partNumber = normalizePartNumber(
    product.partNumber
  );

  const matchedEvidence: BrandScoreEvidence[] = [];

  let score = 0;

  /*
   * البراند الموجود أصلًا في الحقل.
   * مفيد لاحقًا لتوحيد Siemens / SIEMENS وغيرها.
   */
  if (
    existingBrand &&
    (
      existingBrand === entry.normalizedBrand ||
      entry.aliases.some(
        (alias) =>
          normalizeText(alias) === existingBrand
      )
    )
  ) {
    score += 120;

    addEvidence(matchedEvidence, {
      type: 'canonical',
      value: existingBrand,
      points: 120,
      weight: 100,
    });
  }

  /*
   * مطابقة Manufacturer.
   */
  for (const value of entry.manufacturers) {
    const normalizedValue =
      normalizeText(value);

    if (
      normalizedValue &&
      manufacturer === normalizedValue
    ) {
      score += 110;

      addEvidence(matchedEvidence, {
        type: 'manufacturer',
        value,
        points: 110,
        weight: 100,
      });
    }
  }

  /*
   * Alias أو الاسم الرسمي داخل العنوان.
   */
  for (const alias of entry.aliases) {
    const normalizedAlias =
      normalizeText(alias);

    if (
      normalizedAlias &&
      containsWholeExpression(
        title,
        normalizedAlias
      )
    ) {
      const points =
        normalizedAlias ===
        entry.normalizedBrand
          ? 100
          : 90;

      score += points;

      addEvidence(matchedEvidence, {
        type:
          normalizedAlias ===
          entry.normalizedBrand
            ? 'canonical'
            : 'alias',

        value: alias,
        points,
        weight: 100,
      });
    }
  }

  /*
   * Prefix الخاص برقم القطعة.
   */
  for (
    const prefix of
    entry.partNumberPrefixes
  ) {
    const normalizedPrefix =
      normalizePartNumber(prefix);

    if (
      normalizedPrefix.length >= 3 &&
      partNumber.startsWith(
        normalizedPrefix
      )
    ) {
      score += 80;

      addEvidence(matchedEvidence, {
        type: 'part-prefix',
        value: prefix,
        points: 80,
        weight: 80,
      });
    }
  }

  /*
   * إشارات موجودة داخل العنوان.
   */
  for (
    const token of
    entry.titleTokens
  ) {
    const normalizedToken =
      normalizeText(token);

    if (
      normalizedToken &&
      containsWholeExpression(
        title,
        normalizedToken
      )
    ) {
      score += 25;

      addEvidence(matchedEvidence, {
        type: 'title-token',
        value: token,
        points: 25,
        weight: 25,
      });
    }
  }

  return {
    brandId: entry.brandId,
    brand: entry.brand,
    normalizedBrand:
      entry.normalizedBrand,
    score,
    matchedEvidence,
  };
}

function determineConfidence(
  bestScore: number,
  secondScore: number
): BrandConfidence {
  const difference =
    bestScore - secondScore;

  if (
    bestScore >= 100 &&
    difference >= 40
  ) {
    return 'high';
  }

  if (
    bestScore >= 80 &&
    difference >= 25
  ) {
    return 'medium';
  }

  if (bestScore >= 40) {
    return 'review';
  }

  return 'unresolved';
}

export function scoreProductBrand(
  product: BrandScoringProduct,
  dictionary: BrandDictionary
): BrandScoringResult {
  const candidates =
    dictionary.entries
      .map((entry) =>
        scoreDictionaryEntry(
          product,
          entry
        )
      )
      .filter(
        (candidate) =>
          candidate.score > 0
      )
      .sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }

        return (
          b.matchedEvidence.length -
          a.matchedEvidence.length
        );
      });

  const best =
    candidates[0] ?? null;

  const second =
    candidates[1] ?? null;

  if (!best) {
    return {
      matched: false,
      brandId: null,
      brand: null,
      normalizedBrand: null,
      score: 0,
      confidence: 'unresolved',
      reasons: [],
      alternatives: [],
    };
  }

  const confidence =
    determineConfidence(
      best.score,
      second?.score ?? 0
    );

  return {
    matched:
      confidence !== 'unresolved',

    brandId:
      confidence !== 'unresolved'
        ? best.brandId
        : null,

    brand:
      confidence !== 'unresolved'
        ? best.brand
        : null,

    normalizedBrand:
      confidence !== 'unresolved'
        ? best.normalizedBrand
        : null,

    score: best.score,
    confidence,
    reasons:
      best.matchedEvidence,

    alternatives:
      candidates.slice(1, 4),
  };
}
