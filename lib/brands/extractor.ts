import type {
  BrandEvidenceType,
} from '@/lib/brands/types';

export const BRAND_EXTRACTOR_VERSION =
  'BRAND-EVIDENCE-EXTRACTOR-V1';

export interface BrandEvidenceSourceProduct {
  productId: number | string;

  brandId: number;
  canonicalBrand: string;

  title?: string | null;
  name?: string | null;

  partNumber?: string | null;
  manufacturer?: string | null;
}

export interface ExtractedBrandEvidenceCandidate {
  productId: number | string;

  brandId: number;
  canonicalBrand: string;

  type: BrandEvidenceType;

  value: string;
  normalizedValue: string;

  source:
    | 'product-part-number'
    | 'product-manufacturer';

  reason: string;
}

export interface BrandEvidenceExtractionResult {
  productId: number | string;

  brandId: number;
  canonicalBrand: string;

  candidates: ExtractedBrandEvidenceCandidate[];

  rejected: Array<{
    type: BrandEvidenceType;
    value: string;
    reason: string;
  }>;
}

const INVALID_VALUES = new Set([
  '',
  'UNKNOWN',
  'UNBRANDED',
  'GENERIC',
  'OTHER',
  'NONE',
  'NULL',
  'N/A',
  'NA',
  'NOT APPLICABLE',
  'NOT AVAILABLE',
  'DOES NOT APPLY',
  'NO BRAND',
  'NO MANUFACTURER',
]);

const GENERIC_MANUFACTURERS = new Set([
  'AUTOMATION',
  'INDUSTRIAL',
  'ELECTRICAL',
  'ELECTRONIC',
  'ELECTRONICS',
  'CONTROL',
  'CONTROLS',
  'SYSTEM',
  'SYSTEMS',
  'PLC',
  'PCB',
  'RELAY',
  'MODULE',
  'BOARD',
  'DRIVE',
  'SENSOR',
  'CONTROLLER',
  'MOTOR',
  'POWER',
  'PANEL',
  'SWITCH',
  'VALVE',
]);

const INVALID_PART_PREFIXES = new Set([
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
  'IP',
  'PN',
  'P/N',
  'NO',
  'ART',
  'TYPE',
  'MODEL',
  'PART',
  'RELAY',
  'BOARD',
  'MODULE',
]);

