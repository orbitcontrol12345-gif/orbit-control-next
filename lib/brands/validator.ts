import type {
  AggregatedBrandEvidence,
} from '@/lib/brands/aggregator';

export const BRAND_EVIDENCE_VALIDATOR_VERSION =
  'BRAND-EVIDENCE-VALIDATOR-V1';

export type ValidationDecision =
  | 'eligible'
  | 'manual-review'
  | 'blocked';

export interface ValidatedBrandEvidence
  extends AggregatedBrandEvidence {
  validationDecision:
    ValidationDecision;

  validationScore: number;

  validationReasons: string[];

  validationWarnings: string[];
}

const GENERIC_PREFIXES = new Set([
  'AC',
  'DC',
  'CPU',
  'PLC',
  'PCB',
  'HMI',
  'VFD',
  'LED',
  'LCD',
  'USB',
  'DIN',
  'POWER',
  'BOARD',
  'MODULE',
  'RELAY',
  'CONTROL',
  'SYSTEM',
  'MOTOR',
  'PANEL',
  'SENSOR',
  'SWITCH',
  'VALVE',
  'DRIVE',
  'TYPE',
  'MODEL',
  'PART',
  'NUMBER',
  'SERIAL',
  'UNKNOWN',
]);

/**
 * عائلات صناعية رقمية معروفة.
 *
 * لا نريد قبول أي رقم مؤلف من 4 أرقام
 * تلقائيًا إلا إذا كان متكررًا بقوة،
 * لذلك القائمة هنا ليست اعتمادًا نهائيًا،
 * لكنها تمنح المرشح ثقة إضافية.
 */
const KNOWN_NUMERIC_PRODUCT_FAMILIES =
  new Set([
    '1756',
    '1769',
    '1746',
    '1794',
    '1734',
    '2711',
    '1785',
    '1771',
    '1400',
    '1606',
    '2080',
    '2085',
    '2198',
    '22A',
    '22B',
  ]);

/**
 * Prefixes معروفة وقوية في الأتمتة الصناعية.
 *
 * هذا ليس قاموس البراندات النهائي.
 * القائمة فقط تساعد Validator على تقييم الشكل.
 */
const KNOWN_STRONG_PREFIX_PATTERNS: RegExp[] = [
  /^6ES\d$/,
  /^6AV\d?$/,
  /^6GK\d?$/,
  /^6SL\d?$/,
  /^3BSE$/,
  /^3HAC$/,
  /^3ABD$/,
  /^IC\d{3}$/,
  /^ACS\d{3}$/,
  /^ATV\d{2,3}$/,
  /^AAB\d{3}$/,
  /^FX\d?[A-Z]?$/,
  /^Q\d{2}[A-Z]?$/,
  /^CJ\d[A-Z]?$/,
  /^CP\d[A-Z]?$/,
  /^NJ\d[A-Z]?$/,
  /^NX\d[A-Z]?$/,
  /^CJ1[A-Z]?$/,
  /^CJ2[A-Z]?$/,
  /^S7\d{2,3}$/,
];

function normalizeEvidenceValue(
  value: unknown
): string {
  return String(value ?? '')
    .toUpperCase()
    .replace(/[™®©]/g, '')
    .replace(/[^A-Z0-9]/g, '')
    .trim();
}

function clampScore(
  score: number
): number {
  return Math.min(
    Math.max(score, 0),
    100
  );
}

function isNumericOnly(
  value: string
): boolean {
  return /^\d+$/.test(value);
}

function hasLettersAndNumbers(
  value: string
): boolean {
  return (
    /[A-Z]/.test(value) &&
    /\d/.test(value)
  );
}

function countLetters(
  value: string
): number {
  return (
    value.match(/[A-Z]/g) ?? []
  ).length;
}

function countNumbers(
  value: string
): number {
  return (
    value.match(/\d/g) ?? []
  ).length;
}

function looksLikeKnownStrongFamily(
  value: string
): boolean {
  return KNOWN_STRONG_PREFIX_PATTERNS.some(
    (pattern) =>
      pattern.test(value)
  );
}

/**
 * بعض القيم مثل R0011 قد تتكرر ضمن قطع ABB،
 * لكنها تبدو أقرب إلى suffix أو revision code
 * وليست عائلة منتجات مستقلة.
 */
