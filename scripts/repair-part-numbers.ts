import { supabaseAdmin } from '../lib/supabase-admin';
import { extractPartNumber } from '../lib/part-number';

const BATCH_SIZE = 100;

async function main() {
  let from = 0;
  let repaired = 0;
  let skipped = 0;
  let scanned = 0;

  while (true) {
    const { data: products, error } = await supabaseAdmin
      .from('products')
      .select('id,name,description,part_number,model_number')
      .order('id')
      .range(from, from + BATCH_SIZE - 1);

    if (error) throw error;

    if (!products?.length) break;

    console.log(
      `Processing ${from + 1} - ${from + products.length}`
    );

    for (const product of products) {
      scanned++;

      const current = String(product.part_number || '').trim();
      const name = String(product.name || '').trim();

      // فقط المنتجات المعطوبة
      if (
        current &&
        current.toUpperCase() !== name.toUpperCase()
      ) {
        skipped++;
        continue;
      }

      const source =
        String(product.description || '').trim() ||
        name;

      const newPart = extractPartNumber(source);

      if (!newPart) {
        skipped++;
        continue;
      }

      if (newPart.toUpperCase() === name.toUpperCase()) {
        skipped++;
        continue;
      }

      const { error: updateError } = await supabaseAdmin
        .from('products')
        .update({
          part_number: newPart,
          model_number: newPart,
        })
        .eq('id', product.id);

      if (updateError) {
        console.error(updateError.message);
        continue;
      }

      repaired++;

      console.log(
        `✔ ${product.id} -> ${newPart}`
      );
    }

    from += BATCH_SIZE;
  }

  console.log('======================');
  console.log('Finished');
  console.log({
    scanned,
    repaired,
    skipped,
  });
}

main().catch(console.error);