function cleanText(
  value: unknown
): string {
  return String(value ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeText(
  value: unknown
): string {
  return cleanText(value)
    .toUpperCase()
    .replace(/[™®©]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeCompact(
  value: unknown
): string {
  return normalizeText(value)
    .replace(/[^A-Z0-9]/g, '');
}

function uniqueCandidates(
  candidates: ExtractedBrandEvidenceCandidate[]
): ExtractedBrandEvidenceCandidate[] {
  const seen = new Set<string>();

  const result:
    ExtractedBrandEvidenceCandidate[] = [];

  for (const candidate of candidates) {
    const key = [
      candidate.brandId,
      candidate.type,
      candidate.normalizedValue,
    ].join(':');

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(candidate);
  }

  return result;
}

function isInvalidValue(
  value: unknown
): boolean {
  const normalized =
    normalizeText(value);

  return (
    !normalized ||
    INVALID_VALUES.has(normalized)
  );
}

function isNumericOnly(
  value: string
): boolean {
  return /^[0-9]+$/.test(value);
}

function containsLetterAndNumber(
  value: string
): boolean {
  return (
    /[A-Z]/.test(value) &&
    /[0-9]/.test(value)
  );
}

function isValidManufacturer(
  manufacturer: string,
  canonicalBrand: string
): {
  valid: boolean;
  reason: string;
} {
  const normalized =
    normalizeText(manufacturer);

  if (isInvalidValue(normalized)) {
    return {
      valid: false,
      reason:
        'Manufacturer is empty or unknown',
    };
  }

  if (
    GENERIC_MANUFACTURERS.has(
      normalized
    )
  ) {
    return {
      valid: false,
      reason:
        'Manufacturer is a generic product word',
    };
  }

  if (isNumericOnly(normalized)) {
    return {
      valid: false,
      reason:
        'Manufacturer contains numbers only',
    };
  }

  if (normalized.length < 2) {
    return {
      valid: false,
      reason:
        'Manufacturer value is too short',
    };
  }

  const normalizedBrand =
    normalizeText(canonicalBrand);

  if (
    normalized === 'UNKNOWN' ||
    normalizedBrand === 'UNKNOWN'
  ) {
    return {
      valid: false,
      reason:
        'Brand or manufacturer is unknown',
    };
  }

  return {
    valid: true,
    reason:
      normalized === normalizedBrand
        ? 'Manufacturer matches canonical brand'
        : 'Manufacturer is associated with known brand',
  };
}

/**
 * يحاول استخراج عائلة رقم القطعة.
 *
 * أمثلة:
 *
 * 6ES7315-2EH14-0AB0  → 6ES7
 * 3BSE030220R1        → 3BSE
 * IC200EBI001         → IC200
 * ACS550-01-045A-4    → ACS550
 * 1756-L71            → 1756
 */
function derivePartPrefixes(
  partNumber: string
): string[] {
  const original =
    normalizeText(partNumber);

  const compact =
    normalizeCompact(partNumber);

  if (
    !compact ||
    compact.length < 4 ||
    compact.length > 50
  ) {
    return [];
  }

  const prefixes: string[] = [];

  /*
   * أول جزء قبل الشرطة أو الفراغ.
   *
   * ACS550-01-045A-4 → ACS550
   * 1756-L71         → 1756
   */
  const firstSegment =
    original
      .split(/[\s/_-]+/)
      .map(normalizeCompact)
      .find(Boolean);

  if (
    firstSegment &&
    firstSegment.length >= 4 &&
    firstSegment.length <= 10 &&
    containsLetterAndNumber(
      firstSegment
    )
  ) {
    prefixes.push(firstSegment);
  }

  /*
   * Siemens:
   * 6ES7315... → 6ES7
   */
  const digitLettersDigit =
    compact.match(
      /^(\d[A-Z]{2,3}\d)/
    );

  if (digitLettersDigit?.[1]) {
    prefixes.push(
      digitLettersDigit[1]
    );
  }

  /*
   * ABB:
   * 3BSE030220... → 3BSE
   */
  const digitThreeLetters =
    compact.match(
      /^(\d[A-Z]{3})/
    );

  if (digitThreeLetters?.[1]) {
    prefixes.push(
      digitThreeLetters[1]
    );
  }

  /*
   * GE Fanuc:
   * IC200EBI001 → IC200
   */
  const twoLettersThreeDigits =
    compact.match(
      /^([A-Z]{2}\d{3})/
    );

  if (twoLettersThreeDigits?.[1]) {
    prefixes.push(
      twoLettersThreeDigits[1]
    );
  }

  /*
   * ABB / Danfoss / Drives:
   * ACS550...
   * FC302...
   * ATV630...
   */
  const lettersDigits =
    compact.match(
      /^([A-Z]{2,4}\d{2,3})/
    );

  if (lettersDigits?.[1]) {
    prefixes.push(
      lettersDigits[1]
    );
  }

  /*
   * Allen-Bradley:
   * 1756-L71 → 1756
   *
   * الرقم وحده لا يتم اعتماده هنا مباشرة،
   * لكنه يُستخرج كمرشح ليتم قياس Purity لاحقًا.
   */
  const fourDigitFamily =
    original.match(
      /^(\d{4})[-/\s]/
    );

  if (fourDigitFamily?.[1]) {
    prefixes.push(
      fourDigitFamily[1]
    );
  }

  return Array.from(
    new Set(
      prefixes
        .map(normalizeCompact)
        .filter(Boolean)
    )
  );
}

function validatePartPrefix(
  prefix: string
): {
  valid: boolean;
  reason: string;
} {
  const normalized =
    normalizeCompact(prefix);

  if (!normalized) {
    return {
      valid: false,
      reason:
        'Part prefix is empty',
    };
  }

  if (
    normalized.length < 4 ||
    normalized.length > 10
  ) {
    return {
      valid: false,
      reason:
        'Part prefix length is outside allowed range',
    };
  }

  if (
    INVALID_PART_PREFIXES.has(
      normalized
    )
  ) {
    return {
      valid: false,
      reason:
        'Part prefix is a generic industrial term',
    };
  }

  if (isNumericOnly(normalized)) {
    /*
     * نسمح فقط بعائلة رقمية من أربعة أرقام.
     * لن يتم اعتمادها تلقائيًا لاحقًا إلا بنقاء عالٍ.
     */
    if (!/^\d{4}$/.test(normalized)) {
      return {
        valid: false,
        reason:
          'Numeric prefix is not a four-digit product family',
      };
    }

    return {
      valid: true,
      reason:
        'Four-digit numeric product family candidate',
    };
  }

  if (
    !containsLetterAndNumber(
      normalized
    )
  ) {
    return {
      valid: false,
      reason:
        'Part prefix must contain letters and numbers',
    };
  }

  return {
    valid: true,
    reason:
      'Part-number family candidate',
  };
}

function extractManufacturerCandidate(
  product: BrandEvidenceSourceProduct
): {
  candidate:
    | ExtractedBrandEvidenceCandidate
    | null;

  rejected:
    | BrandEvidenceExtractionResult['rejected'][number]
    | null;
} {
  const manufacturer =
    cleanText(product.manufacturer);

  if (!manufacturer) {
    return {
      candidate: null,
      rejected: null,
    };
  }

  const validation =
    isValidManufacturer(
      manufacturer,
      product.canonicalBrand
    );

  if (!validation.valid) {
    return {
      candidate: null,

      rejected: {
        type: 'manufacturer',
        value: manufacturer,
        reason: validation.reason,
      },
    };
  }

  return {
    candidate: {
      productId:
        product.productId,

      brandId:
        product.brandId,

      canonicalBrand:
        product.canonicalBrand,

      type:
        'manufacturer',

      value:
        manufacturer,

      normalizedValue:
        normalizeText(manufacturer),

      source:
        'product-manufacturer',

      reason:
        validation.reason,
    },

    rejected: null,
  };
}

function extractPartPrefixCandidates(
  product: BrandEvidenceSourceProduct
): {
  candidates:
    ExtractedBrandEvidenceCandidate[];

  rejected:
    BrandEvidenceExtractionResult['rejected'];
} {
  const partNumber =
    cleanText(product.partNumber);

  if (!partNumber) {
    return {
      candidates: [],
      rejected: [],
    };
  }

  const prefixes =
    derivePartPrefixes(partNumber);

  const candidates:
    ExtractedBrandEvidenceCandidate[] = [];

  const rejected:
    BrandEvidenceExtractionResult['rejected'] = [];

  for (const prefix of prefixes) {
    const validation =
      validatePartPrefix(prefix);

    if (!validation.valid) {
      rejected.push({
        type:
          'part-prefix',

        value:
          prefix,

        reason:
          validation.reason,
      });

      continue;
    }

    candidates.push({
      productId:
        product.productId,

      brandId:
        product.brandId,

      canonicalBrand:
        product.canonicalBrand,

      type:
        'part-prefix',

      value:
        prefix,

      normalizedValue:
        normalizeCompact(prefix),

      source:
        'product-part-number',

      reason:
        validation.reason,
    });
  }

  return {
    candidates,
    rejected,
  };
}

export function extractBrandEvidence(
  product: BrandEvidenceSourceProduct
): BrandEvidenceExtractionResult {
  const candidates:
    ExtractedBrandEvidenceCandidate[] = [];

  const rejected:
    BrandEvidenceExtractionResult['rejected'] = [];

  const canonicalBrand =
    cleanText(product.canonicalBrand);

  if (
    !product.brandId ||
    !canonicalBrand ||
    normalizeText(canonicalBrand) ===
      'UNKNOWN'
  ) {
    return {
      productId:
        product.productId,

      brandId:
        product.brandId,

      canonicalBrand,

      candidates: [],

      rejected: [
        {
          type: 'canonical',
          value: canonicalBrand,
          reason:
            'Evidence cannot be learned from an unknown brand',
        },
      ],
    };
  }

  const manufacturerResult =
    extractManufacturerCandidate(
      product
    );

  if (
    manufacturerResult.candidate
  ) {
    candidates.push(
      manufacturerResult.candidate
    );
  }

  if (
    manufacturerResult.rejected
  ) {
    rejected.push(
      manufacturerResult.rejected
    );
  }

  const prefixResult =
    extractPartPrefixCandidates(
      product
    );

  candidates.push(
    ...prefixResult.candidates
  );

  rejected.push(
    ...prefixResult.rejected
  );

  return {
    productId:
      product.productId,

    brandId:
      product.brandId,

    canonicalBrand,

    candidates:
      uniqueCandidates(candidates),

    rejected,
  };
}
