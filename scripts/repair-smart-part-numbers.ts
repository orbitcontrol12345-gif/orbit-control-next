import { supabaseAdmin } from '../lib/supabase-admin';

const BATCH_SIZE = 100;

const BAD_UNITS =
  /\b\d+(?:\.\d+)?\s?(VAC|VDC|VAC\/DC|AC|DC|V|HZ|KHZ|MHZ|VA|KVA|W|KW|A|MA|AMP|AMPS|BAR|PSI|MM|CM|M|KG|G|RPM|HP|PH)\b/i;

const REMOVE_WORDS =
  /\b(NEW|USED|OPEN|BOX|WITHOUT|WITH|W\/|FILTHY|DAMAGED|BROKEN|TESTED|TRIED|ONLY|CASE|COVER|BATTERY|SCREEN|KEYPAD|SERIES|TYPE|MODEL|MODULE|CONTROLLER|BOARD|RELAY|METER|POWER|SUPPLY|DETECTOR|APPLIANCE|SYSTEM|PANEL|SWITCH|CARD|UNIT|INPUT|OUTPUT|CIRCUIT|PCB|PRINTED|ELECTRIC|ELECTRONICS|AUTOMATION|INDUSTRIAL)\b/gi;

function cleanText(value: string) {
  return String(value || '')
    .toUpperCase()
    .replace(/[()[\]{},;:"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function scoreCandidate(value: string) {
  if (!value) return -999;
  if (value.length < 3 || value.length > 35) return -999;
  if (BAD_UNITS.test(value)) return -999;
  if (/^\d{1,2}$/.test(value)) return -999;

  let score = 0;

  if (/[A-Z]/.test(value)) score += 10;
  if (/\d/.test(value)) score += 10;
  if (/[-/.]/.test(value)) score += 8;
  if (/^[A-Z]{1,8}\d/.test(value)) score += 12;
  if (/^\d{3,14}[A-Z]?$/.test(value)) score += 7;
  if (/^\d{2,4}[A-Z]{2,5}\d{2,4}/.test(value)) score += 16;
  if (value.length >= 5 && value.length <= 22) score += 5;

  if (/^(100|110|120|220|230|240|250|380|400|415|480|500|600)$/.test(value)) score -= 50;

  return score;
}

function extractSmartPartNumber(title: string): string {
  const original = cleanText(title);
  const cleaned = cleanText(original.replace(REMOVE_WORDS, ' '));

  const joinedIndustrial = original
    .replace(/\b(140)\s+(CPU|DDI|DAI|DRA|CRA|CPS|ACI|ACO|CHS)\s+(\d{2,4})\s+(\d{2,4})\b/g, '$1$2$3$4')
    .replace(/\b(H46C)\s+(\d{3,5})\b/g, '$1$2')
    .replace(/\b(DSE)\s+(\d{3,5})\b/g, '$1$2')
    .replace(/\b(TAC)\s+(XENTA)\s+(\d{3,5}[A-Z]?)\b/g, '$1$2$3')
    .replace(/\b(PNOZ)\s+(S\d{1,4})\s+(\d{4,8})?\b/g, (_m, a, b, c) => `${a}${b}${c || ''}`);

  const searchText = `${joinedIndustrial} ${cleaned}`;

  const patterns = [
    /\b140(?:CPU|DDI|DAI|DRA|CRA|CPS|ACI|ACO|CHS)\d{4,8}\b/g,
    /\b[A-Z]{2,8}\d{2,10}[A-Z]?\b/g,
    /\b\d{6,14}[A-Z]?\b/g,
    /\b[A-Z0-9]+[-/][A-Z0-9][A-Z0-9-/]{2,35}\b/g,
    /\b[A-Z]{2,8}\s+\d{3,8}[A-Z]?\b/g,
  ];

  const candidates: string[] = [];

  for (const pattern of patterns) {
    const found = searchText.match(pattern) || [];
    candidates.push(...found);
  }

  const normalized = candidates
    .map((x) => x.replace(/\s+/g, '').replace(/[^A-Z0-9\-/.]/g, ''))
    .filter(Boolean);

  const ranked = normalized
    .map((value) => ({ value, score: scoreCandidate(value) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  return ranked[0]?.value || '';
}

function needsRepair(product: any) {
  const part = String(product.part_number || '').trim();
  const name = String(product.name || '').trim();

  return (
    !part ||
    part.length > 40 ||
    part.toUpperCase() === name.toUpperCase()
  );
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

      const newPart = extractSmartPartNumber(source);
      const oldPart = String(product.part_number || '').trim();

      if (!newPart || newPart.toUpperCase() === oldPart.toUpperCase()) {
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
