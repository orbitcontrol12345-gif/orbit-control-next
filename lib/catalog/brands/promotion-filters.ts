const RESERVED_WORDS = new Set([
  'NEW',
  'USED',
  'TESTED',
  'LOT',
  'LOTS',
  'MODULE',
  'BOARD',
  'POWER',
  'CONTROL',
  'SYSTEM',
  'INPUT',
  'OUTPUT',
  'TYPE',
  'MODEL',
  'SERIES',
  'CARD',
  'PLC',
  'CPU',
  'UNIT',
  'BASE',
  'CASE',
  'OPEN',
  'BOX',
  'WITHOUT',
  'WITH',
  'ACCESSORIES',
  'ASSEMBLY',
  'INDUSTRIAL',
  'UNKNOWN',
]);

export function normalizeBrand(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '')
    .trim();
}

export function isReservedWord(candidate: string): boolean {
  return RESERVED_WORDS.has(
    normalizeBrand(candidate),
  );
}

export function isNumericBrand(candidate: string): boolean {
  return /^[0-9]+$/.test(
    candidate.trim(),
  );
}

export function looksLikePartNumber(candidate: string): boolean {
  const value = candidate.trim().toUpperCase();

  if (value.length < 3) {
    return true;
  }

  // براند من أحرف فقط = مقبول
  if (/^[A-Z]+$/.test(value)) {
    return false;
  }

  // براند يبدأ بحرف وفيه أرقام قليلة = مقبول
  if (/^[A-Z][A-Z0-9-]{1,15}$/.test(value)) {
    const digits = (value.match(/[0-9]/g) || []).length;

    if (digits <= 3) {
      return false;
    }
  }

  // إذا أكثر من نصفه أرقام فهو غالباً Part Number
  const digits = (value.match(/[0-9]/g) || []).length;

  return digits > value.length / 2;
}
export function shouldRejectCandidate(
  candidate: string,
  confidence: number,
  productCount: number,
  minimumConfidence: number,
  minimumProductCount: number,
): string | null {
  if (!candidate.trim()) {
    return 'Empty';
  }

  if (
    productCount <
    minimumProductCount
  ) {
    return 'Too few products';
  }

  if (
    confidence <
    minimumConfidence
  ) {
    return 'Low confidence';
  }

  if (
    isReservedWord(candidate)
  ) {
    return 'Reserved word';
  }

  if (
    isNumericBrand(candidate)
  ) {
    return 'Numeric';
  }

  if (
    looksLikePartNumber(candidate)
  ) {
    return 'Looks like part number';
  }

  return null;
}
