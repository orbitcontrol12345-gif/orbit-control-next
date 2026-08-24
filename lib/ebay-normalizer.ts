export type EbayFeedRow = {
  ebay_item_id: string;
  sku?: string | null;
  price?: number | null;
  currency?: string | null;
  quantity?: number | null;
};

export type NormalizedEbayProduct = {
  ebay_item_id: string;
  sku: string;
  part_number: string;
  model_number: string;
  brand: string;
  category: string;
  name: string;
  condition: string;
  image_url: string | null;
  ebay_image_url: string | null;
  ebay_gallery_urls: string[];
  description: string;
  slug: string;
  marketplace: 'EBAY_US';
  seller: string;
  source: string;
  source_type: 'ebay';
  quantity: number;
  price: number | null;
  currency: string;
  is_active: true;
  catalog_visible: true;
  last_seen_at: string;
  updated_at: string;
};

const BRAND_ALIASES: Array<[RegExp, string]> = [
  [/^ABB$/i, 'ABB'],
  [/^ALLEN[\s-]?BRADLEY$/i, 'Allen-Bradley'],
  [/^ROCKWELL(?: AUTOMATION)?$/i, 'Rockwell Automation'],
  [/^SIEMENS$/i, 'Siemens'],
  [/^PHOENIX CONTACT$/i, 'Phoenix Contact'],
  [/^LUTRON$/i, 'Lutron'],
  [/^IDEC(?: IZUMI)?$/i, 'IDEC'],
  [/^DELL$/i, 'Dell'],
  [/^SMITT(?: RELAYS)?$/i, 'SMITT Relays'],
  [/^CONCURRENT TECHNOLOGIES$/i, 'Concurrent Technologies'],
  [/^SCHNEIDER(?: ELECTRIC)?$/i, 'Schneider Electric'],
  [/^SQUARE D$/i, 'Square D'],
  [/^HONEYWELL$/i, 'Honeywell'],
  [/^OMRON$/i, 'Omron'],
  [/^YOKOGAWA$/i, 'Yokogawa'],
  [/^MITSUBISHI(?: ELECTRIC)?$/i, 'Mitsubishi Electric'],
  [/^FUJI(?: ELECTRIC)?$/i, 'Fuji Electric'],
  [/^KEYENCE$/i, 'Keyence'],
  [/^WAGO$/i, 'WAGO'],
  [/^WEIDMULLER$/i, 'Weidmüller'],
  [/^WEIDMÜLLER$/i, 'Weidmüller'],
  [/^SEW[\s-]?EURODRIVE$/i, 'SEW-Eurodrive'],
  [/^DANFOSS$/i, 'Danfoss'],
  [/^EATON$/i, 'Eaton'],
  [/^MOELLER$/i, 'Moeller'],
  [/^GE(?: FANUC)?$/i, 'GE Fanuc'],
  [/^GENERAL ELECTRIC$/i, 'General Electric'],
  [/^B&R$/i, 'B&R'],
  [/^BECKHOFF$/i, 'Beckhoff'],
  [/^FESTO$/i, 'Festo'],
  [/^SMC$/i, 'SMC'],
  [/^PARKER$/i, 'Parker'],
  [/^BOSCH REXROTH$/i, 'Bosch Rexroth'],
  [/^REXROTH$/i, 'Rexroth'],
  [/^EMERSON$/i, 'Emerson'],
  [/^FISHER$/i, 'Fisher'],
  [/^ENDRESS[+&\s-]*HAUSER$/i, 'Endress+Hauser'],
  [/^WIKA$/i, 'WIKA'],
  [/^MITUTOYO$/i, 'Mitutoyo'],
];

