export const BRAND_SCORING_ENGINE_VERSION =
  'BRAND-SCORING-ENGINE-V1';

export type BrandDictionaryEntry = {
  brand: string;
  aliases: string[];
  partNumberPrefixes: string[];
};

export type BrandScoringInput = {
  title?: string | null;
  partNumber?: string | null;
  manufacturer?: string | null;
  brand?: string | null;
};

export type BrandScoreEvidence = {
  type:
    | 'existing-brand'
    | 'manufacturer'
    | 'title-canonical'
    | 'title-alias'
    | 'part-number-prefix';

  value: string;
  matchedValue: string;
  points: number;
};

export type BrandScoreCandidate = {
  brand: string;
  score: number;
  evidence: BrandScoreEvidence[];
};

export type BrandScoringResult = {
  engineVersion: string;

  matched: boolean;
  brand: string | null;

  score: number;
  confidence: number;

  decision:
    | 'high-confidence'
    | 'medium-confidence'
    | 'review'
    | 'unresolved';

  secondPlaceScore: number;
  scoreGap: number;

  evidence: BrandScoreEvidence[];
  candidates: BrandScoreCandidate[];
};

const INVALID_VALUES = new Set([
  '',
  'UNKNOWN',
  'UNBRANDED',
  'GENERIC',
  'DOES NOT APPLY',
  'DOES NOT APPLY.',
  'N/A',
  'NA',
  'NONE',
  'NO BRAND',
  'NOT APPLICABLE',
  'OTHER',
]);

