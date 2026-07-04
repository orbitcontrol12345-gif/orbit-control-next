const BRAND_WORDS = [
  'ABB',
  'SIEMENS',
  'SCHNEIDER',
  'SCHNEIDER ELECTRIC',
  'ALLEN BRADLEY',
  'ALLEN-BRADLEY',
  'HONEYWELL',
  'OMRON',
  'YOKOGAWA',
  'EMERSON',
  'CARLO GAVAZZI',
  'GAVAZZI',
  'MITSUBISHI',
  'PHOENIX CONTACT',
  'PHOENIX',
  'GE',
  'GENERAL ELECTRIC',
  'EATON',
  'CUTLER HAMMER',
  'CUTLER-HAMMER',
  'MORS SMITT',
  'SMITT',
];

const BAD_WORDS = new Set([
  'NEW',
  'USED',
  'OPEN',
  'BOX',
  'LOT',
  'PCS',
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

function clean(input: string) {
  return String(input || '')
    .toUpperCase()
    .replace(/[()[\]{},;:"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function removeBrandPrefix(title: string) {
  let text = clean(title);

  for (const brand of BRAND_WORDS.sort((a, b) => b.length - a.length)) {
    const b = clean(brand);
    if (text.startsWith(`${b} `)) {
      text = text.slice(b.length).trim();
      break;
    }
  }

  return text;
}

function normalizePart(value: string) {
  return String(value || '')
    .toUpperCase()
    .trim()
    .replace(/\s*-\s*/g, '-')
    .replace(/\s+/g, '-')
    .replace(/[^A-Z0-9\-/.]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function isElectricalRating(value: string) {
  const v = normalizePart(value);

  return (
    /^\d+\/\d+HZ$/.test(v) ||
    /^\d+\/\d+(VAC|VDC|AC|DC|V|HZ)$/.test(v) ||
    /^\d+(\.\d+)?(VAC|VDC|AC|DC|V|HZ|KW|W|A|MA|BAR|PSI|MM|CM|KG)$/.test(v) ||
    /^\d+-\d+(VAC|VDC|AC|DC|V)$/.test(v) ||
    /^\d{2,4}V$/.test(v) ||
    /^\d{2,4}VAC$/.test(v) ||
    /^\d{2,4}VDC$/.test(v)
  );
}

function isBadPart(value: string) {
  const v = normalizePart(value);

  if (!v) return true;
  if (v.length < 4 || v.length > 40) return true;
  if (BAD_WORDS.has(v)) return true;
  if (/^27\d{10}$/.test(v)) return true;
  if (/^\d{12,13}$/.test(v)) return true;
  if (/^\d{10,14}$/.test(v)) return true;
  if (isElectricalRating(v)) return true;

  if (/^(P\/N|PN|W\/O|I\/O|S\/W|REV|VER|MODEL|TYPE)$/.test(v)) return true;

  if (
    /^(INPUT|OUTPUT|SAFETY|CONTROLLER|POWER|MODULE|BOARD|SYSTEM|SWITCH|SUPPLY|CIRCUIT|RELAY)$/.test(
      v
    )
  ) {
    return true;
  }

  return false;
}

function scorePart(value: string) {
  const v = normalizePart(value);
  if (isBadPart(v)) return -999;

  let score = 0;

  if (/^6ES\d/.test(v)) score += 300;
  if (/^6AV\d/.test(v)) score += 290;
  if (/^IC\d{3}/.test(v)) score += 270;
  if (/^17\d{2}/.test(v)) score += 260;
  if (/^A\d{2}B-\d{4}-\d{4}$/.test(v)) score += 250;

  if (/[A-Z]/.test(v)) score += 20;
  if (/\d/.test(v)) score += 20;
  if (/[-/.]/.test(v)) score += 15;

  if (v.length >= 5 && v.length <= 24) score += 20;

  if (/^[A-Z]{2,5}-[A-Z]?\d{2,5}-\d{2,6}$/.test(v)) score += 180;
  if (/^[A-Z]{2,6}\d{2,}[A-Z0-9\-/.]*$/.test(v)) score += 120;
  if (/^[A-Z]{2,}-\d{2,}[A-Z0-9-]*$/.test(v)) score += 120;
  if (/^\d{3}-\d{5}-\d{2}[A-Z]?$/.test(v)) score += 140;

  if (/^\d{5,14}[A-Z]?$/.test(v)) score -= 70;
  if (isElectricalRating(v)) score -= 500;

  return score;
}

export function extractIndustrialPartNumberV2(input: string): string {
  const original = clean(input);
  const text = removeBrandPrefix(original);

  if (!text) return '';

  const candidates: string[] = [];

  const strongPatterns = [
    /\b6ES\d[\dA-Z-]+\b/g,
    /\b6AV\d[\dA-Z-]+\b/g,
    /\bIC\d{3}[A-Z]{2,}\d{2,4}\b/g,
    /\b17\d{2}[A-Z0-9]{2,8}\/[A-Z]\b/g,
    /\b17\d{2}-?[A-Z0-9]{2,8}\b/g,
    /\bA\d{2}B-\d{4}-\d{4}\b/g,
    /\b\d{3}-\d{5}-\d{2}[A-Z]?\b/g,
  ];

  for (const pattern of strongPatterns) {
    candidates.push(...(text.match(pattern) || []));
  }

  const spacedModelPatterns = [
    /\b[A-Z]{2,5}\s+[A-Z]?\d{2,5}\s+\d{2,6}\b/g,
    /\b[A-Z]{2,5}\s+\d{2,6}\b/g,
  ];

  for (const pattern of spacedModelPatterns) {
    candidates.push(...(text.match(pattern) || []));
  }

  const genericPatterns = [
    /\b[A-Z]{1,8}\d{2,}[A-Z0-9\-/.]*\b/g,
    /\b[A-Z]{2,}-\d{2,}[A-Z0-9-]*\b/g,
    /\b[A-Z]\d{3}-\d{2}\b/g,
    /\b\d{2}[A-Z]\d{5}[A-Z]\d{1,4}\b/g,
    /\b\d{2}[A-Z]\d{5}\b/g,
  ];

  for (const pattern of genericPatterns) {
    candidates.push(...(text.match(pattern) || []));
  }

  const ranked = [...new Set(candidates)]
    .map(normalizePart)
    .filter((x) => !isBadPart(x))
    .map((value) => ({ value, score: scorePart(value) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  return ranked[0]?.value || '';
}