const TITLE_BRANDS: Array<[RegExp, string]> = [
  [/^ABB\b/i, 'ABB'],
  [/^ALLEN[\s-]?BRADLEY\b/i, 'Allen-Bradley'],
  [/^SIEMENS\b/i, 'Siemens'],
  [/^PHOENIX CONTACT\b/i, 'Phoenix Contact'],
  [/^LUTRON\b/i, 'Lutron'],
  [/^IDEC(?: IZUMI)?\b/i, 'IDEC'],
  [/^DELL\b/i, 'Dell'],
  [/^SMITT(?: RELAYS)?\b/i, 'SMITT Relays'],
  [/^CONCURRENT TECHNOLOGIES\b/i, 'Concurrent Technologies'],
  [/^SCHNEIDER(?: ELECTRIC)?\b/i, 'Schneider Electric'],
  [/^HONEYWELL\b/i, 'Honeywell'],
  [/^OMRON\b/i, 'Omron'],
  [/^YOKOGAWA\b/i, 'Yokogawa'],
  [/^MITSUBISHI(?: ELECTRIC)?\b/i, 'Mitsubishi Electric'],
  [/^FUJI(?: ELECTRIC)?\b/i, 'Fuji Electric'],
  [/^KEYENCE\b/i, 'Keyence'],
  [/^WAGO\b/i, 'WAGO'],
  [/^WEIDM[ÜU]LLER\b/i, 'Weidmüller'],
  [/^DANFOSS\b/i, 'Danfoss'],
  [/^EATON\b/i, 'Eaton'],
  [/^BECKHOFF\b/i, 'Beckhoff'],
  [/^FESTO\b/i, 'Festo'],
  [/^SMC\b/i, 'SMC'],
  [/^PARKER\b/i, 'Parker'],
  [/^BOSCH REXROTH\b/i, 'Bosch Rexroth'],
  [/^ENDRESS[+&\s-]*HAUSER\b/i, 'Endress+Hauser'],
  [/^WIKA\b/i, 'WIKA'],
  [/^MITUTOYO\b/i, 'Mitutoyo'],
];

export function slugify(text: string) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 180);
}