function normalizeSpace(value: unknown): string {
  return String(value ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/[®™©]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeUpper(value: unknown): string {
  return normalizeSpace(value).toUpperCase();
}

function normalizeComparable(value: unknown): string {
  return normalizeUpper(value)
    .replace(/&/g, ' AND ')
    .replace(/[^A-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeCompact(value: unknown): string {
  return normalizeUpper(value)
    .replace(/[^A-Z0-9]/g, '')
    .trim();
}

function isValidValue(value: unknown): boolean {
  const normalized = normalizeUpper(value);

  if (!normalized) return false;
  if (INVALID_VALUES.has(normalized)) return false;

  return true;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function containsWholePhrase(
  textValue: unknown,
  phraseValue: unknown
): boolean {
  const text = normalizeComparable(textValue);
  const phrase = normalizeComparable(phraseValue);

  if (!text || !phrase) return false;

  const pattern = new RegExp(
    `(?:^|\\s)${escapeRegExp(phrase)}(?:$|\\s)`,
    'i'
  );

  return pattern.test(text);
}

function equalsNormalized(
  left: unknown,
  right: unknown
): boolean {
  const a = normalizeComparable(left);
  const b = normalizeComparable(right);

  return Boolean(a && b && a === b);
}

function startsWithPartPrefix(
  partNumberValue: unknown,
  prefixValue: unknown
): boolean {
  const partNumber = normalizeCompact(partNumberValue);
  const prefix = normalizeCompact(prefixValue);

  if (!partNumber || !prefix) return false;
  if (prefix.length < 4) return false;

  return partNumber.startsWith(prefix);
}

function addEvidence(
  scoreMap: Map<string, BrandScoreCandidate>,
  brandValue: string,
  evidence: BrandScoreEvidence
): void {
  const brand = normalizeUpper(brandValue);

  if (!brand) return;

  const current = scoreMap.get(brand) ?? {
    brand,
    score: 0,
    evidence: [],
  };

  const duplicate = current.evidence.some(
    (item) =>
      item.type === evidence.type &&
      item.value === evidence.value &&
      item.matchedValue === evidence.matchedValue
  );

  if (duplicate) return;

  current.score += evidence.points;
  current.evidence.push(evidence);

  scoreMap.set(brand, current);
}

function getPartPrefixPoints(prefix: string): number {
  const length = normalizeCompact(prefix).length;

  if (length >= 8) return 150;
  if (length === 7) return 140;
  if (length === 6) return 130;
  if (length === 5) return 120;

  return 110;
}

function getAliasPoints(
  alias: string,
  canonicalBrand: string
): number {
  const normalizedAlias = normalizeComparable(alias);
  const normalizedBrand =
    normalizeComparable(canonicalBrand);

  if (normalizedAlias === normalizedBrand) {
    return 100;
  }

  const words = normalizedAlias
    .split(/\s+/)
    .filter(Boolean);

  if (words.length >= 3) return 90;
  if (words.length === 2) return 85;

  return 80;
}

function calculateConfidence(
  winnerScore: number,
  secondPlaceScore: number
): number {
  if (winnerScore <= 0) return 0;

  const gap = winnerScore - secondPlaceScore;

  const scoreStrength = Math.min(
    1,
    winnerScore / 250
  );

  const gapStrength = Math.min(
    1,
    gap / 120
  );

  const confidence =
    scoreStrength * 65 +
    gapStrength * 35;

  return Number(
    Math.min(100, confidence).toFixed(2)
  );
}

function getDecision(
  score: number,
  confidence: number,
  scoreGap: number,
  evidence: BrandScoreEvidence[]
): BrandScoringResult['decision'] {
  const hasPartPrefix = evidence.some(
    (item) => item.type === 'part-number-prefix'
  );

  const hasStrongField = evidence.some(
    (item) =>
      item.type === 'existing-brand' ||
      item.type === 'manufacturer'
  );

  const evidenceTypes = new Set(
    evidence.map((item) => item.type)
  );

  if (
    score >= 180 &&
    confidence >= 85 &&
    scoreGap >= 80 &&
    (
      hasPartPrefix ||
      hasStrongField ||
      evidenceTypes.size >= 2
    )
  ) {
    return 'high-confidence';
  }

  if (
    score >= 120 &&
    confidence >= 65 &&
    scoreGap >= 40
  ) {
    return 'medium-confidence';
  }

  if (score >= 80) {
    return 'review';
  }

  return 'unresolved';
}

export function scoreProductBrand(
  input: BrandScoringInput,
  dictionary: BrandDictionaryEntry[]
): BrandScoringResult {
  const scoreMap = new Map<
    string,
    BrandScoreCandidate
  >();

  for (const dictionaryEntry of dictionary) {
    const canonicalBrand = normalizeUpper(
      dictionaryEntry.brand
    );

    if (!canonicalBrand) continue;

    /*
     * 1. البراند الموجود حاليًا
     * أقوى دليل عندما يطابق الاسم الأساسي أو Alias.
     */
    if (isValidValue(input.brand)) {
      if (
        equalsNormalized(
          input.brand,
          canonicalBrand
        )
      ) {
        addEvidence(scoreMap, canonicalBrand, {
          type: 'existing-brand',
          value: normalizeUpper(input.brand),
          matchedValue: canonicalBrand,
          points: 160,
        });
      }

      for (const alias of dictionaryEntry.aliases ?? []) {
        if (
          equalsNormalized(input.brand, alias)
        ) {
          addEvidence(scoreMap, canonicalBrand, {
            type: 'existing-brand',
            value: normalizeUpper(input.brand),
            matchedValue: normalizeUpper(alias),
            points: 145,
          });
        }
      }
    }

    /*
     * 2. Manufacturer
     */
    if (isValidValue(input.manufacturer)) {
      if (
        equalsNormalized(
          input.manufacturer,
          canonicalBrand
        )
      ) {
        addEvidence(scoreMap, canonicalBrand, {
          type: 'manufacturer',
          value: normalizeUpper(
            input.manufacturer
          ),
          matchedValue: canonicalBrand,
          points: 140,
        });
      }

      for (const alias of dictionaryEntry.aliases ?? []) {
        if (
          equalsNormalized(
            input.manufacturer,
            alias
          )
        ) {
          addEvidence(scoreMap, canonicalBrand, {
            type: 'manufacturer',
            value: normalizeUpper(
              input.manufacturer
            ),
            matchedValue: normalizeUpper(alias),
            points: 130,
          });
        }
      }
    }

    /*
     * 3. اسم البراند الأساسي داخل العنوان
     */
    if (
      containsWholePhrase(
        input.title,
        canonicalBrand
      )
    ) {
      addEvidence(scoreMap, canonicalBrand, {
        type: 'title-canonical',
        value: normalizeUpper(input.title),
        matchedValue: canonicalBrand,
        points: 100,
      });
    }

    /*
     * 4. Aliases داخل العنوان
     */
    for (const alias of dictionaryEntry.aliases ?? []) {
      const normalizedAlias =
        normalizeUpper(alias);

      if (!normalizedAlias) continue;

      if (
        equalsNormalized(
          normalizedAlias,
          canonicalBrand
        )
      ) {
        continue;
      }

      if (
        containsWholePhrase(
          input.title,
          normalizedAlias
        )
      ) {
        addEvidence(scoreMap, canonicalBrand, {
          type: 'title-alias',
          value: normalizeUpper(input.title),
          matchedValue: normalizedAlias,
          points: getAliasPoints(
            normalizedAlias,
            canonicalBrand
          ),
        });
      }
    }

    /*
     * 5. Part Number Prefix
     * هذا الدليل قوي جدًا عندما يكون Prefix نظيفًا.
     */
    for (
      const prefix of
      dictionaryEntry.partNumberPrefixes ?? []
    ) {
      if (
        startsWithPartPrefix(
          input.partNumber,
          prefix
        )
      ) {
        addEvidence(scoreMap, canonicalBrand, {
          type: 'part-number-prefix',
          value: normalizeCompact(
            input.partNumber
          ),
          matchedValue:
            normalizeCompact(prefix),
          points: getPartPrefixPoints(prefix),
        });
      }
    }
  }

  const candidates = Array.from(
    scoreMap.values()
  )
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }

      return a.brand.localeCompare(b.brand);
    });

  const winner = candidates[0];
  const secondPlace = candidates[1];

  if (!winner) {
    return {
      engineVersion:
        BRAND_SCORING_ENGINE_VERSION,

      matched: false,
      brand: null,

      score: 0,
      confidence: 0,

      decision: 'unresolved',

      secondPlaceScore: 0,
      scoreGap: 0,

      evidence: [],
      candidates: [],
    };
  }

  const secondPlaceScore =
    secondPlace?.score ?? 0;

  const scoreGap =
    winner.score - secondPlaceScore;

  const confidence = calculateConfidence(
    winner.score,
    secondPlaceScore
  );

  const decision = getDecision(
    winner.score,
    confidence,
    scoreGap,
    winner.evidence
  );

  return {
    engineVersion:
      BRAND_SCORING_ENGINE_VERSION,

    matched: decision !== 'unresolved',
    brand: winner.brand,

    score: winner.score,
    confidence,

    decision,

    secondPlaceScore,
    scoreGap,

    evidence: winner.evidence,

    candidates: candidates.slice(0, 5),
  };
}
