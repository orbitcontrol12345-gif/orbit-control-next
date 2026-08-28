import type { Product } from '@/lib/types';
import { searchSupabaseProducts } from '@/lib/supabase-products';
import {
  normalizePartNumberForMatch,
  type ExtractedPartNumber,
} from '@/lib/email-part-number-extraction';

const DEFAULT_SITE_URL = 'https://www.orbit-surplus.com';

export type ResolvedPartLink = {
  partNumber: string;
  url: string;
  exactMatch: boolean;
  productName?: string;
};

function siteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL
  ).replace(/\/$/, '');
}

function getExactProduct(
  products: Product[],
  partNumber: string,
): Product | null {
  const normalizedPartNumber =
    normalizePartNumberForMatch(partNumber);

  return (
    products.find(
      (product) =>
        normalizePartNumberForMatch(product.partNumber) ===
        normalizedPartNumber,
    ) || null
  );
}

async function resolveOne(
  candidate: ExtractedPartNumber,
): Promise<ResolvedPartLink | null> {
  const products = await searchSupabaseProducts(candidate.value, 12);
  const exactProduct = getExactProduct(products, candidate.value);

  if (exactProduct) {
    return {
      partNumber: candidate.value,
      url: `${siteUrl()}/products/${encodeURIComponent(exactProduct.slug)}`,
      exactMatch: true,
      productName: exactProduct.name,
    };
  }

  if (!candidate.labeled) {
    return null;
  }

  return {
    partNumber: candidate.value,
    url: `${siteUrl()}/products?search=${encodeURIComponent(candidate.value)}`,
    exactMatch: false,
  };
}

export async function resolvePartNumberLinks(
  candidates: ExtractedPartNumber[],
): Promise<ResolvedPartLink[]> {
  const resolved = await Promise.all(
    candidates.map(async (candidate) => {
      try {
        return await resolveOne(candidate);
      } catch (error) {
        console.error('Part-number catalog lookup failed:', error);

        return candidate.labeled
          ? {
              partNumber: candidate.value,
              url: `${siteUrl()}/products?search=${encodeURIComponent(candidate.value)}`,
              exactMatch: false,
            }
          : null;
      }
    }),
  );

  return resolved.filter(
    (link): link is ResolvedPartLink => Boolean(link),
  );
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function renderPartLinksHtml(
  links: ResolvedPartLink[],
): string {
  const rows = links
    .map((link) => {
      const note = link.exactMatch
        ? 'Open item'
        : 'Search this part';

      return `
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-family:Arial,sans-serif;">
            <a href="${escapeHtml(link.url)}" style="color:#b45309;font-weight:700;text-decoration:underline;">${escapeHtml(link.partNumber)}</a>
          </td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;color:#4b5563;font-family:Arial,sans-serif;font-size:13px;">${note}</td>
        </tr>`;
    })
    .join('');

  return `
    <div style="font-family:Arial,sans-serif;color:#111827;">
      <p style="margin:0 0 12px;"><strong>Orbit Part Links</strong></p>
      <p style="margin:0 0 14px;color:#4b5563;">Tap a part number to open the matching item.</p>
      <table role="presentation" style="border-collapse:collapse;border:1px solid #e5e7eb;min-width:320px;">
        <tbody>${rows}</tbody>
      </table>
      <p style="margin:14px 0 0;color:#6b7280;font-size:12px;">Generated automatically from the customer email. The original message and attachments were not changed.</p>
    </div>`;
}

export function renderPartLinksText(
  links: ResolvedPartLink[],
): string {
  return [
    'Orbit Part Links',
    'Tap a part number to open the matching item:',
    '',
    ...links.map(
      (link) => `${link.partNumber}: ${link.url}`,
    ),
    '',
    'Generated automatically. The original message and attachments were not changed.',
  ].join('\n');
}
