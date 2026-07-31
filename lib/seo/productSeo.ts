export type ProductSeoInput = {
  brand?: string | null;
  partNumber?: string | null;
  name?: string | null;
  description?: string | null;
  condition?: string | null;
};

function cleanSeoText(value?: string | null): string {
  return String(value ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function removeDuplicateProductDetails(
  productName: string,
  brand: string,
  partNumber: string,
): string {
  let cleanedName = productName;

  if (brand) {
    cleanedName = cleanedName.replace(
      new RegExp(`^${escapeRegExp(brand)}[\\s:–—-]*`, 'i'),
      '',
    );
  }

  if (partNumber) {
    cleanedName = cleanedName
      .replace(
        new RegExp(
          `\\bP\\/?N\\s*[:#-]?\\s*${escapeRegExp(partNumber)}\\b`,
          'gi',
        ),
        '',
      )
      .replace(
        new RegExp(escapeRegExp(partNumber), 'gi'),
        '',
      );
  }

  return cleanedName
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.:;])/g, '$1')
    .replace(/^[\s:–—-]+|[\s:–—-]+$/g, '')
    .trim();
}

function isUsefulEnglishDescription(value: string): boolean {
  if (value.length < 40) {
    return false;
  }

  const totalLetters = value.match(/\p{L}/gu)?.length ?? 0;
  const latinLetters = value.match(/[A-Za-z]/g)?.length ?? 0;

  if (totalLetters === 0 || latinLetters / totalLetters < 0.85) {
    return false;
  }

  return /\b(the|and|for|with|this|available|industrial|automation|module|control|power|supply|new|used)\b/i.test(
    value,
  );
}

export function buildProductSeo(input: ProductSeoInput) {
  const brand =
    cleanSeoText(input.brand) || 'Industrial Automation';

  const partNumber = cleanSeoText(input.partNumber);
  const productName = cleanSeoText(input.name);
  const rawDescription = cleanSeoText(input.description);
  const condition = cleanSeoText(input.condition) || 'surplus';

  const normalizedName = removeDuplicateProductDetails(
    productName,
    brand,
    partNumber,
  );

  const seoTitle = [
    brand,
    partNumber,
    normalizedName,
  ]
    .filter(Boolean)
    .join(' ')
    .slice(0, 70);

  const fallbackDescription = [
    brand,
    partNumber,
    normalizedName,
    `available in ${condition} condition.`,
    'Request a quote with worldwide DHL and FedEx shipping.',
  ]
    .filter(Boolean)
    .join(' ');

  const seoDescription = (
    isUsefulEnglishDescription(rawDescription)
      ? rawDescription
      : fallbackDescription
  ).slice(0, 160);

  const imageAlt = [
    brand,
    partNumber,
    normalizedName,
  ]
    .filter(Boolean)
    .join(' ')
    .slice(0, 160);

  return {
    brand,
    partNumber,
    productName,
    normalizedName,
    title: seoTitle,
    description: seoDescription,
    imageAlt,
  };
}
