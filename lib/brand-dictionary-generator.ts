const GENERATOR_VERSION = 'BRAND-DICTIONARY-GENERATOR-V1';

type EvidenceEntry = {
  prefix: string;
  count: number;
  coverage: number;
  purity: number;
  ownerCount: number;
  accepted?: boolean;
};

type LearnedBrand = {
  brand: string;
  productCount: number;

  learned: {
    titlePrefixes: EvidenceEntry[];
    partNumberPrefixes: EvidenceEntry[];
  };

  review?: {
    titlePrefixes?: EvidenceEntry[];
    partNumberPrefixes?: EvidenceEntry[];
  };

  examples?: string[];
};

export type SafeBrandDictionaryEntry = {
  brand: string;
  aliases: string[];
  partNumberPrefixes: string[];

  evidence: {
    aliases: EvidenceEntry[];
    partNumberPrefixes: EvidenceEntry[];
  };
};

export type BrandDictionaryResult = {
  version: string;

  summary: {
    inputBrands: number;
    outputBrands: number;
    totalAliases: number;
    totalPartNumberPrefixes: number;
  };

  dictionary: SafeBrandDictionaryEntry[];
};

const INVALID_ALIAS_VALUES = new Set([
  '',
  'UNKNOWN',
  'UNBRANDED',
  'GENERIC',
  'OTHER',
  'GENERAL',
  'ORIGINAL',
  'GENUINE',
  'INDUSTRIAL',
  'AUTOMATION',
  'ELECTRIC',
  'ELECTRICAL',
  'DIGITAL',
  'ENERGY',
  'SECURITY',
  'CONTROL',
  'CONTROLS',
  'SYSTEM',
  'SYSTEMS',
  'SERVICE',
  'SERVICES',
  'POWER',
  'MODULE',
  'CONTROLLER',
  'DRIVE',
  'PLC',
  'HMI',
  'VFD',
  'BOARD',
  'CARD',
  'DISPLAY',
  'PANEL',
  'SENSOR',
  'RELAY',
  'SWITCH',
  'BREAKER',
  'CONTACTOR',
  'INVERTER',
  'MOTOR',
  'TRANSFORMER',
  'AMPLIFIER',
  'MEASURING',
  'PROCESSOR',
  'CHASSIS',
]);

const INVALID_ALIAS_WORDS = new Set([
  'NEW',
  'USED',
  'OPEN',
  'BOX',
  'LOT',
  'PCS',
  'PC',
  'PIECE',
  'PIECES',
  'TESTED',
  'WORKING',
  'ORIGINAL',
  'GENUINE',
  'PART',
  'PARTS',
  'ONLY',
  'WITHOUT',
  'WITH',
  'MODULE',
  'CONTROLLER',
  'CONTROL',
  'SYSTEM',
  'SYSTEMS',
  'BOARD',
  'CARD',
  'DISPLAY',
  'PANEL',
  'PROCESSOR',
  'CHASSIS',
  'MEASURING',
]);

