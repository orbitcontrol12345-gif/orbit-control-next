const BRAND_WORDS = [
  'SCHNEIDER ELECTRIC',
  'PHOENIX CONTACT',
  'GENERAL ELECTRIC',
  'ALLEN BRADLEY',
  'ALLEN-BRADLEY',
  'CARLO GAVAZZI',
  'CUTLER HAMMER',
  'CUTLER-HAMMER',
  'MORS SMITT',
  'MITSUBISHI',
  'HONEYWELL',
  'YOKOGAWA',
  'SIEMENS',
  'SCHNEIDER',
  'EMERSON',
  'GAVAZZI',
  'PHOENIX',
  'OMRON',
  'EATON',
  'SMITT',
  'ABB',
  'GE',
];

const BAD_WORDS = new Set([
  'NEW',
  'USED',
  'OPEN',
  'BOX',
  'LOT',
  'PCS',
  'PC',
  'QTY',
  'PIECE',
  'PIECES',
  'BOARD',
  'CARD',
  'MODULE',
  'UNIT',
  'POWER',
  'SUPPLY',
  'INTERFACE',
  'RELAY',
  'RELAYS',
  'CIRCUIT',
  'PRINTED',
  'REV',
  'VERSION',
  'P/N',
  'PN',
  'W/O',
  'I/O',
  'S/W',
  'INPUT',
  'OUTPUT',
  'SAFETY',
  'CONTROLLER',
  'SYSTEM',
  'SWITCH',
  'STARTER',
  'TYPE',
  'MODEL',
]);

/**
 * Family names and generic product labels.
 * These can appear beside a real part number but must not win.
 */
const WEAK_MODEL_PREFIXES = new Set([
  'EM',
  'CM',
  'CPU',
  'CP',
  'FM',
  'SM',
  'PS',
  'IM',
  'PM',
  'PLC',
  'HMI',
  'VFD',
  'AC',
  'DC',
  'AI',
  'AO',
  'DI',
  'DO',
  'I/O',
  'IO',
]);

