import { extractPartNumber } from '@/lib/part-number';
import { detectIndustrialBrand } from '@/lib/industrial-brand';

const INVALID_TEXT_VALUES = new Set([
  '',
  'UNKNOWN',
  'UNBRANDED',
  'DOES NOT APPLY',
  'DOES NOT APPLY.',
  'N/A',
  'NA',
  'NONE',
  'NOT APPLICABLE',
  'GENERIC',
]);

const CONDITION_WORDS = new Set([
  'NEW',
  'USED',
  'OPEN BOX',
  'REFURBISHED',
  'FOR PARTS',
  'NOT WORKING',
  'TESTED',
  'WORKING',
  'SURPLUS',
]);

function normalizeWhitespace(value: unknown) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getAspectValue(item: any, names: string[]) {
  const aspects = Array.isArray(item?.localizedAspects)
    ? item.localizedAspects
    : [];

  const normalizedNames = names.map((name) => name.toLowerCase());

  for (const aspect of aspects) {
    const name = normalizeWhitespace(aspect?.name).toLowerCase();

    if (!normalizedNames.includes(name)) continue;

    const value = Array.isArray(aspect?.value)
      ? aspect.value[0]
      : aspect?.value;

    const cleaned = normalizeWhitespace(value);

    if (cleaned) return cleaned;
  }

  return '';
}

function isInvalidTextValue(value: unknown) {
  return INVALID_TEXT_VALUES.has(
    normalizeWhitespace(value).toUpperCase()
  );
}

function normalizeCandidate(value: unknown) {
  return normalizeWhitespace(value)
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/^[,;:|]+|[,;:|]+$/g, '')
    .trim()
    .toUpperCase();
}

function isEbayItemId(value: string, ebayItemId: string) {
  const normalizedValue = value.replace(/\D/g, '');
  const normalizedItemId = String(ebayItemId || '').replace(/\D/g, '');

  return Boolean(
    normalizedValue &&
      normalizedItemId &&
      normalizedValue === normalizedItemId
  );
}

function isInvalidPartNumber(
  candidate: string,
  ebayItemId: string
) {
  const value = normalizeCandidate(candidate);

  if (!value) return true;
  if (isInvalidTextValue(value)) return true;
  if (isEbayItemId(value, ebayItemId)) return true;

  if (/^\d{11,14}$/.test(value)) return true;

  if (/^(LOT|LOT[-\s]?\d+|LOT OF \d+)$/i.test(value)) {
    return true;
  }

  if (/^\d+\s*(PCS?|PIECES?|UNITS?)$/i.test(value)) {
    return true;
  }

  if (
    /^(NEW|USED|OPEN BOX|REFURBISHED|TESTED|WORKING|SURPLUS)$/i.test(
      value
    )
  ) {
    return true;
  }

  if (/^\d+(\.\d+)?\s*(VAC|VDC|AC|DC|V|HZ|KHZ|KW|W|A|AMP|AMPS)$/i.test(value)) {
    return true;
  }

  if (/^\d+\s*(PH|PHASE)$/i.test(value)) {
    return true;
  }

  if (/^\d+(\.\d+)?\s*(MM|CM|M|IN|INCH|KG|G|LB|LBS)$/i.test(value)) {
    return true;
  }

  if (/^(SERIAL|SERIAL NUMBER|S\/N)$/i.test(value)) {
    return true;
  }

  if (value.length < 3 || value.length > 80) {
    return true;
  }

  const hasLetter = /[A-Z]/.test(value);
  const hasNumber = /\d/.test(value);

  if (!hasLetter && !hasNumber) return true;

  return false;
}

function scorePartNumber(candidate: string, source: string) {
  let score = 0;

  if (source === 'mpn') score += 100;
  if (source === 'manufacturer-part-number') score += 95;
  if (source === 'model-number') score += 85;
  if (source === 'model') score += 80;
  if (source === 'extractor') score += 65;
  if (source === 'title-regex') score += 45;

  if (/[A-Z]/.test(candidate) && /\d/.test(candidate)) {
    score += 20;
  }

  if (/[-/.]/.test(candidate)) {
    score += 10;
  }

  if (candidate.length >= 5 && candidate.length <= 35) {
    score += 10;
  }

  if (/^\d+$/.test(candidate)) {
    score -= 25;
  }

  return score;
}