function looksLikeWeakRevisionCode(
  value: string
): boolean {
  return (
    /^[A-Z]\d{4,}$/.test(value) &&
    !looksLikeKnownStrongFamily(value)
  );
}

/**
 * مثال:
 *
 * R0011
 * R0001
 * V12345
 *
 * هذه الصيغة غالبًا رقم إصدار أو جزء داخلي
 * وليست Product Family قوية.
 */
function looksLikeSingleLetterSerial(
  value: string
): boolean {
  return /^[A-Z]\d{4,8}$/.test(
    value
  );
}

/**
 * مثال لقيم طويلة تبدو كرقم قطعة كامل:
 *
 * A12345678
 * ABC1234567
 * 12345ABCDE
 */
function looksLikeFullPartNumber(
  value: string
): boolean {
  if (value.length < 8) {
    return false;
  }

  const letters =
    countLetters(value);

  const numbers =
    countNumbers(value);

  return (
    letters >= 1 &&
    numbers >= 5
  );
}

function validatePartPrefix(
  evidence:
    AggregatedBrandEvidence
): ValidatedBrandEvidence {
  const value =
    normalizeEvidenceValue(
      evidence.normalizedValue
    );

  const reasons: string[] = [];
  const warnings: string[] = [];

  let score = 50;
  let hardBlocked = false;

  if (!value) {
    hardBlocked = true;
    score = 0;

    reasons.push(
      'Evidence value is empty'
    );
  }

  if (
    GENERIC_PREFIXES.has(value)
  ) {
    hardBlocked = true;
    score = 0;

    reasons.push(
      'Evidence is a generic industrial term'
    );
  }

  if (value.length < 2) {
    hardBlocked = true;
    score -= 60;

    reasons.push(
      'Prefix is shorter than two characters'
    );
  }

  if (value.length > 16) {
    hardBlocked = true;
    score -= 50;

    reasons.push(
      'Prefix is too long and may be a full part number'
    );
  }

  if (
    evidence.distinctBrandCount > 1
  ) {
    score -= 45;

    reasons.push(
      `Prefix conflicts across ${evidence.distinctBrandCount} brands`
    );
  } else {
    score += 10;

    reasons.push(
      'Prefix belongs to one brand in the tested dataset'
    );
  }

  if (evidence.purity === 100) {
    score += 15;

    reasons.push(
      'Prefix has 100% brand purity'
    );
  } else if (
    evidence.purity >= 98
  ) {
    score += 10;

    reasons.push(
      'Prefix has very high brand purity'
    );
  } else if (
    evidence.purity >= 90
  ) {
    score += 2;

    warnings.push(
      'Prefix purity is below automatic approval level'
    );
  } else {
    score -= 30;

    reasons.push(
      'Prefix purity is too low'
    );
  }

  if (
    evidence.occurrenceCount >= 10
  ) {
    score += 20;

    reasons.push(
      'Prefix has strong repetition across products'
    );
  } else if (
    evidence.occurrenceCount >= 5
  ) {
    score += 12;

    reasons.push(
      'Prefix has sufficient repetition'
    );
  } else if (
    evidence.occurrenceCount >= 3
  ) {
    score += 5;

    warnings.push(
      'Prefix has limited repetition'
    );
  } else {
    score -= 15;

    warnings.push(
      'Prefix has fewer than three supporting products'
    );
  }

  if (
    hasLettersAndNumbers(value)
  ) {
    score += 8;

    reasons.push(
      'Prefix contains letters and numbers'
    );
  }

  if (
    looksLikeKnownStrongFamily(
      value
    )
  ) {
    score += 20;

    reasons.push(
      'Prefix matches a strong industrial product-family pattern'
    );
  }

  if (isNumericOnly(value)) {
    if (
      value.length !== 4
    ) {
      score -= 35;

      reasons.push(
        'Numeric prefix is not a four-digit product family'
      );
    } else if (
      KNOWN_NUMERIC_PRODUCT_FAMILIES.has(
        value
      )
    ) {
      score += 15;

      reasons.push(
        'Numeric prefix matches a recognized product-family pattern'
      );
    } else {
      score -= 8;

      warnings.push(
        'Numeric-only prefix requires stronger manual verification'
      );
    }

    /*
     * رقم فقط لا يُعتمد بسهولة.
     */
    if (
      evidence.occurrenceCount < 8
    ) {
      warnings.push(
        'Numeric-only prefix has fewer than eight occurrences'
      );
    }
  }

  if (
    looksLikeWeakRevisionCode(value)
  ) {
    score -= 35;

    warnings.push(
      'Prefix resembles a revision or internal component code'
    );
  }

  if (
    looksLikeSingleLetterSerial(
      value
    )
  ) {
    score -= 20;

    warnings.push(
      'Prefix resembles a single-letter serial or revision code'
    );
  }

  if (
    looksLikeFullPartNumber(value)
  ) {
    score -= 35;

    warnings.push(
      'Value may be a complete part number rather than a reusable family'
    );
  }

  if (
    evidence.conflictingCount > 0
  ) {
    score -= 30;

    reasons.push(
      'Conflicting products exist for this prefix'
    );
  }

  score =
    clampScore(score);

  let validationDecision:
    ValidationDecision;

  if (
    hardBlocked ||
    score < 50 ||
    evidence.purity < 90 ||
    evidence.distinctBrandCount > 2
  ) {
    validationDecision =
      'blocked';
  } else if (
    score >= 85 &&
    evidence.purity === 100 &&
    evidence.distinctBrandCount === 1 &&
    evidence.occurrenceCount >= 5 &&
    !looksLikeWeakRevisionCode(
      value
    ) &&
    !looksLikeFullPartNumber(
      value
    )
  ) {
    validationDecision =
      'eligible';
  } else {
    validationDecision =
      'manual-review';
  }

  return {
    ...evidence,

    validationDecision,

    validationScore:
      score,

    validationReasons:
      reasons,

    validationWarnings:
      warnings,
  };
}

