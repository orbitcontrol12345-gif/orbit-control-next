export type ProductDataOverride = {
  partNumber?: string;
  modelNumber?: string;
  name?: string;
  category?: string;
};

/*
 * Site-only corrections for confirmed source-data conflicts.
 * Keep these keyed by the immutable eBay item ID so catalog syncs can
 * continue without changing the corresponding eBay listings.
 */
const PRODUCT_DATA_OVERRIDES: Record<
  string,
  ProductDataOverride
> = {
  '274481861257': {
    partNumber: 'ISC BS2MS20',
    modelNumber: 'ISC BS2MS20',
    name: 'REVERBERI ISC BS2MS20 INTELLIGENT LIGHTING SYSTEM',
    category: 'Intelligent Lighting Controls',
  },
  '278007814439': {
    partNumber: '140NOE77111',
    modelNumber: '140NOE77111',
    name: 'SCHNEIDER ELECTRIC 140NOE77111 MODICON QUANTUM ETHERNET MODULE',
    category: 'PLC Communication Modules',
  },
  '274542799146': {
    partNumber: '0056453',
    modelNumber: 'MK9163N 12/110',
    name: 'E.DOLD & SOHNE MK9163N 12/110 ATEX 0056453',
    category: 'Industrial Relays',
  },
  '274715964513': {
    partNumber: 'RXC31.1/00031',
    modelNumber: 'RXC31.1/00031',
    name: 'SIEMENS RXC31.1/00031 ROOM CONTROLLER 24V',
    category: 'Building Automation Controllers',
  },
  '275055440027': {
    partNumber: '36297901',
    modelNumber: 'IEC 60947-3',
    name: 'SOCOMEC 36297901 IEC 60947-3 FUSE ISOLATOR SWITCH',
    category: 'Fuse Isolator Switches',
  },
  '275291452945': {
    partNumber: 'SSA81',
    modelNumber: 'SSA81',
    name: 'SIEMENS ACVATIX SSA81 ELECTRICAL ACTUATOR 24V',
    category: 'Electric Actuators',
  },
  '275292586509': {
    partNumber: 'SSD81',
    modelNumber: 'SSD81',
    name: 'SIEMENS ACVATIX SSD81 ELECTRICAL ACTUATOR 24V',
    category: 'Electric Actuators',
  },
  '274761701806': {
    partNumber: '2LS3200DC',
    modelNumber: '2LS3200DC',
    name: 'ROSSMANITH ELOBID 2LS3200DC ELECTRONIC IDENTIFICATION SYSTEM',
    category: 'Industrial Identification Systems',
  },
  '274974949179': {
    partNumber: '09 16 61 0112 7',
    modelNumber: 'AVP/J',
    name: 'AUTRONIC MAN ROLAND AVP/J 09 16 61 0112 7 CONVERTER',
    category: 'Industrial Converters',
  },
  '275515595290': {
    partNumber: 'A03B-0819-C153',
    modelNumber: 'A03B-0819-C153',
    name: 'FANUC A03B-0819-C153 MODULE',
    category: 'PLC Modules',
  },
  '276355414023': {
    name: 'RIDGID MICRO CA-350 INSPECTION CAMERA - INCOMPLETE ACCESSORIES',
  },
  '276526716151': {
    name: 'KONE KM50006053H04 / KM50006052G01 LCEADOE ELEVATOR BOARD',
  },
  '276659489485': {
    name: 'BOURDON SEDEME MCX5 CAPSULE PRESSURE GAUGE 0-1600',
    category: 'Pressure Gauges',
  },
};

function getEbayItemId(value: unknown): string | null {
  const match = String(value || '').match(
    /(?:^|[^0-9])(\d{12})(?:[^0-9]|$)/,
  );

  return match?.[1] || null;
}

export function getProductDataOverride(
  product:
    | string
    | {
        ebay_item_id?: unknown;
        sku?: unknown;
        slug?: unknown;
      },
): ProductDataOverride | null {
  const candidates =
    typeof product === 'string'
      ? [product]
      : [
          product.ebay_item_id,
          product.slug,
          product.sku,
        ];

  for (const candidate of candidates) {
    const itemId = getEbayItemId(candidate);

    if (itemId && PRODUCT_DATA_OVERRIDES[itemId]) {
      return PRODUCT_DATA_OVERRIDES[itemId];
    }
  }

  return null;
}

function normalizeSearchValue(value: unknown): string {
  return String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '');
}

export function findProductOverrideItemIds(
  search: string,
): string[] {
  const normalizedSearch = normalizeSearchValue(search);

  if (normalizedSearch.length < 2) {
    return [];
  }

  return Object.entries(PRODUCT_DATA_OVERRIDES)
    .filter(([itemId, dataOverride]) =>
      [
        itemId,
        dataOverride.partNumber,
        dataOverride.modelNumber,
        dataOverride.name,
        dataOverride.category,
      ].some((value) =>
        normalizeSearchValue(value).includes(
          normalizedSearch,
        ),
      ),
    )
    .map(([itemId]) => itemId);
}