export function normalizeEbayTitle(title: unknown) {
  let result = normalizeWhitespace(title);

  const patterns: RegExp[] = [
    /\bNEW\s+WITHOUT\s+(?:THE\s+)?BOX\b/gi,
    /\bNEW\s+WITH\s+(?:THE\s+)?OLD\s+BOX\b/gi,
    /\bWITH\s+(?:THE\s+)?OLD\s+BOX\b/gi,
    /\bWITHOUT\s+(?:ANY\s+)?ACCESSORIES\b/gi,
    /\bWITH(?:OUT)?\s+ACCESSORIES\b/gi,
    /\bWITHOUT\s+(?:THE\s+)?BOX\b/gi,
    /\bNO\s+BOX\b/gi,
    /\bW\/?O\s+BOX\b/gi,
    /\bOPEN\s+BOX\b/gi,
    /\bOLD\s+STOCK\b/gi,
    /\bNEW\s+OLD\s+STOCK\b/gi,
    /\bFOR\s+PARTS(?:\s+OR\s+NOT\s+WORKING)?\b/gi,
    /\bNOT\s+WORKING\b/gi,
    /\bTESTED\s*(?:&|AND)?\s*WORKING\b/gi,
    /\bTESTED\s+OK\b/gi,
    /\bTESTED\b/gi,
    /\bWORKING\b/gi,
    /\bREFURBISHED\b/gi,
    /\bSURPLUS\b/gi,
    /\bOBSOLETE\b/gi,
    /\bFAST\s+SHIPPING\b/gi,
    /\bFREE\s+SHIPPING\b/gi,
    /\bIN\s+STOCK\b/gi,
    /\bLOT\s+OF\s+\d+\b/gi,
    /\bLOT\s*[-:#]?\s*\d+\b/gi,
    /\b\d+\s*(?:PCS?|PIECES?|UNITS?)\b/gi,
    /\bNEW\b/gi,
    /\bUSED\b/gi,
  ];

  for (const pattern of patterns) {
    result = result.replace(pattern, ' ');
  }

  return result
    .replace(/\(\s*\)/g, ' ')
    .replace(/\[\s*\]/g, ' ')
    .replace(/\{\s*\}/g, ' ')
    .replace(/\s*[-|,:;]+\s*$/g, '')
    .replace(/^[\s\-|,:;]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeEbayCondition(
  condition: unknown,
  title: unknown
) {
  const combined = `${normalizeWhitespace(condition)} ${normalizeWhitespace(
    title
  )}`.toLowerCase();

  if (
    combined.includes('for parts') ||
    combined.includes('not working') ||
    combined.includes('parts only') ||
    combined.includes('as is')
  ) {
    return 'For parts';
  }

  if (combined.includes('refurb')) {
    return 'Refurbished';
  }

  if (
    combined.includes('new without box') ||
    combined.includes('new no box') ||
    combined.includes('new w/o box')
  ) {
    return 'New Without Box';
  }

  if (
    combined.includes('open box') ||
    combined.includes('new – open box') ||
    combined.includes('new - open box')
  ) {
    return 'New – Open box';
  }

  if (
    combined.includes('tested and working') ||
    combined.includes('tested & working') ||
    combined.includes('tested ok')
  ) {
    return 'Tested & Working';
  }

  if (combined.includes('new')) {
    return 'New';
  }

  if (combined.includes('used')) {
    return 'Used';
  }

  return normalizeWhitespace(condition) || 'Used';
}

export function normalizeEbayPartNumber(
  item: any,
  title: string,
  ebayItemId: string
) {
  const candidates: Array<{
    value: string;
    source: string;
  }> = [];

  const addCandidate = (value: unknown, source: string) => {
    const normalized = normalizeCandidate(value);

    if (!normalized) return;
    if (isInvalidPartNumber(normalized, ebayItemId)) return;

    candidates.push({
      value: normalized,
      source,
    });
  };

  addCandidate(
    getAspectValue(item, ['MPN']),
    'mpn'
  );

  addCandidate(
    getAspectValue(item, [
      'Manufacturer Part Number',
      'Manufacturer Part No.',
      'Part Number',
    ]),
    'manufacturer-part-number'
  );

  addCandidate(
    getAspectValue(item, ['Model Number']),
    'model-number'
  );

  addCandidate(
    getAspectValue(item, ['Model']),
    'model'
  );

  addCandidate(
    extractPartNumber(title),
    'extractor'
  );

  const titlePatterns = [
    /\b[A-Z]{1,8}\d[A-Z0-9\-/.]{2,50}\b/gi,
    /\b\d{1,8}[A-Z][A-Z0-9\-/.]{2,50}\b/gi,
    /\b[A-Z0-9]{2,15}(?:[-/.][A-Z0-9]{1,15})+\b/gi,
  ];

  for (const pattern of titlePatterns) {
    const matches = title.match(pattern) || [];

    for (const match of matches) {
      addCandidate(match, 'title-regex');
    }
  }

  const uniqueCandidates = Array.from(
    new Map(
      candidates.map((candidate) => [
        candidate.value,
        candidate,
      ])
    ).values()
  );

  uniqueCandidates.sort(
    (a, b) =>
      scorePartNumber(b.value, b.source) -
      scorePartNumber(a.value, a.source)
  );

  return uniqueCandidates[0]?.value || null;
}

export function normalizeEbayBrand(
  item: any,
  title: string,
  cleanedTitle: string,
  partNumber: string | null
) {
  const aspectBrand = getAspectValue(item, ['Brand']);
  const manufacturer = getAspectValue(item, [
    'Manufacturer',
    'Make',
  ]);

  const rawBrand = normalizeWhitespace(item?.brand);

  const directCandidates = [
    rawBrand,
    aspectBrand,
    manufacturer,
  ].filter((value) => value && !isInvalidTextValue(value));

  for (const candidate of directCandidates) {
    const detected = detectIndustrialBrand(candidate);

    if (
      detected &&
      !isInvalidTextValue(detected)
    ) {
      return detected;
    }
  }

  const detected = detectIndustrialBrand(
    [
      manufacturer,
      aspectBrand,
      rawBrand,
      title,
      cleanedTitle,
      partNumber || '',
    ]
      .filter(Boolean)
      .join(' ')
  );

  if (!detected || isInvalidTextValue(detected)) {
    return 'UNKNOWN';
  }

  return detected;
}

export function normalizeEbayGallery(item: any) {
  const candidates = [
    item?.image?.imageUrl,
    ...(Array.isArray(item?.thumbnailImages)
      ? item.thumbnailImages.map((image: any) => image?.imageUrl)
      : []),
    ...(Array.isArray(item?.additionalImages)
      ? item.additionalImages.map((image: any) => image?.imageUrl)
      : []),
  ];

  const gallery = Array.from(
    new Set(
      candidates
        .map((url) => normalizeWhitespace(url))
        .filter((url) => /^https?:\/\//i.test(url))
    )
  );

  return {
    primaryImage: gallery[0] || null,
    gallery,
  };
}

export function normalizeEbayDescription(
  item: any,
  fallbackTitle: string
) {
  const description =
    normalizeWhitespace(item?.description) ||
    normalizeWhitespace(item?.shortDescription) ||
    normalizeWhitespace(item?.subtitle) ||
    normalizeWhitespace(fallbackTitle);

  return description;
}

export function normalizeEbayItem(
  item: any,
  ebayItemId: string
) {
  const originalTitle = normalizeWhitespace(item?.title);
  const name = normalizeEbayTitle(originalTitle);

  const partNumber = normalizeEbayPartNumber(
    item,
    originalTitle,
    ebayItemId
  );

  const brand = normalizeEbayBrand(
    item,
    originalTitle,
    name,
    partNumber
  );

  const condition = normalizeEbayCondition(
    item?.condition,
    originalTitle
  );

  const { primaryImage, gallery } =
    normalizeEbayGallery(item);

  const description = normalizeEbayDescription(
    item,
    originalTitle
  );

  return {
    originalTitle,
    name: name || originalTitle || partNumber || ebayItemId,
    partNumber,
    modelNumber:
      normalizeCandidate(
        getAspectValue(item, ['Model Number', 'Model'])
      ) || partNumber,
    brand,
    condition,
    primaryImage,
    gallery,
    description,
  };
}