function clean(input: string): string {
  return String(input || '')
    .toUpperCase()
    .replace(/[()[\]{},;:"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function removeBrandPrefix(title: string): string {
  let text = clean(title);

  const sortedBrands = [...BRAND_WORDS].sort(
    (a, b) => b.length - a.length
  );

  for (const brand of sortedBrands) {
    const normalizedBrand = clean(brand);
    const pattern = new RegExp(
      `^${escapeRegExp(normalizedBrand)}(?:\\s+|$)`,
      'i'
    );

    if (pattern.test(text)) {
      text = text.replace(pattern, '').trim();
      break;
    }
  }

  return text;
}

function normalizePart(value: string): string {
  return String(value || '')
    .toUpperCase()
    .trim()
    .replace(/\s*-\s*/g, '-')
    .replace(/\s*\/\s*/g, '/')
    .replace(/\s+/g, '-')
    .replace(/[^A-Z0-9\-/.]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function isElectricalRating(value: string): boolean {
  const v = normalizePart(value);

  return (
    /^\d+\/\d+HZ$/.test(v) ||
    /^\d+\/\d+(VAC|VDC|AC|DC|V|HZ)$/.test(v) ||
    /^\d+(\.\d+)?(VAC|VDC|AC|DC|V|HZ|KW|W|A|MA|BAR|PSI|MM|CM|KG)$/.test(
      v
    ) ||
    /^\d+-\d+(VAC|VDC|AC|DC|V)$/.test(v) ||
    /^\d{2,4}V$/.test(v) ||
    /^\d{2,4}VAC$/.test(v) ||
    /^\d{2,4}VDC$/.test(v)
  );
}

function isQuantityToken(value: string): boolean {
  const v = normalizePart(value);

  return (
    /^(LOT|QTY|PCS?|PIECES?|SETS?|PACKS?)-?\d+(?:\.\d+)?$/i.test(v) ||
    /^\d+(?:\.\d+)?-?(PCS?|PIECES?|SETS?|PACKS?)$/i.test(v)
  );
}

function isWeakFamilyModel(value: string): boolean {
  const v = normalizePart(value);

  const match = v.match(/^([A-Z/]{1,5})-(\d{1,4})$/);
  if (!match) return false;

  return WEAK_MODEL_PREFIXES.has(match[1]);
}

function isBadPart(value: string): boolean {
  const v = normalizePart(value);

  if (!v) return true;
  if (v.length < 4 || v.length > 50) return true;
  if (BAD_WORDS.has(v)) return true;

  // eBay item IDs and long numeric-only values
  if (/^27\d{10}$/.test(v)) return true;
  if (/^\d{10,14}$/.test(v)) return true;

  if (isElectricalRating(v)) return true;
  if (isQuantityToken(v)) return true;

  if (
    /^(P\/N|PN|W\/O|I\/O|S\/W|REV|VER|MODEL|TYPE)$/.test(v)
  ) {
    return true;
  }

  if (
    /^(INPUT|OUTPUT|SAFETY|CONTROLLER|POWER|MODULE|BOARD|SYSTEM|SWITCH|SUPPLY|CIRCUIT|RELAY)$/.test(
      v
    )
  ) {
    return true;
  }

  return false;
}

function scorePart(value: string): number {
  const v = normalizePart(value);

  if (isBadPart(v)) return -9999;

  let score = 0;

  /*
   * High-confidence manufacturer formats.
   */
  if (/^6ES\d/.test(v)) score += 500;
  if (/^6AV\d/.test(v)) score += 490;
  if (/^6GK\d/.test(v)) score += 480;
  if (/^6EP\d/.test(v)) score += 480;
  if (/^6DP\d/.test(v)) score += 295;

  if (/^IC\d{3}[A-Z]{2,}\d+/i.test(v)) score += 450;
  if (/^A\d{2}B-\d{4}-[A-Z0-9]+$/i.test(v)) score += 440;

  /*
   * Siemens compact formats such as:
   * 222-1BF22-0XA8
   * 6ES7-222-1BF22-0XA8
   */
  if (/^\d{3}-\d[A-Z]{2}\d{2}-\d[A-Z]{2}\d$/i.test(v)) {
    score += 430;
  }

  if (
    /^6ES\d-?\d{3}-\d[A-Z]{2}\d{2}-\d[A-Z]{2}\d$/i.test(v)
  ) {
    score += 520;
  }

  /*
   * Codes with several structured groups are usually stronger.
   */
  const hyphenGroups = v.split('-').filter(Boolean).length;

  if (hyphenGroups >= 3) score += 100;
  if (hyphenGroups >= 4) score += 40;

  if (/[A-Z]/.test(v)) score += 25;
  if (/\d/.test(v)) score += 25;
  if (/[-/.]/.test(v)) score += 25;

  if (v.length >= 6 && v.length <= 30) score += 25;

  if (/^[A-Z]{2,8}\d{2,}[A-Z0-9\-/.]*$/i.test(v)) {
    score += 120;
  }

  if (/^[A-Z]{2,8}-\d{2,}[A-Z0-9-]*$/i.test(v)) {
    score += 100;
  }

  if (/^\d{3}-\d{5}-\d{2}[A-Z]?$/i.test(v)) {
    score += 150;
  }

  /*
   * Penalize family labels such as EM 222, CPU 315, SM 1231.
   * They may remain as a fallback only when no real code exists.
   */
  if (isWeakFamilyModel(v)) {
    score -= 250;
  }

  if (/^\d{5,14}[A-Z]?$/.test(v)) {
    score -= 100;
  }

  if (isElectricalRating(v)) {
    score -= 1000;
  }

  return score;
}

function addMatches(
  candidates: string[],
  text: string,
  patterns: RegExp[]
): void {
  for (const pattern of patterns) {
    candidates.push(...(text.match(pattern) || []));
  }
}

export function extractIndustrialPartNumberV2(
  input: string
): string {
  const original = clean(input);
  const text = removeBrandPrefix(original);

  if (!text) return '';

  const candidates: string[] = [];

  /*
   * Strong patterns must run first.
   */
  const strongPatterns = [
    // Siemens full part numbers
    /\b6ES\d[\s-]?\d{3}-\d[A-Z]{2}\d{2}-\d[A-Z]{2}\d\b/gi,
    /\b6AV\d[\dA-Z\-/.]+\b/gi,
    /\b6GK\d[\dA-Z\-/.]+\b/gi,
    /\b6EP\d[\dA-Z\-/.]+\b/gi,
     /\b6ES\d[\dA-Z-]+\b/g,
  /\b6AV\d[\dA-Z-]+\b/g,
  /\b6DP\d[\dA-Z-]+\b/g,
  /\bIC\d{3}[A-Z]{2,}\d{2,4}\b/g,
  /\b17\d{2}[A-Z0-9]{2,8}\/[A-Z]\b/g,
  /\b17\d{2}-?[A-Z0-9]{2,8}\b/g,
  /\bA\d{2}B-\d{4}-\d{4}\b/g,
  /\b\d{3}-\d{5}-\d{2}[A-Z]?\b/g,
    // Siemens shortened format: 222-1BF22-0XA8
    /\b\d{3}-\d[A-Z]{2}\d{2}-\d[A-Z]{2}\d\b/gi,

    // GE Fanuc
    /\bIC\d{3}[A-Z]{2,}\d{2,4}\b/gi,

    // Allen-Bradley
    /\b17\d{2}[A-Z0-9]{2,10}\/[A-Z0-9]+\b/gi,
    /\b17\d{2}-?[A-Z0-9]{2,12}\b/gi,

    // FANUC
    /\bA\d{2}B-\d{4}-[A-Z0-9]{3,8}\b/gi,

    // Other structured numeric formats
    /\b\d{3}-\d{5}-\d{2}[A-Z]?\b/gi,
  ];

  addMatches(candidates, text, strongPatterns);

  /*
   * General structured part numbers.
   */
  const genericPatterns = [
    // Numeric leading codes containing multiple alphanumeric groups
    /\b\d{2,5}-[A-Z0-9]{2,10}-[A-Z0-9]{2,10}\b/gi,

    // ABB/Yokogawa/Mitsubishi/etc.
    /\b[A-Z]{1,10}\d{2,}[A-Z0-9\-/.]*\b/gi,
    /\b[A-Z]{2,10}-\d{2,}[A-Z0-9\-/.]*\b/gi,
    /\b[A-Z0-9]{2,10}-[A-Z0-9]{2,10}-[A-Z0-9]{2,10}\b/gi,

    /\b[A-Z]\d{3}-\d{2}\b/gi,
    /\b\d{2}[A-Z]\d{5}[A-Z]\d{1,4}\b/gi,
    /\b\d{2}[A-Z]\d{5}\b/gi,
  ];

  addMatches(candidates, text, genericPatterns);

  /*
   * Weak spaced models are collected last and heavily penalized.
   * Example: EM 222, CPU 315.
   */
  const weakSpacedPatterns = [
    /\b(?:EM|CPU|CP|FM|SM|PS|IM|PM|PLC|HMI|VFD|AI|AO|DI|DO)\s+\d{2,5}\b/gi,
  ];

  addMatches(candidates, text, weakSpacedPatterns);

  const ranked = [...new Set(candidates.map(normalizePart))]
    .filter((value) => !isBadPart(value))
    .map((value) => ({
      value,
      score: scorePart(value),
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }

      // When scores match, prefer the more detailed structured code.
      return b.value.length - a.value.length;
    });

  return ranked[0]?.value || '';
}
