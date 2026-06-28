import { supabaseAdmin } from '../lib/supabase-admin';
import { extractIndustrialPartNumber } from '../lib/industrial-part-number';

const BATCH_SIZE = 100;

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

      const newPart = extractIndustrialPartNumber(source);
      const oldPart = String(product.part_number || '').trim();

      if (!newPart) {
        skipped++;
        continue;
      }

      if (newPart.toUpperCase() === oldPart.toUpperCase()) {
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
      console.log(`✔ ${product.id}: ${oldPart} => ${newPart}`);
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
