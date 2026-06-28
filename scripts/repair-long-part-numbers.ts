import { supabaseAdmin } from '../lib/supabase-admin';
import { extractPartNumber } from '../lib/part-number';

const BATCH_SIZE = 100;

function pickFirstCleanPart(value: string): string {
  const text = String(value || '').trim();

  const parts = text
    .split(/\s+\/\s+|,|\s+and\s+|\s+with\s+/i)
    .map((x) => x.trim())
    .filter(Boolean);

  for (const part of parts) {
    const extracted = extractPartNumber(part);
    if (extracted && extracted.length <= 40) return extracted;

    if (
      part.length >= 3 &&
      part.length <= 40 &&
      /\d/.test(part) &&
      !/\b(VAC|VDC|HZ|VA|KVA|AMP|AMPS|MM|CM|M|KG|BAR|PSI)\b/i.test(part)
    ) {
      return part;
    }
  }

  const extracted = extractPartNumber(text);
  return extracted && extracted.length <= 40 ? extracted : '';
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
      .or('part_number.is.null,part_number.eq.,part_number.gt.________________________________________')
      .order('id')
      .range(from, from + BATCH_SIZE - 1);

    if (error) throw error;
    if (!products?.length) break;

    for (const product of products) {
      scanned++;

      const current = String(product.part_number || '').trim();
      const name = String(product.name || '').trim();
      const description = String(product.description || '').trim();

      const source = current || description || name;
      const newPart = pickFirstCleanPart(source);

      if (!newPart) {
        skipped++;
        continue;
      }

      if (newPart.toUpperCase() === current.toUpperCase()) {
        skipped++;
        continue;
      }

      if (newPart.length > 40) {
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

    from += BATCH_SIZE;
  }

  console.log('======================');
  console.log('Finished');
  console.log({ scanned, repaired, skipped });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
