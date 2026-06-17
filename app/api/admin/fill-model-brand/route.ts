import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

const KNOWN_BRANDS = [
  'ABB',
  'SIEMENS',
  'SCHNEIDER',
  'SCHNEIDER ELECTRIC',
  'ALLEN BRADLEY',
  'ALLEN-BRADLEY',
  'HONEYWELL',
  'OMRON',
  'YOKOGAWA',
  'MITSUBISHI',
  'MITSUBISHI ELECTRIC',
  'PHOENIX CONTACT',
  'PHOENIX',
  'BOSCH',
  'BENTLY',
  'GE',
  'GENERAL ELECTRIC',
  'REXROTH',
  'FANUC',
  'EMERSON',
  'FOXBORO',
  'DET TRONICS',
  'DET-TRONICS',
  'ENDRESS',
  'PEPPERL',
  'WAGO',
  'SICK',
  'IFM',
  'KEYENCE',
  'LENZE',
  'SEW',
  'KUKA',
  'DANFOSS',
  'TRANE',
  'JOHNSON CONTROLS',
  'CAREL',
  'EUROTHERM',
  'BANNER',
   'HDL',
  'Zicon Controls',
  'MESSKO',
  'ZENNIO',
  'ZIEHL',
  'EN-TRONIC',
  'SAUTER',
  'CEAG',
  'EN-TRONIC',
  'TOSHIBA',
  'YORK',
  'IPG',
  'Weidmuller',
  'XYLEM',
  'BBC',
  'PRT',
  'CE',
  'LS',
  'TRAFO',
  'REXA',
  'HID',
  'PILZ',
  'HBM',
  'AOPEN',
  'CABUR',
    'DISTECH',
  'DISTECH CONTROLS',
  'WOODWARD',
  'WEATHERFORD',
  'MOORE',
  'MOORE INDUSTRIES',
  'STAEFA',
  'TELEVENT',
  'TDK-LAMBDA',
  'FUSION',
  'EFORE',
  'GANTER',
  'ELMEDENE',
  'EUCO',
  'EURAK',
  'RISH',
  'ESI',
  'SIMPLEX',
  'FISHER',
  'RAPID POWER',
  'CROWCON',
  'VIDEOJET',
  'CUTLER-HAMMER',
  'CONTEC',
  'DEIF',
  'OPTEX',
  'MERTEN',
  'EATON',
  'SELCO',
  'TECHNENERGIA',
  'POWERLOGIC',
  'JANITZA',
  'ALSTOM',
  'MARINE ELECTRO',
  'TAKETSUNA',
  'WEBB',
  'CEWE',
  'YASKAWA',
  'MICRONICS',
  'DMC',
  'JEOL',
  'OLDHAM',
  'MERTIK',
  'MERKLE',
  'GOSSEN',
  'EUCHNER',
  'BALLUFF',
  'PILZ',
  'TURCK',
  'PARKER',
  'PNEUMAX',
  'SMC',
  'FESTO',
  'WIKA',
  'BAUMER',
  'KROHNE',
  'IFM',
  'LEUZE',
  'PILOT',
  'TOSHIBA',
];

function extractBrand(title?: string | null) {
  if (!title) return null;

  const upper = title.toUpperCase();

  for (const brand of KNOWN_BRANDS) {
    if (upper.includes(brand)) {
      return brand;
    }
  }

  return null;
}

function extractModel(title?: string | null) {
  if (!title) return null;

  const matches = title
    .toUpperCase()
    .match(/\b[A-Z0-9][A-Z0-9\-/.]{4,}\b/g);

  if (!matches?.length) return null;

  const filtered = matches.filter((item) => {
    if (/^(NEW|USED|TESTED|MODULE|BOARD|UNIT|CARD)$/i.test(item))
      return false;

    if (/^\d+$/.test(item))
      return false;

    return true;
  });

  return filtered[0] || null;
}

export async function GET(request: Request) {
  const page = Number(
    new URL(request.url).searchParams.get('page') || '1'
  );

  const from = (page - 1) * 1000;
  const to = from + 999;

  const { data, error } = await supabaseAdmin
    .from('products')
    .select('id,name,brand,model_number,part_number')
    .order('id', { ascending: true })
    .range(from, to);

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  const results = [];

  for (const product of data || []) {
    const currentBrand =
  product.brand &&
  product.brand !== 'Unknown' &&
  product.brand !== 'Unbranded'
    ? product.brand
    : extractBrand(product.name);

    const currentModel =
      product.model_number ||
      product.part_number ||
      extractModel(product.name);

    const { error: updateError } = await supabaseAdmin
      .from('products')
      .update({
        brand: currentBrand,
        model_number: currentModel,
      })
      .eq('id', product.id);

    results.push({
      id: product.id,
      status: updateError ? 'failed' : 'updated',
      brand: currentBrand,
      model: currentModel,
    });
  }

  return NextResponse.json({
    page,
    from,
    to,
    processed: results.length,
    results,
  });
}