function validateOtherEvidence(
  evidence:
    AggregatedBrandEvidence
): ValidatedBrandEvidence {
  const reasons: string[] = [];
  const warnings: string[] = [];

  let score = 50;

  if (
    evidence.distinctBrandCount === 1
  ) {
    score += 15;

    reasons.push(
      'Evidence belongs to one brand'
    );
  } else {
    score -= 35;

    reasons.push(
      'Evidence appears with multiple brands'
    );
  }

  if (
    evidence.purity === 100
  ) {
    score += 15;

    reasons.push(
      'Evidence has 100% purity'
    );
  } else if (
    evidence.purity >= 98
  ) {
    score += 8;
  } else {
    score -= 20;
  }

  if (
    evidence.occurrenceCount >= 5
  ) {
    score += 15;

    reasons.push(
      'Evidence has sufficient repetition'
    );
  } else {
    warnings.push(
      'Evidence needs additional supporting products'
    );
  }

  score =
    clampScore(score);

  const validationDecision:
    ValidationDecision =
      score >= 85 &&
      evidence.purity === 100 &&
      evidence.distinctBrandCount === 1 &&
      evidence.occurrenceCount >= 5
        ? 'eligible'
        : score >= 50
          ? 'manual-review'
          : 'blocked';

  return {
    ...evidence,

    validationDecision,

    validationScore:
      score,

    validationReasons:
      reasons,

    validationWarnings:
      warnings,
  };
}

export function validateAggregatedEvidence(
  evidence:
    AggregatedBrandEvidence
): ValidatedBrandEvidence {
  if (
    evidence.type ===
    'part-prefix'
  ) {
    return validatePartPrefix(
      evidence
    );
  }

  return validateOtherEvidence(
    evidence
  );
}

export function validateAggregatedEvidenceList(
  evidenceList:
    AggregatedBrandEvidence[]
): ValidatedBrandEvidence[] {
  return evidenceList
    .map(
      validateAggregatedEvidence
    )
    .sort((a, b) => {
      const decisionPriority:
        Record<
          ValidationDecision,
          number
        > = {
          eligible: 3,
          'manual-review': 2,
          blocked: 1,
        };

      const decisionDifference =
        decisionPriority[
          b.validationDecision
        ] -
        decisionPriority[
          a.validationDecision
        ];

      if (
        decisionDifference !== 0
      ) {
        return decisionDifference;
      }

      if (
        b.validationScore !==
        a.validationScore
      ) {
        return (
          b.validationScore -
          a.validationScore
        );
      }

      return (
        b.occurrenceCount -
        a.occurrenceCount
      );
    });
}
