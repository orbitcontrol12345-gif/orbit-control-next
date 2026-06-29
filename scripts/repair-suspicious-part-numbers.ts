import { supabaseAdmin } from '../lib/supabase-admin';
import { extractIndustrialPartNumber } from '../lib/industrial-part-number';

const BATCH_SIZE = 100;

const SUSPICIOUS_WORDS =
  /\b(BOARD|DISPLAY|CONTROLLER|MODULE|PANEL|SYSTEM|UNIT|DEVICE|SUPPLY|DETECTOR|METER|RELAY|SWITCH|CARD|CIRCUIT|PCB|TESTER|SENSOR|ASSEMBLY)\b/i;

function isSuspicious(product: any) {
  const part = String(product.part_number || '').trim();
  const name = String(product.name || '').trim();

  if (!part) return true;
  if (part.length > 40) return true;
  if (part.toUpperCase() === name.toUpperCase()) return true;

  const wordCount = part.split(/\s+/).filter(Boolean).length;

  if (wordCount >= 4 && SUSPICIOUS_WORDS.test(part)) return true;
  if (wordCount >= 5) return true;

  return false;
}

function isSafeReplacement(value: string) {
  const part = String(value || '').trim();

  if (!part) return false;
  if (part.length < 3 || part.length > 40) return false;
  if (!/\d/.test(part)) return false;
  if (/^\d{1,2}$/.test(part)) return false;
  if (/\b(220V|230V|240V|400V|415V|480V|24VDC|230VAC|50HZ|60HZ|VA|KVA|AMP|AMPS|BAR|PSI|KG|MM|CM)\b/i.test(part)) return false;

  return true;
}

async function main() {
  let from = 0;
  let scanned = 0;
  let suspicious = 0;
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

      if (!isSuspicious(product)) {
        skipped++;
        continue;
      }

      suspicious++;

      const source =
        String(product.description || '').trim() ||
        String(product.name || '').trim();

      const newPart = extractIndustrialPartNumber(source);
      const oldPart = String(product.part_number || '').trim();

      if (!isSafeReplacement(newPart)) {
        skipped++;
        continue;
      }

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

  console.log('======================');
  console.log('Finished');
  console.log({ scanned, suspicious, repaired, skipped });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
