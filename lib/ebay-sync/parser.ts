import type { EbayFeedRow } from './types';

function getTag(xml: string, tag: string): string | null {
  const match = xml.match(
    new RegExp(`<${tag}[^>]*>(.*?)</${tag}>`, 's')
  );

  return match?.[1]?.trim() || null;
}

function parseNumber(value: string | null): number | null {
  if (!value) return null;

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}

export function parseActiveInventoryXml(
  xml: string
): EbayFeedRow[] {
  const blocks =
    xml.match(/<SKUDetails>[\s\S]*?<\/SKUDetails>/g) || [];

  return blocks.flatMap((block, rowIndex) => {
    const ebayItemId = getTag(block, 'ItemID');

    if (!ebayItemId) {
      return [];
    }

    const priceMatch = block.match(
      /<Price(?:\s+currencyID="([^"]*)")?[^>]*>([^<]*)<\/Price>/
    );

    const quantity =
      parseNumber(getTag(block, 'Quantity')) ?? 0;

    const price = parseNumber(
      priceMatch?.[2]?.trim() || null
    );

    return [
      {
        ebayItemId,
        sku: getTag(block, 'SKU'),
        quantity,
        price,
        currency: priceMatch?.[1]?.trim() || null,
        rawXml: block,
        rowIndex,
      },
    ];
  });
}
