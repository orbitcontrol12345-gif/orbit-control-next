import { BRAND_ALIASES } from './brand-dictionary';
import { supabaseAdmin } from '@/lib/supabase-admin';

function normalize(value: string): string {
  return String(value || '')
    .toUpperCase()
    .replace(/[^\w+üÜäÄöÖ\s&+/-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ===== النسخة القديمة =====
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

// ===== النسخة الجديدة =====
export async function detectIndustrialBrandAsync(
  input: string
): Promise<string> {
  const text = normalize(input);

  if (!text) return 'UNKNOWN';

  const { data } = await supabaseAdmin
    .from('brand_registry')
    .select('canonical_name, aliases')
    .eq('is_active', true);

  if (data) {
    for (const row of data) {
      const aliases = [
        row.canonical_name,
        ...(row.aliases ?? []),
      ];

      for (const alias of aliases) {
        const normalizedAlias = normalize(alias);

        const escapedAlias = normalizedAlias.replace(
          /[.*+?^${}()|[\]\\]/g,
          '\\$&'
        );

        const pattern = new RegExp(
          `(^|\\s|[-_/])${escapedAlias}(\\s|[-_/]|$)`,
          'i'
        );

        if (pattern.test(text)) {
          return row.canonical_name;
        }
      }
    }
  }

  // fallback للقاموس القديم
  return detectIndustrialBrand(text);
}
