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
   * دليل العنوان نظيف
