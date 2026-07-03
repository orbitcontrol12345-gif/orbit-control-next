function normalizeText(value: string) {
  return String(value || '')
    .toUpperCase()
    .replace(/\b(NEW|USED|OPEN BOX|NO BOX|WITHOUT BOX|WITH OLD BOX|OLD STOCK)\b/g, '')
    .replace(/\b(LOT|PCS|PIECES|PIECE)\b/g, '')
    .replace(/[^A-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function makeCatalogKey(input: {
  brand?: string | null;
  partNumber?: string | null;
  name?: string | null;
}) {
  const brand = normalizeText(input.brand || 'UNKNOWN');
  const part = normalizeText(input.partNumber || 'UNKNOWN');
  const name = normalizeText(input.name || '');

  if (!part || part === 'UNKNOWN') {
    return `${brand}::UNKNOWN::${name}`;
  }

  return `${brand}::${part}`;
}
