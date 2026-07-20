const BRAND_WORDS = [
  'SCHNEIDER ELECTRIC',
  'PHOENIX CONTACT',
  'GENERAL ELECTRIC',
  'ALLEN BRADLEY',
  'ALLEN-BRADLEY',
  'CARLO GAVAZZI',
  'CUTLER HAMMER',
  'CUTLER-HAMMER',
  'ENDRESS+HAUSER',
  'ENDRESS HAUSER',
  'ROCKWELL AUTOMATION',
  'JOHNSON CONTROLS',
  'ORIENTAL MOTOR',
  'BENTLY NEVADA',
  'MORS SMITT',
  'MITSUBISHI',
  'HONEYWELL',
  'YOKOGAWA',
  'SIEMENS',
  'SCHNEIDER',
  'EMERSON',
  'GAVAZZI',
  'PHOENIX',
  'ROSEMOUNT',
  'BECKHOFF',
  'WOODWARD',
  'LOVATO',
  'SOCOMEC',
  'TERASAKI',
  'FISHER',
  'OMRON',
  'EATON',
  'MOXA',
  'SICK',
  'WAGO',
  'HIMA',
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
  'REVISION',
  'VER',
  'VERSION',
  'P/N',
  'PN',
  'MPN',
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
  'NUMBER',
  'NO',
  'ART',
  'ARTICLE',
  'CAT',
  'CATALOG',
  'REF',
  'REFERENCE',
  'ORDER',
  'SERIAL',
  'CHANNEL',
  'CHANNELS',
  'PORT',
  'PORTS',
  'WAY',
  'WAYS',
  'FOLD',
  'FOLDS',
  'PHASE',
  'PHASES',
  'POLE',
  'POLES',
]);

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

const DESCRIPTOR_PREFIXES = [
  'REV',
  'REVISION',
  'VER',
  'VERSION',
  'MODEL',
  'TYPE',
  'NO',
  'NUMBER',
  'ART',
  'ARTICLE',
  'CAT',
  'CATALOG',
  'REF',
  'REFERENCE',
  'ORDER',
  'SERIAL',
  'SN',
  'LOT',
  'QTY',
  'CHANNEL',
  'CHANNELS',
  'PORT',
  'PORTS',
  'WAY',
  'WAYS',
  'FOLD',
  'FOLDS',
  'PHASE',
  'PHASES',
  'POLE',
  'POLES',
];

interface PartCandidate {
  value: string;
  score: number;
  index: number;
  explicit: boolean;
}

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
    .replace(/[^A-Z0-9\-/.+]/g, '')
    .replace(/-+/g, '-')
    .replace(/^[-/.]+|[-/.]+$/g, '');
}

function isElectricalRating(value: string): boolean {
  const v = normalizePart(value);

  return (
    /^\d+\/\d+HZ$/.test(v) ||
    /^\d+\/\d+(VAC|VDC|AC|DC|V|HZ)$/.test(v) ||
    /^\d+(?:\.\d+)?(VAC|VDC|AC|DC|V|HZ|KHZ|MHZ|KW|W|A|MA|BAR|PSI|MM|CM|KG|VA|KVA)$/.test(
      v
    ) ||
    /^\d+-\d+(VAC|VDC|AC|DC|V|HZ)$/.test(v) ||
    /^\d{2,4}V$/.test(v) ||
    /^\d{2,4}VAC$/.test(v) ||
    /^\d{2,4}VDC$/.test(v) ||
    /^\d+(?:\.\d+)?-?(?:50|60)HZ$/.test(v)
  );
}

function isQuantityToken(value: string): boolean {
  const v = normalizePart(value);

  return (
    /^(LOT|QTY|PCS?|PIECES?|SETS?|PACKS?|UNITS?)-?\d+(?:\.\d+)?$/i.test(
      v
    ) ||
    /^\d+(?:\.\d+)?-?(PCS?|PIECES?|SETS?|PACKS?|UNITS?)$/i.test(v)
  );
}

function isWeakFamilyModel(value: string): boolean {
  const v = normalizePart(value);

  const match = v.match(/^([A-Z/]{1,5})-(\d{1,4})$/);

  if (!match) return false;

  return WEAK_MODEL_PREFIXES.has(match[1]);
}

function startsWithDescriptor(value: string): boolean {
  const v = normalizePart(value);

  return DESCRIPTOR_PREFIXES.some(
    (prefix) =>
      v === prefix ||
      v.startsWith(`${prefix}-`) ||
      v.startsWith(`${prefix}/`)
  );
}

