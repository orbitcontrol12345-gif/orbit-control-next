const PLACEHOLDER_VALUES = new Set([
  'UNKNOWN',
  'UNBRANDED',
  'GENERIC',
  'NULL',
  'N/A',
  'NA',
  'NONE',
  'NOT AVAILABLE',
  'NOT SPECIFIED',
  'DOES NOT APPLY',
  'NOT APPLICABLE',
]);

export function cleanProductDisplayText(
  value?: string | null,
): string {
  return String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getUsefulProductValue(
  value?: string | null,
): string | null {
  const cleaned = cleanProductDisplayText(value);

  if (
    !cleaned ||
    PLACEHOLDER_VALUES.has(cleaned.toUpperCase())
  ) {
    return null;
  }

  return cleaned;
}

export function getDisplayBrand(
  value?: string | null,
): string | null {
  return getUsefulProductValue(value);
}

export function getDisplayPartNumber(
  value?: string | null,
): string | null {
  return getUsefulProductValue(value);
}

export function getDisplaySku(
  value?: string | null,
): string | null {
  const sku = getUsefulProductValue(value);

  if (
    !sku ||
    /[<>]/.test(String(value || '')) ||
    /^SKU\s*>/i.test(sku)
  ) {
    return null;
  }

  return sku;
}

export function getDisplayCategory(
  value?: string | null,
): string | null {
  const category = getUsefulProductValue(value);

  if (!category) {
    return null;
  }

  const mostSpecificCategory = category
    .split('|')
    .map((item) => item.trim())
    .filter(Boolean)
    .at(-1);

  return getUsefulProductValue(mostSpecificCategory);
}
