type CleanProductNameInput = {
  title: string;
  brand?: string | null;
  partNumber?: string | null;
};

const removablePhrases = [
  'NEW WITHOUT BOX',
  'NEW IN BOX',
  'NEW OPEN BOX',
  'OPEN BOX',
  'BRAND NEW',
  'NEW OLD STOCK',
  'NEW SURPLUS',
  'USED TESTED',
  'TESTED WORKING',
  'TESTED',
  'FULLY TESTED',
  'WORKING',
  'REFURBISHED',
  'FOR PARTS',
  'NOT WORKING',
  'FREE SHIPPING',
  'FAST SHIPPING',
  'WORLDWIDE SHIPPING',
  'SAME DAY SHIPPING',
  'READY TO SHIP',
];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeSpaces(value: string): string {
  return value
    .replace(/[_|]+/g, ' ')
    .replace(/\s*[-–—]\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function removeConditionWords(value: string): string {
  let result = value;

  for (const phrase of removablePhrases) {
    const regex = new RegExp(`\\b${escapeRegExp(phrase)}\\b`, 'gi');
    result = result.replace(regex, ' ');
  }

  result = result.replace(
    /\b(NEW|USED|SURPLUS|ORIGINAL|GENUINE|OEM|NOS)\b/gi,
    ' '
  );

  return result;
}

function removeSellerWords(value: string): string {
  return value.replace(
    /\b(LOT OF \d+|LOT \d+|\d+\s*PCS?|PCS?|PIECES?|QTY\s*\d+)\b/gi,
    ' '
  );
}

function removeDuplicateBrand(
  value: string,
  brand?: string | null
): string {
  if (!brand || brand.toUpperCase() === 'UNKNOWN') {
    return value;
  }

  const escapedBrand = escapeRegExp(brand.trim());

  return value.replace(
    new RegExp(`^(?:${escapedBrand}\\s+){2,}`, 'i'),
    `${brand.trim()} `
  );
}

function ensureBrandAtStart(
  value: string,
  brand?: string | null
): string {
  if (!brand || brand.toUpperCase() === 'UNKNOWN') {
    return value;
  }

  const normalizedBrand = brand.trim();
  const brandRegex = new RegExp(
    `^${escapeRegExp(normalizedBrand)}\\b`,
    'i'
  );

  if (brandRegex.test(value)) {
    return value;
  }

  return `${normalizedBrand} ${value}`;
}

function ensurePartNumber(
  value: string,
  partNumber?: string | null
): string {
  if (
    !partNumber ||
    partNumber.toUpperCase() === 'UNKNOWN'
  ) {
    return value;
  }

  const normalizedPartNumber = partNumber.trim();

  if (
    value
      .toUpperCase()
      .includes(normalizedPartNumber.toUpperCase())
  ) {
    return value;
  }

  const words = value.split(' ');

  if (words.length === 0) {
    return normalizedPartNumber;
  }

  words.splice(1, 0, normalizedPartNumber);

  return words.join(' ');
}

function toReadableCase(value: string): string {
  return value
    .split(' ')
    .map((word) => {
      if (!word) return word;

      // نحافظ على أرقام القطع والاختصارات
      if (/\d/.test(word)) {
        return word.toUpperCase();
      }

      if (word.length <= 4 && word === word.toUpperCase()) {
        return word;
      }

      return (
        word.charAt(0).toUpperCase() +
        word.slice(1).toLowerCase()
      );
    })
    .join(' ');
}

export function cleanProductName({
  title,
  brand,
  partNumber,
}: CleanProductNameInput): string {
  let result = String(title || '').trim();

  if (!result) {
    return [brand, partNumber]
      .filter(
        (value) =>
          value &&
          String(value).toUpperCase() !== 'UNKNOWN'
      )
      .join(' ');
  }

  result = removeConditionWords(result);
  result = removeSellerWords(result);
  result = normalizeSpaces(result);
  result = removeDuplicateBrand(result, brand);
  result = ensureBrandAtStart(result, brand);
  result = ensurePartNumber(result, partNumber);
  result = normalizeSpaces(result);
  result = toReadableCase(result);

  return result.slice(0, 180).trim();
}
