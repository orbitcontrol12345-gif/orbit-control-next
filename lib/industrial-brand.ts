import { BRAND_ALIASES } from './brand-dictionary';

function normalize(value: string): string {
  return String(value || '')
    .toUpperCase()
    .replace(/[^\w+üÜäÄöÖ\s&+/-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function detectIndustrialBrand(input: string): string {
  const text = normalize(input);

  if (!text) return 'UNKNOWN';

  for (const [brand, aliases] of Object.entries(BRAND_ALIASES)) {
    for (const alias of aliases) {
      const normalizedAlias = normalize(alias);
      const escapedAlias = normalizedAlias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      const pattern = new RegExp(
        `(^|\\s|[-_/])${escapedAlias}(\\s|[-_/]|$)`,
        'i'
      );

      if (pattern.test(text)) {
        return brand;
      }
    }
  }

  return 'UNKNOWN';
}
