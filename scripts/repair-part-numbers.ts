import { supabaseAdmin } from '../lib/supabase-admin';
import { extractPartNumber } from '../lib/part-number';

async function main() {
  console.log('Starting broken part number repair...');

  const { data: products, error } = await supabaseAdmin
    .from('products')
    .select('id, name, description, part_number, model_number')
    .eq('is_active', true);

  if (error) {
    throw new Error(error.message);
  }

  let scanned = 0;
  let broken = 0;
  let repaired = 0;
  let skipped = 0;

  for (const product of products || []) {
    scanned++;

    const name = String(product.name || '').trim();
    const currentPart = String(product.part_number || '').trim();

    const isBroken =
      !currentPart || currentPart.toUpperCase() === name.toUpperCase();

    if (!isBroken) continue;

    broken++;

    const source = String(product.description || '').trim() || name;
    const newPartNumber = extractPartNumber(source);

    if (!newPartNumber) {
      skipped++;
      console.log(`SKIP: ${product.id} | ${name}`);
      continue;
    }

    if (newPartNumber.toUpperCase() === name.toUpperCase()) {
      skipped++;
      console.log(`SKIP SAME NAME: ${product.id} | ${name}`);
      continue;
    }

    const { error: updateError } = await supabaseAdmin
      .from('products')
      .update({
        part_number: newPartNumber,
        model_number: newPartNumber,
        updated_at: new Date().toISOString(),
      })
      .eq('id', product.id);

    if (updateError) {
      skipped++;
      console.log(`FAILED: ${product.id} | ${updateError.message}`);
      continue;
    }

    repaired++;
    console.log(`FIXED: ${product.id} | ${currentPart || '(empty)'} => ${newPartNumber}`);
  }

  console.log('Done.');
  console.log({
    scanned,
    broken,
    repaired,
    skipped,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
