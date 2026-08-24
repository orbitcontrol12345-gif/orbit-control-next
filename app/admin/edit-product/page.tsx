import { supabaseAdmin } from '@/lib/supabase-admin';
import AdminNavigation from '@/components/admin/AdminNavigation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function EditProductPage({
  searchParams,
}: {
  searchParams: Promise<{ sku?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const sku = resolvedSearchParams.sku || '';

  const { data: product } = await supabaseAdmin
    .from('products')
    .select('*')
    .eq('sku', sku)
    .eq('source_type', 'manual')
    .maybeSingle();

  if (!product) {
    return (
      <div className="min-h-screen bg-[#06111d] px-6 py-24 text-white">
        Product not found
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#06111d] px-6 py-24 text-white">
      <div className="mx-auto max-w-3xl">
        <AdminNavigation />

        <div className="rounded-2xl border border-cyan-400/10 bg-[#0b1f2f] p-8">
        <h1 className="mb-6 text-3xl font-bold">Edit Product</h1>

        <form action="/api/admin/update-manual-product" method="POST" className="space-y-4">
          <input type="hidden" name="sku" defaultValue={product.sku} />

          <input name="name" required maxLength={300} defaultValue={product.name || ''} className="w-full rounded-lg p-3 text-black" />
          <input name="brand" maxLength={120} defaultValue={product.brand || ''} className="w-full rounded-lg p-3 text-black" />
          <input name="model_number" required maxLength={160} defaultValue={product.model_number || product.part_number || ''} className="w-full rounded-lg p-3 text-black" />
          <input name="category" maxLength={160} defaultValue={product.category || ''} className="w-full rounded-lg p-3 text-black" />
          <input name="condition" defaultValue={product.condition || ''} className="w-full rounded-lg p-3 text-black" />
          <input name="quantity" type="number" min="0" max="1000000" defaultValue={product.quantity ?? 1} className="w-full rounded-lg p-3 text-black" />
          <input name="image_url" type="url" maxLength={2048} defaultValue={product.image_url || ''} className="w-full rounded-lg p-3 text-black" />

          <textarea
            name="description"
            defaultValue={product.description || ''}
            rows={6}
            maxLength={20000}
            className="w-full rounded-lg p-3 text-black"
          />

          <button className="rounded-lg bg-cyan-400 px-6 py-3 font-bold text-[#06111d]">
            Save Changes
          </button>
        </form>
        </div>
      </div>
    </div>
  );
}