function isDescriptiveToken(value: string): boolean {
  const v = normalizePart(value);

  return (
    /^\d+(?:-)?(?:CHANNELS?|PORTS?|WAYS?|FOLDS?|PHASES?|POLES?)$/i.test(
      v
    ) ||
    /^(?:CHANNELS?|PORTS?|WAYS?|FOLDS?|PHASES?|POLES?)-?\d+$/i.test(v) ||
    /^\d+(?:-)?(?:INPUTS?|OUTPUTS?|RELAYS?|MODULES?|UNITS?)$/i.test(v) ||
    /^(?:INPUTS?|OUTPUTS?|RELAYS?|MODULES?|UNITS?)-?\d+$/i.test(v)
  );
}

function isRevisionToken(value: string): boolean {
  const v = normalizePart(value);

  return (
    /^(REV|REVISION|VER|VERSION)-?[A-Z0-9.]+$/i.test(v) ||
    /^[A-Z]?-?REV-?[A-Z0-9.]+$/i.test(v)
  );
}

function isBadPart(value: string): boolean {
  const v = normalizePart(value);

  if (!v) return true;
  if (v.length < 3 || v.length > 50) return true;
  if (BAD_WORDS.has(v)) return true;

  if (startsWithDescriptor(v)) return true;
  if (isDescriptiveToken(v)) return true;
  if (isRevisionToken(v)) return true;

  // eBay item IDs
  if (/^27\d{10}$/.test(v)) return true;

  // أرقام طويلة جدًا بدون أي بنية
  if (/^\d{10,14}$/.test(v)) return true;

  if (isElectricalRating(v)) return true;
  if (isQuantityToken(v)) return true;

  if (
    /^(P\/N|PN|MPN|W\/O|I\/O|S\/W|REV|VER|MODEL|TYPE)$/i.test(v)
  ) {
    return true;
  }

  if (
    /^(INPUT|OUTPUT|SAFETY|CONTROLLER|POWER|MODULE|BOARD|SYSTEM|SWITCH|SUPPLY|CIRCUIT|RELAY)$/i.test(
      v
    )
  ) {
    return true;
  }

  // يجب أن يحتوي على رقم واحد على الأقل
  if (!/\d/.test(v)) return true;

  return false;
}

function scorePart(value: string): number {
  const v = normalizePart(value);

  if (isBadPart(v)) return -9999;

  let score = 0;

  /*
   * Manufacturer formats.
   */

  // Siemens
  if (/^6ES\d/.test(v)) score += 520;
  if (/^6AV\d/.test(v)) score += 500;
  if (/^6GK\d/.test(v)) score += 500;
  if (/^6EP\d/.test(v)) score += 500;
  if (/^6DP\d/.test(v)) score += 420;
  if (/^6SC\d/.test(v)) score += 420;
  if (/^6BK\d/.test(v)) score += 420;

  // GE Fanuc
  if (/^IC\d{3}[A-Z]{2,}\d+/i.test(v)) score += 470;

  // FANUC
  if (/^A\d{2}B-\d{4}-[A-Z0-9]+$/i.test(v)) score += 460;

  // Allen-Bradley / Rockwell
  if (/^17\d{2}-[A-Z0-9]+/i.test(v)) score += 440;

  // Yokogawa common codes
  if (
    /^(AAI|AAB|AAR|ADV|ALF|CP|EB)\d{3}(?:-[A-Z0-9]+)?$/i.test(v)
  ) {
    score += 420;
  }

  // Beckhoff
  if (/^(EL|KL|CX|EK)\d{4,}/i.test(v)) score += 390;

  // ABB long order codes
  if (/^1S[A-Z0-9]{5,}/i.test(v)) score += 390;
  if (/^2CDG\d+/i.test(v)) score += 390;
  if (/^1SAP\d+/i.test(v)) score += 390;

  /*
   * Siemens structured formats.
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
   * General structural scoring.
   */
  const hyphenGroups = v.split('-').filter(Boolean).length;

  if (hyphenGroups >= 2) score += 45;
  if (hyphenGroups >= 3) score += 75;
  if (hyphenGroups >= 4) score += 30;

  if (/[A-Z]/.test(v)) score += 25;
  if (/\d/.test(v)) score += 25;
  if (/[-/.]/.test(v)) score += 25;

  if (v.length >= 5 && v.length <= 30) score += 25;

  // أحرف ثم أرقام، مثال EL2809 أو RGK600
  if (/^[A-Z]{1,10}\d{2,}[A-Z0-9\-/.]*$/i.test(v)) {
    score += 130;
  }

  // أحرف-أرقام، مثال PCU-20 أو WT34-B440
  if (/^[A-Z]{1,10}-\d{2,}[A-Z0-9\-/.]*$/i.test(v)) {
    score += 115;
  }

  // رقم صناعي بمجموعتين: 125840-02 أو 51403645-100
  if (/^\d{4,9}-\d{2,5}[A-Z]?$/i.test(v)) {
    score += 180;
  }

  // رقم صناعي بثلاث مجموعات
  if (/^\d{2,6}-\d{2,6}-\d{2,6}[A-Z]?$/i.test(v)) {
    score += 190;
  }

  if (/^\d{3}-\d{5}-\d{2}[A-Z]?$/i.test(v)) {
    score += 170;
  }

  // أكواد تحتوي أحرفًا وأرقامًا بدون فواصل
  if (
    /^(?=.*[A-Z])(?=.*\d)[A-Z0-9]{5,20}$/i.test(v)
  ) {
    score += 90;
  }

  /*
   * Penalties.
   */
  if (isWeakFamilyModel(v)) {
    score -= 220;
  }

  // الرقم الخالص يمكن أن يكون صحيحًا، لكنه أضعف من كود منظم
  if (/^\d{5,9}$/.test(v)) {
    score -= 25;
  }

  if (isElectricalRating(v)) {
    score -= 1000;
  }

  return score;
}