export function cleanTitle(title: string) {
  return String(title || '')
    .replace(/^\s*PCS\s+(?=(?:PHOENIX CONTACT|SIEMENS|ABB|ALLEN[\s-]?BRADLEY|SCHNEIDER|LUTRON|IDEC|OMRON|HONEYWELL|YOKOGAWA|MITSUBISHI|FUJI|KEYENCE|WAGO|WEIDM[ÜU]LLER|DANFOSS|EATON|DELL|SMITT|CONCURRENT TECHNOLOGIES)\b)/i, '')
    .replace(/\bNEW\s+WITHOUT\s+(?:THE\s+)?BOX\b/gi, ' ')
    .replace(/\bNEW\s+WITH\s+(?:THE\s+)?OLD\s+BOX\b/gi, ' ')
    .replace(/\bWITH\s+(?:THE\s+)?OLD\s+BOX\b/gi, ' ')
    .replace(/\bWITHOUT\s+(?:THE\s+)?BOX\b/gi, ' ')
    .replace(/\bNO\s+BOX\b/gi, ' ')
    .replace(/\bW\/?O\s+BOX\b/gi, ' ')
    .replace(/\bOPEN\s+BOX\b/gi, ' ')
    .replace(/\bOLD\s+STOCK\b/gi, ' ')
    .replace(/\bWITHOUT\s+(?:ANY\s+)?ACCESSORIES\b/gi, ' ')
    .replace(/\bW\/?O\s+ACCESSORIES\b/gi, ' ')
    .replace(/\bFOR\s+PARTS(?:\s+OR\s+NOT\s+WORKING)?\b/gi, ' ')
    .replace(/\bNOT\s+WORKING\b/gi, ' ')
    .replace(/\bTESTED\s*(?:&|AND)\s*WORKING\b/gi, ' ')
    .replace(/\bTESTED\s+OK\b/gi, ' ')
    .replace(/\bREFURBISHED\b/gi, ' ')
    .replace(/\bLOT\s+OF\s+\d+\b/gi, ' ')
    .replace(/\bLOT\s*(?:-|:|#)?\s*\d+\b/gi, ' ')
    .replace(/\b\d+\s*(?:PCS?|PIECES?|UNITS?)\b/gi, ' ')
    .replace(/\bNEW\b/gi, ' ')
    .replace(/\bUSED\b/gi, ' ')
    .replace(/\(\s*\)/g, ' ')
    .replace(/\[\s*\]/g, ' ')
    .replace(/\{\s*\}/g, ' ')
    .replace(/^[\s\-|,:;]+/g, '')
    .replace(/[\s\-|,:;]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function cleanCondition(condition: string) {
  const normalized = String(condition || '').toLowerCase();
  if (normalized.includes('refurb')) return 'Refurbished';
  if (normalized.includes('open box')) return 'New – Open box';
  if (normalized.includes('new')) return 'New';
  if (normalized.includes('parts') || normalized.includes('not working')) return 'For parts';
  if (normalized.includes('used')) return 'Used';
  return condition || 'Used';
}

export function getRealItemId(itemId: string | null | undefined) {
  const value = String(itemId || '').trim();
  if (!value) return '';
  const parts = value.split('|');
  return parts.length >= 2 && parts[1] ? parts[1] : value;
}

export function normalizeOfficialValue(value: unknown) {
  return String(value || '').trim();
}

export function isUsableOfficialValue(value: unknown) {
  const normalized = normalizeOfficialValue(value);
  if (!normalized) return false;
  return !/^(DOES NOT APPLY|NOT APPLICABLE|N\/?A|NA|NONE|UNKNOWN|UNBRANDED)$/i.test(normalized);
}

export function getAspectValue(item: any, names: string[]) {
  const aspects = Array.isArray(item?.localizedAspects) ? item.localizedAspects : [];
  const acceptedNames = new Set(names.map((name) => name.trim().toLowerCase()));
  const aspect = aspects.find((entry: any) =>
    acceptedNames.has(String(entry?.name || '').trim().toLowerCase())
  );
  const value = normalizeOfficialValue(aspect?.value);
  return isUsableOfficialValue(value) ? value : '';
}

export function normalizeBrand(value: unknown, title = '') {
  const raw = normalizeOfficialValue(value).replace(/\s+/g, ' ');
  if (isUsableOfficialValue(raw)) {
    for (const [pattern, official] of BRAND_ALIASES) {
      if (pattern.test(raw)) return official;
    }
    return raw;
  }

  const cleanedTitle = cleanTitle(title);
  for (const [pattern, official] of TITLE_BRANDS) {
    if (pattern.test(cleanedTitle)) return official;
  }
  return 'UNKNOWN';
}

export function getOfficialBrand(item: any, title = '') {
  const itemBrand = normalizeOfficialValue(item?.brand);
  const aspectBrand = getAspectValue(item, ['brand']);
  return normalizeBrand(isUsableOfficialValue(itemBrand) ? itemBrand : aspectBrand, title);
}

export function getOfficialPartNumber(item: any) {
  return getAspectValue(item, ['mpn', 'manufacturer part number']) || 'UNKNOWN';
}

export function getOfficialModelNumber(item: any) {
  return getAspectValue(item, ['model', 'model number']) || 'UNKNOWN';
}

export function getOfficialGalleryUrls(item: any) {
  const urls = new Set<string>();
  const primary = normalizeOfficialValue(item?.image?.imageUrl);
  if (primary) urls.add(primary);
  for (const image of Array.isArray(item?.additionalImages) ? item.additionalImages : []) {
    const url = normalizeOfficialValue(image?.imageUrl);
    if (url) urls.add(url);
  }
  for (const image of Array.isArray(item?.thumbnailImages) ? item.thumbnailImages : []) {
    const url = normalizeOfficialValue(image?.imageUrl);
    if (url) urls.add(url);
  }
  return Array.from(urls);
}

export function normalizeEbayItem(
  item: any,
  feedRow: EbayFeedRow,
  now: string,
  options: { source: string; seller?: string } = { source: 'ebay-full-sync' }
): NormalizedEbayProduct | null {
  const realItemId = getRealItemId(item?.itemId) || String(feedRow.ebay_item_id || '').trim();
  const rawTitle = normalizeOfficialValue(item?.title);
  if (!realItemId || !rawTitle) return null;

  const cleanedName = cleanTitle(rawTitle) || rawTitle;
  const galleryUrls = getOfficialGalleryUrls(item);
  const imageUrl = galleryUrls[0] || null;
  let partNumber = getOfficialPartNumber(item);
  let modelNumber = getOfficialModelNumber(item);

  if (partNumber === 'UNKNOWN' && modelNumber !== 'UNKNOWN') partNumber = modelNumber;
  if (modelNumber === 'UNKNOWN' && partNumber !== 'UNKNOWN') modelNumber = partNumber;

  const quantity = Number(feedRow.quantity ?? 0);
  const price = feedRow.price == null ? null : Number(feedRow.price);

  return {
    ebay_item_id: realItemId,
    sku: String(feedRow.sku || realItemId),
    part_number: partNumber,
    model_number: modelNumber,
    brand: getOfficialBrand(item, rawTitle),
    category: normalizeOfficialValue(item?.categoryPath) || 'Industrial Automation',
    name: cleanedName,
    condition: cleanCondition(normalizeOfficialValue(item?.condition) || 'Used'),
    image_url: imageUrl,
    ebay_image_url: imageUrl,
    ebay_gallery_urls: galleryUrls,
    description: rawTitle,
    slug: slugify(`${realItemId}-${cleanedName}`),
    marketplace: 'EBAY_US',
    seller: options.seller || 'orbitcontrol',
    source: options.source,
    source_type: 'ebay',
    quantity: Number.isFinite(quantity) ? quantity : 0,
    price: Number.isFinite(price as number) ? price : null,
    currency: String(feedRow.currency || 'USD'),
    is_active: true,
    catalog_visible: true,
    last_seen_at: now,
    updated_at: now,
  };
}
