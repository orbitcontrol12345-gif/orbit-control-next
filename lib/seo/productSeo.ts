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
type ProductTypeKey =
  | 'plc'
  | 'hmi'
  | 'vfd'
  | 'servo'
  | 'relay'
  | 'circuit-breaker'
  | 'sensor'
  | 'power-supply'
  | 'controller'
  | 'module'
  | 'transmitter'
  | 'encoder'
  | 'analyzer'
  | 'drive'
  | 'industrial-part';

function detectProductType(
  name: string,
  category: string,
): ProductTypeKey {
  const text = `${name} ${category}`.toLowerCase();

  if (
    /\bplc\b|programmable logic controller/.test(text)
  ) {
    return 'plc';
  }

  if (
    /\bhmi\b|human machine interface|touch screen|touchscreen|operator panel/.test(
      text,
    )
  ) {
    return 'hmi';
  }

  if (
    /\bvfd\b|variable frequency drive|frequency inverter|inverter drive/.test(
      text,
    )
  ) {
    return 'vfd';
  }

  if (
    /servo motor|servo drive|servo amplifier|servomotor/.test(
      text,
    )
  ) {
    return 'servo';
  }

  if (
    /\brelay\b|protective relay|auxiliary relay|solid state relay/.test(
      text,
    )
  ) {
    return 'relay';
  }

  if (
    /circuit breaker|\bmccb\b|\bmcb\b|\bacb\b|breaker/.test(
      text,
    )
  ) {
    return 'circuit-breaker';
  }

  if (
    /\bsensor\b|proximity sensor|photoelectric|pressure sensor|temperature sensor|level sensor/.test(
      text,
    )
  ) {
    return 'sensor';
  }

  if (
    /power supply|power module|ac\/dc|dc\/dc/.test(
      text,
    )
  ) {
    return 'power-supply';
  }

  if (
    /\bcontroller\b|control unit|control board/.test(
      text,
    )
  ) {
    return 'controller';
  }

  if (
    /\bmodule\b|input module|output module|i\/o module|interface module/.test(
      text,
    )
  ) {
    return 'module';
  }

  if (
    /\btransmitter\b|signal transmitter|pressure transmitter|temperature transmitter/.test(
      text,
    )
  ) {
    return 'transmitter';
  }

  if (
    /\bencoder\b|rotary encoder|absolute encoder|incremental encoder/.test(
      text,
    )
  ) {
    return 'encoder';
  }

  if (
    /\banalyzer\b|analyser|gas analyzer|process analyzer/.test(
      text,
    )
  ) {
    return 'analyzer';
  }

  if (
    /\bdrive\b|motor drive|industrial drive/.test(
      text,
    )
  ) {
    return 'drive';
  }

  return 'industrial-part';
}
function getProductTypeContent(
  productType: ProductTypeKey,
): {
  label: string;
  applications: string;
  systems: string;
} {
  const content: Record<
    ProductTypeKey,
    {
      label: string;
      applications: string;
      systems: string;
    }
  > = {
    plc: {
      label: 'programmable logic controller',
      applications:
        'machine control, factory automation, production lines and process control',
      systems:
        'industrial PLC systems, control cabinets and automated machinery',
    },

    hmi: {
      label: 'human-machine interface',
      applications:
        'operator control, process visualization, machine monitoring and production supervision',
      systems:
        'industrial control panels, automated machines and process systems',
    },

    vfd: {
      label: 'variable frequency drive',
      applications:
        'motor speed control, energy management, pumps, fans and conveyor systems',
      systems:
        'industrial motor-control systems, HVAC equipment and automated machinery',
    },

    servo: {
      label: 'servo control component',
      applications:
        'precision motion control, robotics, CNC machines and automated production equipment',
      systems:
        'servo systems, positioning equipment and high-accuracy machinery',
    },

    relay: {
      label: 'industrial relay',
      applications:
        'electrical switching, protection, signal isolation and control-circuit operation',
      systems:
        'control panels, protection systems and industrial electrical equipment',
    },

    'circuit-breaker': {
      label: 'industrial circuit breaker',
      applications:
        'electrical protection, overload protection, short-circuit protection and power distribution',
      systems:
        'switchboards, distribution panels and industrial electrical installations',
    },

    sensor: {
      label: 'industrial sensor',
      applications:
        'machine detection, process monitoring, measurement and automated control',
      systems:
        'factory automation, production equipment and industrial instrumentation systems',
    },

    'power-supply': {
      label: 'industrial power supply',
      applications:
        'control-voltage supply, automation-panel power and electronic equipment operation',
      systems:
        'PLCs, HMIs, control cabinets and industrial electronic systems',
    },

    controller: {
      label: 'industrial controller',
      applications:
        'machine control, process regulation, automation and equipment management',
      systems:
        'industrial control systems, automated machinery and production equipment',
    },

    module: {
      label: 'industrial automation module',
      applications:
        'signal processing, input/output control, machine communication and system expansion',
      systems:
        'PLC racks, control systems, industrial networks and automated machinery',
    },

    transmitter: {
      label: 'industrial transmitter',
      applications:
        'process measurement, signal transmission, monitoring and instrumentation',
      systems:
        'process-control systems, industrial instrumentation and monitoring equipment',
    },

    encoder: {
      label: 'industrial encoder',
      applications:
        'position feedback, speed measurement, motion control and machine synchronization',
      systems:
        'servo systems, motors, CNC equipment and automated machinery',
    },

    analyzer: {
      label: 'industrial analyzer',
      applications:
        'process analysis, quality monitoring, measurement and industrial diagnostics',
      systems:
        'process plants, laboratory systems and industrial monitoring equipment',
    },

    drive: {
      label: 'industrial drive',
      applications:
        'motor control, machine operation, speed regulation and automated equipment control',
      systems:
        'industrial machinery, production lines and motor-control systems',
    },

    'industrial-part': {
      label: 'industrial automation spare part',
      applications:
        'maintenance, repair, replacement, equipment servicing and MRO inventory',
      systems:
        'industrial automation, electrical control and production equipment',
    },
  };

  return content[productType];
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
const applicationsSection =
  `Common applications include ${productTypeContent.applications}.`;

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
