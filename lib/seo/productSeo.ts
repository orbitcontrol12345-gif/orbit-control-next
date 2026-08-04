import { PRODUCT_TYPES } from './productTypeLibrary';
export type ProductSeoInput = {
  brand?: string | null;
  partNumber?: string | null;
  name?: string | null;
  description?: string | null;
  condition?: string | null;

  category?: string | null;
  manufacturer?: string | null;
};

function cleanSeoText(value?: string | null): string {
  return String(value ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
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

function normalizeCondition(value: string): string {
  const condition = value.trim().toLowerCase();

  if (condition.includes('refurb')) {
    return 'refurbished';
  }

  if (
    condition.includes('open box') ||
    condition.includes('new – open box') ||
    condition.includes('new - open box')
  ) {
    return 'new open-box';
  }

  if (
    condition.includes('parts') ||
    condition.includes('not working') ||
    condition.includes('damaged')
  ) {
    return 'for-parts';
  }

  if (condition.includes('new')) {
    return 'new';
  }

  if (condition.includes('used')) {
    return 'used';
  }

  return condition || 'surplus';
}


function getConditionSentence(
  fullProductName: string,
  condition: string,
): string {
  switch (condition) {
    case 'new':
      return `${fullProductName} is listed in new condition and is available for industrial replacement, maintenance and OEM requirements.`;

    case 'new open-box':
      return `${fullProductName} is listed in new open-box condition and is suitable for industrial replacement, maintenance and OEM requirements.`;

    case 'refurbished':
      return `${fullProductName} is listed in refurbished condition and is suitable for industrial maintenance, repair and replacement projects.`;

    case 'used':
      return `${fullProductName} is listed in used condition and is suitable for maintenance, repair, replacement and MRO inventory requirements.`;

    case 'for-parts':
      return `${fullProductName} is offered for parts or repair and may be suitable for component recovery, technical evaluation or specialist repair projects.`;

    default:
      return `${fullProductName} is available as an industrial automation and electrical spare part for maintenance, repair and replacement requirements.`;
  }
}

function isUsefulEnglishDescription(value: string): boolean {
  if (value.length < 60) {
    return false;
  }

  const totalLetters = value.match(/\p{L}/gu)?.length ?? 0;
  const latinLetters = value.match(/[A-Za-z]/g)?.length ?? 0;

  if (
    totalLetters === 0 ||
    latinLetters / totalLetters < 0.85
  ) {
    return false;
  }

  return /\b(the|and|for|with|this|available|industrial|automation|module|control|power|supply|new|used|product|unit)\b/i.test(
    value,
  );
}

function trimToLength(
  value: string,
  maxLength: number,
): string {
  if (value.length <= maxLength) {
    return value;
  }

  const shortened = value.slice(0, maxLength + 1);
  const lastSpace = shortened.lastIndexOf(' ');

  return `${shortened.slice(
    0,
    lastSpace > 0 ? lastSpace : maxLength,
  )}`.replace(/[,\s:;.-]+$/, '');
}

export function buildProductSeo(input: ProductSeoInput) {
  const brand =
    cleanSeoText(input.brand) || 'Industrial Automation';

  const partNumber =
    cleanSeoText(input.partNumber) || 'Unknown Part Number';

  const productName =
    cleanSeoText(input.name) ||
    `${brand} ${partNumber} Industrial Spare Part`;

  const rawDescription = cleanSeoText(input.description);
const category = cleanSeoText(input.category);

const manufacturer =
  cleanSeoText(input.manufacturer) || brand;
  const normalizedCondition = normalizeCondition(
    cleanSeoText(input.condition),
  );

  const normalizedName = removeDuplicateProductDetails(
    productName,
    brand,
    partNumber,
  );
const productSearchText = [
  productName,
  normalizedName,
  category,
]
  .filter(Boolean)
  .join(' ')
  .toUpperCase();

const productType = (
  Object.entries(PRODUCT_TYPES).find(
    ([key, type]) =>
      key !== 'INDUSTRIAL_PART' &&
      type.keywords.some((keyword) =>
        productSearchText.includes(
          keyword.toUpperCase(),
        ),
      ),
  )?.[0] || 'INDUSTRIAL_PART'
) as keyof typeof PRODUCT_TYPES;

const productTypeContent =
  PRODUCT_TYPES[productType];
  const fullProductName = [
    brand,
    partNumber !== 'Unknown Part Number'
      ? partNumber
      : '',
    normalizedName,
  ]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  const seoTitle = trimToLength(
  [
    manufacturer,
    partNumber,
    normalizedName,
    productTypeContent.label,
    normalizedCondition !== 'surplus'
      ? `(${normalizedCondition})`
      : '',
  ]
    .filter(Boolean)
    .join(' '),
  65,
);
  const conditionSentence = getConditionSentence(
    fullProductName,
    normalizedCondition,
  );

  const originalDescription = isUsefulEnglishDescription(
    rawDescription,
  )
    ? rawDescription
    : '';

const systemsSection =
  `The unit is intended for use with ${productTypeContent.systems}.`;

const industriesSection =
  'It may be used across manufacturing, factory automation, process industries, utilities, OEM equipment and industrial maintenance operations.';

const supportSection =
  'Our technical sales team can assist with part identification, compatibility checks, replacement options, quotations and worldwide logistics.';

const shippingSection =
  'Worldwide DHL and FedEx shipping is available from the United Arab Emirates with secure packaging and international tracking.';

const smartDescription = [
  originalDescription,

  `${manufacturer} ${partNumber} ${normalizedName} is a ${productTypeContent.label} designed for ${productTypeContent.applications}.`,

  conditionSentence,

  systemsSection,

  industriesSection,

  `${manufacturer} industrial products are commonly selected for automation upgrades, equipment maintenance, production support and OEM replacement projects.`,

  'Orbit Control Automation supplies new, used, refurbished, surplus and obsolete industrial automation spare parts to customers worldwide.',

  shippingSection,

  supportSection,

  `Request a quotation for part number ${partNumber} to confirm current pricing, stock availability, compatibility, additional photos and estimated delivery time.`,
]
.filter(Boolean)
.join('\n\n');
 const metaDescription = trimToLength(
  `${fullProductName} available in ${normalizedCondition} condition. Request pricing, availability and worldwide DHL or FedEx delivery from Orbit Control Automation.`,
  155,
);

  const imageAlt = trimToLength(
    `${brand} ${partNumber} ${normalizedName} ${normalizedCondition} industrial spare part`,
    160,
  );

  return {
  brand,
  partNumber,
  productName,
  normalizedName,
  condition: normalizedCondition,
  category,
  manufacturer,
  productType,
  title: seoTitle,
  description: smartDescription,
  metaDescription,
  imageAlt,
};
}
