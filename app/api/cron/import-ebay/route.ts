import { NextResponse } from 'next/server';
import { getEbayToken } from '@/lib/ebay';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const INDUSTRIAL_BRANDS = [
  'SIEMENS',
  'ABB',
  'SCHNEIDER ELECTRIC',
  'SCHNEIDER',
  'ALLEN-BRADLEY',
  'ALLEN BRADLEY',
  'ROCKWELL',
  'OMRON',
  'HONEYWELL',
  'YOKOGAWA',
  'HIRSCHMANN',
  'ALSTOM',
  'KAHLER',
  'KAHLE',
  'TURCK',
  'PILZ',
  'BECKHOFF',
  'KEYENCE',
  'MITSUBISHI ELECTRIC',
  'MITSUBISHI',
  'PHOENIX CONTACT',
  'PHOENIX',
  'GE',
  'GENERAL ELECTRIC',
  'FANUC',
  'FOXBORO',
  'EMERSON',
  'DANFOSS',
  'PEPPERL FUCHS',
  'PEPPERL+FUCHS',
  'ENDRESS HAUSER',
  'ENDRESS',
  'BOSCH',
  'REXROTH',
  'BANNER',
  'SICK',
  'IFM',
  'FESTO',
  'EATON',
  'CUTLER HAMMER',
  'SQUARE D',
  'WAGO',
  'WEIDMULLER',
  'LENZE',
  'PROSOFT',
  'ADVANTECH',
  'RED LION',
  'BENTLY NEVADA',
  'TRICONEX',
  'WOODWARD',
  'MOXA',
  'HIMA',
  'PARKER',
  'BAILEY',
  'WESTINGHOUSE',
  'KOLLMORGEN',
  'TELEMECANIQUE',
];

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 180);
}

function detectBrand(title: string) {
  const upperTitle = title.toUpperCase();

  const found = INDUSTRIAL_BRANDS.find((brand) => upperTitle.includes(brand));

  if (!found) return 'UNKNOWN';

  if (found === 'ALLEN BRADLEY') return 'ALLEN-BRADLEY';
  if (found === 'SCHNEIDER') return 'SCHNEIDER ELECTRIC';
  if (found === 'PHOENIX') return 'PHOENIX CONTACT';
  if (found === 'GENERAL ELECTRIC') return 'GE';
  if (found === 'KAHLE') return 'KAHLER';

  return found;
}

function extractModelFromTitle(title: string) {
  const upper = title.toUpperCase();
  const brand = detectBrand(title);
if (brand !== 'UNKNOWN') {
  const afterBrand = upper.split(brand)[1]?.trim() || '';
  const directModel = afterBrand.match(/\b[A-Z0-9]{4,}(?:[-\/][A-Z0-9]+)*\b/);

  if (
    directModel &&
    !/^\d{10,}$/.test(directModel[0]) &&
    !/^\d+\/\d+/.test(directModel[0])
  ) {
    return directModel[0];
  }
}

  const patterns = [
    /\b[A-Z]{2,5}\d{2,5}\b/g,
    /\b\d[A-Z]{2}\d{4}-[A-Z0-9]{4,}-[A-Z0-9]{2,}\b/g,
    /\b\d[A-Z]{2}\d{4}-[A-Z0-9]+-[A-Z0-9]+-[A-Z0-9]+\b/g,
    /\b[A-Z]{2,}\d{3,}[A-Z0-9\-\/\.]*\b/g,
    /\b\d[A-Z]{1,3}\d{3,}[A-Z0-9\-\/\.]*\b/g,
    /\b[A-Z0-9]+(?:[-\/\.][A-Z0-9]+){1,}\b/g,
  ];

  const badWords = [
    'SIEMENS',
    'SIMATIC',
    'SITOP',
    'SIRIUS',
    'SINAMICS',
    'POWER',
    'SUPPLY',
    'MODULE',
    'INTERFACE',
    'RELAY',
    'SWITCH',
    'INDUSTRIAL',
    'AUTOMATION',
    'NEW',
    'USED',
    'OPEN',
    'BOX',
    'EMPTY',
    'REV',
    'REV.',
    'LOT',
     ];

  const allMatches = patterns.flatMap((pattern) => upper.match(pattern) || []);

  const filtered = allMatches
    .map((m) => m.trim())
    .filter((m) => m.length >= 4)
    .filter((m) => !/^\d{10,}$/.test(m))
    .filter((m) => !/^\d{1,3}\/\d{1,3}$/.test(m))
    .filter((m) => !/^\d+\/\d+$/.test(m))
    .filter((m) => !['90/80', '110/120', '220/240', '24/48'].includes(m))
    .filter((m) => !badWords.includes(m))
    .filter((m) => !INDUSTRIAL_BRANDS.includes(m));

  const preferred = filtered.find(
  (m) => m.includes('-') || m.includes('/')
);

return preferred || filtered[0] || 'UNKNOWN';
}

