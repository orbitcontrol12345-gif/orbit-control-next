import { supabaseAdmin } from '../lib/supabase-admin';
import { detectIndustrialBrand } from '../lib/industrial-brand';

const BATCH_SIZE = 500;

async function main() {
  let from = 0;
  let scanned = 0;
  let repaired = 0;
  let skipped = 0;

  while (true) {
    const { data: products, error } = await supabaseAdmin
      .from('products')
      .select('id,name,description,part_number,model_number,brand')
      .eq('brand', 'UNKNOWN')
      .order('id')
      .range(from, from + BATCH_SIZE - 1);

    if (error) throw error;
    if (!products?.length) break;

    for (const product of products) {
      scanned++;

      const text = [
        product.name,
        product.description,
        product.part_number,
        product.model_number,
      ]
        .filter(Boolean)
        .join(' ');

      const detectedBrand = detectIndustrialBrand(text);

      if (!detectedBrand || detectedBrand === 'UNKNOWN') {
        skipped++;
        continue;
      }

      const { error: updateError } = await supabaseAdmin
        .from('products')
        .update({
          brand: detectedBrand,
          updated_at: new Date().toISOString(),
        })
        .eq('id', product.id);

      if (updateError) {
        skipped++;
        console.error(`FAILED ${product.id}: ${updateError.message}`);
        continue;
      }

      repaired++;
      console.log(`✔ ${product.id}: ${product.brand} => ${detectedBrand}`);
    }

    console.log(`Processed ${from + 1} - ${from + products.length}`);
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