const GENERIC_PART_PREFIXES = new Set([
  'BOARD',
  'CARD',
  'MODEL',
  'TYPE',
  'SERIAL',
  'PART',
  'MODULE',
  'UNIT',
  'REV',
  'POWER',
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

function normalizeAlias(value: unknown): string {
  return normalizeUpper(value)
    .replace(/[()[\]{}]/g, ' ')
    .replace(/[|,:;]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizePartPrefix(value: unknown): string {
  return normalizeUpper(value)
    .replace(/[^A-Z0-9]/g, '')
    .trim();
}

function uniqueEvidence(
  entries: EvidenceEntry[]
): EvidenceEntry[] {
  const bestByPrefix = new Map<string, EvidenceEntry>();

  for (const entry of entries) {
    const prefix = normalizeAlias(entry.prefix);

    if (!prefix) continue;

    const existing = bestByPrefix.get(prefix);

    if (
      !existing ||
      entry.count > existing.count ||
      entry.purity > existing.purity
    ) {
      bestByPrefix.set(prefix, {
        ...entry,
        prefix,
      });
    }
  }

  return Array.from(bestByPrefix.values());
}

function containsInvalidAliasWord(alias: string): boolean {
  const words = alias.split(/\s+/).filter(Boolean);

  return words.some((word) =>
    INVALID_ALIAS_WORDS.has(word)
  );
}

function isSafeAlias(
  candidate: EvidenceEntry,
  canonicalBrand: string
): boolean {
  const alias = normalizeAlias(candidate.prefix);
  const canonical = normalizeAlias(canonicalBrand);

  if (!alias || !canonical) return false;

  if (INVALID_ALIAS_VALUES.has(alias)) return false;

  if (alias.length < 2 || alias.length > 45) {
    return false;
  }

  if (/\d/.test(alias)) return false;

  const words = alias.split(/\s+/).filter(Boolean);

  if (words.length > 4) return false;

  if (containsInvalidAliasWord(alias)) return false;

  if (candidate.count < 3) return false;
  if (candidate.purity < 98) return false;
  if (candidate.ownerCount > 1) return false;

 /*
 * اسم البراند الأساسي مقبول دائمًا عندما يكون
 * دليل العنوان نظيفًا.
 */
if (alias === canonical) return true;
    /*
   * Alias يحتوي اسم البراند الأساسي، مثل:
   * GE FANUC
   * BUSCH-JAEGER BY ABB
   * TELEMECANIQUE BY SCHNEIDER
   */
  if (
    alias.includes(canonical) ||
    canonical.includes(alias)
  ) {
    return true;
  }

  /*
   * Alias مستقل لا يحتوي اسم البراند الأساسي، مثل:
   * RUGGEDCOM
   * ENTRELEC
   * NOTIFIER
   *
   * لذلك نطلب تكرارًا وثقة أعلى.
   */
  if (
    candidate.count >= 5 &&
    candidate.purity === 100 &&
    candidate.ownerCount === 1
  ) {
    return true;
  }

  return false;
}

function isSafePartNumberPrefix(
  candidate: EvidenceEntry
): boolean {
  const prefix = normalizePartPrefix(candidate.prefix);

  if (!prefix) return false;

  /*
   * حذف Prefixes القصيرة والخطرة مثل:
   * R00
   * C98
   * B86
   * FX8
   */
  if (prefix.length < 4 || prefix.length > 12) {
    return false;
  }

  if (!/[A-Z]/.test(prefix)) return false;
  if (!/\d/.test(prefix)) return false;

  if (/^\d+$/.test(prefix)) return false;
  if (/^[A-Z]+$/.test(prefix)) return false;

  if (GENERIC_PART_PREFIXES.has(prefix)) {
    return false;
  }

  if (candidate.count < 3) return false;
  if (candidate.purity < 100) return false;
  if (candidate.ownerCount !== 1) return false;

  return true;
}

function removeRedundantAliases(
  entries: EvidenceEntry[],
  canonicalBrand: string
): EvidenceEntry[] {
  const canonical = normalizeAlias(canonicalBrand);

  const sorted = [...entries].sort((a, b) => {
    const aPrefix = normalizeAlias(a.prefix);
    const bPrefix = normalizeAlias(b.prefix);

    if (aPrefix === canonical) return -1;
    if (bPrefix === canonical) return 1;

    if (b.count !== a.count) {
      return b.count - a.count;
    }

    return aPrefix.length - bPrefix.length;
  });

  const result: EvidenceEntry[] = [];

  for (const entry of sorted) {
    const alias = normalizeAlias(entry.prefix);

    const duplicate = result.some(
      (existing) =>
        normalizeAlias(existing.prefix) === alias
    );

    if (!duplicate) {
      result.push({
        ...entry,
        prefix: alias,
      });
    }
  }

  return result.slice(0, 15);
}

function removeRedundantPartPrefixes(
  entries: EvidenceEntry[]
): EvidenceEntry[] {
  const normalized = entries
    .map((entry) => ({
      ...entry,
      prefix: normalizePartPrefix(entry.prefix),
    }))
    .filter((entry) => entry.prefix.length > 0);

  const sorted = normalized.sort((a, b) => {
    if (b.count !== a.count) {
      return b.count - a.count;
    }

    return a.prefix.length - b.prefix.length;
  });

  const result: EvidenceEntry[] = [];

  for (const candidate of sorted) {
    const duplicate = result.some(
      (existing) =>
        existing.prefix === candidate.prefix
    );

    if (duplicate) continue;

    const redundant = result.some((existing) => {
      return (
        candidate.prefix.startsWith(existing.prefix) &&
        existing.count >= candidate.count &&
        existing.purity >= candidate.purity
      );
    });

    if (!redundant) {
      result.push(candidate);
    }
  }

  return result.slice(0, 20);
}

function combineTitleEvidence(
  brand: LearnedBrand
): EvidenceEntry[] {
  return uniqueEvidence([
    ...(brand.learned?.titlePrefixes ?? []),
    ...(brand.review?.titlePrefixes ?? []),
  ]);
}

function combinePartEvidence(
  brand: LearnedBrand
): EvidenceEntry[] {
  return uniqueEvidence([
    ...(brand.learned?.partNumberPrefixes ?? []),
    ...(brand.review?.partNumberPrefixes ?? []),
  ]);
}

export function generateSafeBrandDictionary(
  learnedBrands: LearnedBrand[]
): BrandDictionaryResult {
  const dictionary: SafeBrandDictionaryEntry[] = [];

  for (const brandData of learnedBrands) {
    const canonicalBrand = normalizeAlias(
      brandData.brand
    );

    if (!canonicalBrand) continue;

    const titleEvidence =
      combineTitleEvidence(brandData);

    const safeAliasEvidence =
      removeRedundantAliases(
        titleEvidence.filter((entry) =>
          isSafeAlias(entry, canonicalBrand)
        ),
        canonicalBrand
      );

    /*
     * نضمن وجود اسم البراند الأساسي في القاموس.
     */
    const hasCanonicalAlias =
      safeAliasEvidence.some(
        (entry) =>
          normalizeAlias(entry.prefix) ===
          canonicalBrand
      );

    if (!hasCanonicalAlias) {
      safeAliasEvidence.unshift({
        prefix: canonicalBrand,
        count: brandData.productCount,
        coverage: 100,
        purity: 100,
        ownerCount: 1,
        accepted: true,
      });
    }

    const partEvidence =
      combinePartEvidence(brandData);

    const safePartEvidence =
      removeRedundantPartPrefixes(
        partEvidence.filter((entry) =>
          isSafePartNumberPrefix(entry)
        )
      );

    dictionary.push({
      brand: canonicalBrand,

      aliases: safeAliasEvidence.map(
        (entry) => entry.prefix
      ),

      partNumberPrefixes:
        safePartEvidence.map(
          (entry) => entry.prefix
        ),

      evidence: {
        aliases: safeAliasEvidence,
        partNumberPrefixes: safePartEvidence,
      },
    });
  }

  dictionary.sort((a, b) =>
    a.brand.localeCompare(b.brand)
  );

  return {
    version: GENERATOR_VERSION,

    summary: {
      inputBrands: learnedBrands.length,
      outputBrands: dictionary.length,

      totalAliases: dictionary.reduce(
        (sum, entry) =>
          sum + entry.aliases.length,
        0
      ),

      totalPartNumberPrefixes:
        dictionary.reduce(
          (sum, entry) =>
            sum +
            entry.partNumberPrefixes.length,
          0
        ),
    },

    dictionary,
  };
}