function cleanTitle(title: string) {
  return title
    .replace(/\bNEW OPEN BOX\b/gi, '')
    .replace(/\bOPEN BOX\b/gi, '')
    .replace(/\bNEW\b/gi, '')
    .replace(/\bUSED\b/gi, '')
    .replace(/\bFOR PARTS\b/gi, '')
    .replace(/\bPARTS ONLY\b/gi, '')
    .replace(/\bNOT WORKING\b/gi, '')
    .replace(/\bPARTS OR NOT WORKING\b/gi, '')
    .replace(/\bW\/O BOX\b/gi, '')
    .replace(/\bWITHOUT BOX\b/gi, '')
    .replace(/\bNO BOX\b/gi, '')
    .replace(/\bFILTHY BOX\b/gi, '')
    .replace(/\bWITH FILTHY BOX\b/gi, '')
    .replace(/\bDAMAGED BOX\b/gi, '')
    .replace(/\bOLD BOX\b/gi, '')
    .replace(/\bWITH OLD BOX\b/gi, '')
    .replace(/\bNC\/NO\b/gi, '')
    .replace(/\bWITH SOCKET\b/gi, '')
    .replace(/\bW\/\b/gi, '')
    .replace(/\s+/g, ' ')
    .replace(/\bLOT\s*\d+\s*PCS?\.?\b/gi, '')
    .replace(/\b\d+\s*PCS?\.?\b/gi, '')
    .replace(/\bLOT OF \d+\b/gi, '')
    .replace(/\bLOT\b/gi, '')
    .trim();
}
async function getEbayItemDetails(itemId: string, accessToken: string) {
  const res = await fetch(
    `https://api.ebay.com/buy/browse/v1/item/${encodeURIComponent(itemId)}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
      },
    }
  );

  if (!res.ok) return null;
  return res.json();
}

function getAspect(itemDetails: any, names: string[]) {
  const aspects = itemDetails?.localizedAspects || [];

  for (const name of names) {
    const found = aspects.find(
      (a: any) => String(a.name).toLowerCase() === name.toLowerCase()
    );

    if (found?.value) return String(found.value).trim();
  }

  return '';
}
export async function GET() {
  const stateId = 'ebay_import';
  const limit = 200;

  const { data: state } = await supabaseAdmin
    .from('import_state')
    .select('last_offset')
    .eq('id', stateId)
    .maybeSingle();

  const offset = state?.last_offset || 0;

  const token = await getEbayToken();
  const accessToken = String(token.access_token).trim();

  const params = new URLSearchParams({
    q: 'PLC',
    limit: String(limit),
    offset: String(offset),
    filter: 'sellers:{orbitcontrol}',
  });

  const response = await fetch(
    `https://api.ebay.com/buy/browse/v1/item_summary/search?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
      },
    }
  );

  const ebayData = await response.json();
  const items = ebayData.itemSummaries || [];

  const products = await Promise.all(items.map(async (item: any) => {
    const title = item.title || '';
    const ebayItemId = item.legacyItemId || item.itemId || '';
    const itemDetails = await getEbayItemDetails(item.itemId, accessToken);

const ebayBrand =
  getAspect(itemDetails, ['Brand', 'Manufacturer']) || detectBrand(title);

const modelFromEbay = getAspect(itemDetails, [
  'MPN',
  'Manufacturer Part Number',
  'Catalog Number',
  'Model Number',
  'Model',
]);

const modelFromTitle = extractModelFromTitle(title);

const badModel =
  !modelFromEbay ||
  /^\d+\/\d+/i.test(modelFromEbay) ||
  /MA$/i.test(modelFromEbay) ||
  modelFromEbay.toUpperCase() === 'UNKNOWN';

const ebayModel = badModel ? modelFromTitle : modelFromEbay;
    const brand = ebayBrand || 'UNKNOWN';
    return {
      ebay_item_id: ebayItemId,
      sku: ebayItemId,
      model_number: ebayModel || 'UNKNOWN',
      part_number: ebayModel || 'UNKNOWN',
      brand,
      category: item.categories?.[0]?.categoryName || 'Industrial Automation',
      name: cleanTitle(title),
      condition: item.condition || 'Used',
      image_url: item.image?.imageUrl || '',
      description: title,
      slug: slugify(`${ebayItemId}-${title}`),
      marketplace: 'EBAY_US',
      seller: 'orbitcontrol',
      source: 'ebay',
      is_active: true,
      last_seen_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }));

  let inserted = 0;
  let supabaseError = null;

  if (products.length > 0) {
    const { data, error } = await supabaseAdmin
      .from('products')
      .upsert(products, { onConflict: 'sku' })
      .select();

    if (error) supabaseError = error;
    else inserted = data?.length || 0;
  }

  const nextOffset = items.length < limit ? 0 : offset + limit;

  await supabaseAdmin.from('import_state').upsert({
    id: stateId,
    last_offset: nextOffset,
    last_run_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  return NextResponse.json({
    success: !supabaseError,
    query: 'PLC',
    offset,
    nextOffset,
    fetched: items.length,
    inserted,
    supabaseError,
  });
}