function addCandidate(
  candidates: PartCandidate[],
  value: string,
  text: string,
  explicit = false,
  bonus = 0
): void {
  const normalized = normalizePart(value);

  if (isBadPart(normalized)) return;

  const index = text.indexOf(value.toUpperCase());

  candidates.push({
    value: normalized,
    score: scorePart(normalized) + bonus,
    index: index >= 0 ? index : Number.MAX_SAFE_INTEGER,
    explicit,
  });
}

function addPatternMatches(
  candidates: PartCandidate[],
  text: string,
  patterns: RegExp[],
  bonus = 0
): void {
  for (const pattern of patterns) {
    const matches = text.match(pattern) || [];

    for (const match of matches) {
      addCandidate(candidates, match, text, false, bonus);
    }
  }
}

function extractExplicitCandidates(
  candidates: PartCandidate[],
  text: string
): void {
  const labelPatterns: RegExp[] = [
    /\b(?:MFG\.?\s*)?(?:PART\s*(?:NO|NUMBER)|P\/N|PN|MPN)\s*[:#-]?\s*([A-Z0-9][A-Z0-9\-/.+]{2,49})/gi,
    /\b(?:ART(?:ICLE)?\s*(?:NO|NUMBER)?|ART\.?\s*NO\.?)\s*[:#-]?\s*([A-Z0-9][A-Z0-9\-/.+]{2,49})/gi,
    /\b(?:CAT(?:ALOG)?\s*(?:NO|NUMBER)?|CAT\.?\s*NO\.?)\s*[:#-]?\s*([A-Z0-9][A-Z0-9\-/.+]{2,49})/gi,
    /\b(?:ORDER\s*(?:NO|NUMBER)|ORDER\.?\s*NO\.?)\s*[:#-]?\s*([A-Z0-9][A-Z0-9\-/.+]{2,49})/gi,
    /\b(?:REF(?:ERENCE)?|REF\.?)\s*[:#-]?\s*([A-Z0-9][A-Z0-9\-/.+]{2,49})/gi,
    /\b(?:IDENT(?:IFICATION)?\s*(?:NO|NUMBER)|IDENT\.?\s*NO\.?)\s*[:#-]?\s*([A-Z0-9][A-Z0-9\-/.+]{2,49})/gi,
    /\bCODE\s*[:#-]?\s*([A-Z0-9][A-Z0-9\-/.+]{2,49})/gi,
  ];

  for (const pattern of labelPatterns) {
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(text)) !== null) {
      const value = match[1];

      addCandidate(candidates, value, text, true, 650);
    }
  }
}

export function extractIndustrialPartNumberV2(
  input: string
): string {
  const original = clean(input);
  const text = removeBrandPrefix(original);

  if (!text) return '';

  const candidates: PartCandidate[] = [];

  /*
   * أعلى أولوية: قيمة مكتوبة بعد P/N أو ART NO أو CAT NO أو REF.
   */
  extractExplicitCandidates(candidates, text);

  /*
   * Strong manufacturer patterns.
   */
  const strongPatterns: RegExp[] = [
    // Siemens
    /\b6ES\d[\s-]?\d{3}-\d[A-Z]{2}\d{2}-\d[A-Z]{2}\d\b/gi,
    /\b6ES\d[\dA-Z\-/.]+\b/gi,
    /\b6AV\d[\dA-Z\-/.]+\b/gi,
    /\b6GK\d[\dA-Z\-/.]+\b/gi,
    /\b6EP\d[\dA-Z\-/.]+\b/gi,
    /\b6DP\d[\dA-Z\-/.]+\b/gi,
    /\b6SC\d[\dA-Z\-/.]+\b/gi,
    /\b6BK\d[\dA-Z\-/.]+\b/gi,

    // Siemens shortened
    /\b\d{3}-\d[A-Z]{2}\d{2}-\d[A-Z]{2}\d\b/gi,

    // GE Fanuc
    /\bIC\d{3}[A-Z]{2,}\d{2,6}\b/gi,

    // Allen-Bradley
    /\b17\d{2}-[A-Z0-9]{2,16}(?:\/[A-Z0-9]+)?\b/gi,
    /\b17\d{2}[A-Z0-9]{2,12}\/[A-Z0-9]+\b/gi,

    // FANUC
    /\bA\d{2}B-\d{4}-[A-Z0-9]{3,12}\b/gi,

    // ABB order codes
    /\b1S[A-Z0-9]{5,}\b/gi,
    /\b2CDG[\dA-Z]+\b/gi,
    /\b1SAP[\dA-Z]+\b/gi,

    // Yokogawa
    /\b(?:AAI|AAB|AAR|ADV|ALF|CP|EB)\d{3}(?:-[A-Z0-9]+)?\b/gi,

    // Beckhoff
    /\b(?:EL|KL|CX|EK)\d{4,}\b/gi,
  ];

  addPatternMatches(candidates, text, strongPatterns, 220);

  /*
   * General structured patterns.
   */
  const genericPatterns: RegExp[] = [
    // 125840-02 / 51403645-100
    /\b\d{4,9}-\d{2,5}[A-Z]?\b/gi,

    // 230367-REV-B-104064 style codes
    /\b\d{3,9}-[A-Z0-9]{2,10}-[A-Z0-9]{2,12}\b/gi,

    // Three numeric groups
    /\b\d{2,6}-\d{2,6}-\d{2,6}[A-Z]?\b/gi,

    // Numeric leading structured codes
    /\b\d{2,8}-[A-Z0-9]{2,12}-[A-Z0-9]{2,12}\b/gi,

    // Codes such as AAI841-H50, PCU-20, WT34-B440
    /\b[A-Z]{1,10}\d{2,}[A-Z0-9\-/.+]*\b/gi,
    /\b[A-Z]{1,10}-\d{2,}[A-Z0-9\-/.+]*\b/gi,

    // Codes containing three alphanumeric groups
    /\b[A-Z0-9]{2,12}-[A-Z0-9]{2,12}-[A-Z0-9]{2,12}\b/gi,

    // Special structured formats
    /\b[A-Z]\d{3}-\d{2}\b/gi,
    /\b\d{2}[A-Z]\d{5}[A-Z]\d{1,4}\b/gi,
    /\b\d{2}[A-Z]\d{5}\b/gi,

    // Mixed compact code such as 7802C65G13 or 7111933A
    /\b(?=[A-Z0-9]{5,20}\b)(?=[A-Z0-9]*[A-Z])(?=[A-Z0-9]*\d)[A-Z0-9]+\b/gi,
  ];

  addPatternMatches(candidates, text, genericPatterns);

  /*
   * Weak model patterns.
   */
  const weakPatterns: RegExp[] = [
    /\b(?:EM|CPU|CP|FM|SM|PS|IM|PM|PLC|HMI|VFD|AI|AO|DI|DO)\s+\d{2,5}\b/gi,
  ];

  addPatternMatches(candidates, text, weakPatterns, -180);

  /*
   * إزالة التكرارات مع الاحتفاظ بأعلى تقييم لنفس القيمة.
   */
  const unique = new Map<string, PartCandidate>();

  for (const candidate of candidates) {
    const existing = unique.get(candidate.value);

    if (
      !existing ||
      candidate.score > existing.score ||
      (candidate.score === existing.score &&
        candidate.index < existing.index)
    ) {
      unique.set(candidate.value, candidate);
    }
  }

  const ranked = [...unique.values()]
    .filter(({ value, score }) => !isBadPart(value) && score > 0)
    .sort((a, b) => {
      // القيمة المكتوبة صراحة بعد P/N أو ART NO لها الأولوية.
      if (a.explicit !== b.explicit) {
        return a.explicit ? -1 : 1;
      }

      if (b.score !== a.score) {
        return b.score - a.score;
      }

      // عند تساوي النقاط نفضل الذي ظهر أولًا في العنوان.
      if (a.index !== b.index) {
        return a.index - b.index;
      }

      // وأخيرًا نفضل الكود الأكثر تفصيلًا.
      return b.value.length - a.value.length;
    });

  return ranked[0]?.value || '';
}
