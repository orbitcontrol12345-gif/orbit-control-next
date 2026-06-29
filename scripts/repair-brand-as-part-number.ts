import { supabaseAdmin } from '../lib/supabase-admin';
import { extractIndustrialPartNumber } from '../lib/industrial-part-number';

const BRAND_VALUES = new Set([
  'ABB',
  'SIEMENS',
  'SCHNEIDER',
  'HONEYWELL',
  'PHOENIX',
  'YOKOGAWA',
  'OMRON',
  'MITSUBISHI',
  'EATON',
  'REXROTH',
  'BOSCH',
  'GE',
  'PILZ',
  'SICK',
  'FLUKE',
  'CROWCON',
  'ELCOMETER',
  'DUCATI',
  'ADALET',
  'ROHDE',
  'SCHWARZ',
  'MATSUSHITA',
  'REYROLLE',
  'NEWCO',
  'MORS',
  'SMITT',
  'ACTIVE',
  'DIAMOND',
  'NEOTRONICS',
]);

function isBadCurrentPart(value: string) {
  return BRAND_VALUES.has(String(value || '').trim().toUpperCase());
}

async function main() {
  const { data: products, error } = await supabaseAdmin
    .from('products')
    .select('id,name,description,part_number,model_number,brand');

  if (error) throw error;

  let scanned = 0;
  let repaired = 0;
  let skipped = 0;

  for (const product of products || []) {
    scanned++;

    const current = String(product.part_number || '').trim();

    if (!isBadCurrentPart(current)) {
      skipped++;
      continue;
    }

    const source =
      String(product.description || '').trim() ||
      String(product.name || '').trim();

    const newPart = extractIndustrialPartNumber(source);

    if (!newPart || isBadCurrentPart(newPart)) {
      skipped++;
      continue;
    }

    const { error: updateError } = await supabaseAdmin
      .from('products')
      .update({
        part_number: newPart,
        model_number: newPart,
        updated_at: new Date().toISOString(),
      })
      .eq('id', product.id);

    if (updateError) {
      console.error(`FAILED ${product.id}: ${updateError.message}`);
      skipped++;
      continue;
    }

    repaired++;
    console.log(`✔ ${product.id}: ${current} => ${newPart}`);
  }

  console.log('Finished');
  console.log({ scanned, repaired, skipped });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
