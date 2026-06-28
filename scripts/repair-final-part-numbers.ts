import { supabaseAdmin } from '../lib/supabase-admin';

const BATCH_SIZE = 100;

const STOP_WORDS = /\b(NEW|USED|OPEN|BOX|WITHOUT|WITH|FILTHY|DAMAGED|BROKEN|TESTED|TRIED|CONTROLLER|MODULE|BOARD|RELAY|METER|POWER|SUPPLY|DETECTOR|APPLIANCE|SYSTEM|PANEL|SWITCH|CARD|UNIT|ONLY|CASE|COVER|BATTERY|SCREEN|KEYPAD|SERIES|TYPE|MODEL)\b/gi;

function normalizeCandidate(value: string) {
  return value
    .replace(STOP_WORDS, ' ')
    .replace(/\b\d+(VAC|VDC|VAC\/DC|V|HZ|VA|KVA|A|AMP|AMPS|W|KW|MM|CM|M|KG|BAR|PSI)\b/gi, ' ')
    .replace(/[()[\]{},]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractFinalPartNumber(title: string): string {
  const text = normalizeCandidate(String(title || '').toUpperCase());
  if (!text) return '';

  const patterns = [
    /\b\d{2,4}\s?(CPU|DDI|DAI|DRA|CRA|CPS|ACI|ACO|CHS)\s?\d{2,4}\s?\d{0,4}\b/g,
    /\b[A-Z]{1,8}\s?\d{2,8}[A-Z]?\b/g,
    /\b\d{6,14}[A-Z]?\b/g,
    /\b[A-Z0-9]+[-/][A-Z0-9][A-Z0-9-/]{2,35}\b/g,
  ];

  const candidates: string[] = [];

  for (const pattern of patterns) {
    candidates.push(...(text.match(pattern) || []));
  }

  const cleaned = candidates
    .map((x) => x.replace(/\s+/g, ''))
    .map((x) => x.replace(/[^A-Z0-9\-/.]/g, ''))
    .filter((x) => x.length >= 3 && x.length <= 35)
    .filter((x) => !/^\d{1,3}$/.test(x))
    .filter((x) => !/\b(VAC|VDC|HZ|VA|KVA|AMP|AMPS|MM|CM|KG|BAR|PSI)\b/i.test(x));

  return cleaned[0] || '';
}

function needsRepair(product: any) {
  const part = String(product.part_number || '').trim();
  const name = String(product.name || '').trim();

  if (!part) return true;
  if (part.length > 40) return true;
  if (part.toUpperCase() === name.toUpperCase()) return true;

  return false;
}

async function main() {
  let from = 0;
  let scanned = 0;
  let repaired = 0;
  let skipped = 0;

  while (true) {
    const { data: products, error } = await supabaseAdmin
      .from('products')
      .select('id,name,description,part_number,model_number')
      .order('id')
      .range(from, from + BATCH_SIZE - 1);

    if (error) throw error;
    if (!products?.length) break;

    for (const product of products) {
      scanned++;

      if (!needsRepair(product)) {
        skipped++;
        continue;
      }

      const source =
        String(product.description || '').trim() ||
        String(product.name || '').trim();

      const newPart = extractFinalPartNumber(source);

      if (!newPart) {
        skipped++;
        continue;
      }

      const oldPart = String(product.part_number || '').trim();

      if (newPart.toUpperCase() === oldPart.toUpperCase()) {
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
      console.log(`✔ ${product.id}: ${oldPart} => ${newPart}`);
    }

    from += BATCH_SIZE;
  }

  console.log('Finished');
  console.log({ scanned, repaired, skipped });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
