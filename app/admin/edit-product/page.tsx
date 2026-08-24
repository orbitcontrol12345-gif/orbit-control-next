import { supabaseAdmin } from '@/lib/supabase-admin';
import AdminNavigation from '@/components/admin/AdminNavigation';
import ManualProductImages from '@/components/admin/ManualProductImages';
import { CATEGORIES } from '@/lib/catalog-categories';

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

  const initialImageUrls = Array.from(
    new Set(
      [
        ...(Array.isArray(product.r2_gallery_urls)
          ? product.r2_gallery_urls
          : []),
        product.r2_image_url,
        product.image_url,
      ]
        .map((url) => String(url || '').trim())
        .filter(Boolean),
    ),
  );

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
          <select
            name="category"
            required
            defaultValue={
              CATEGORIES.some(
                (category) => category.name === product.category,
              )
                ? product.category
                : ''
            }
            className="w-full rounded-lg p-3 text-black"
          >
            <option value="" disabled>
              Select Category
            </option>
            {CATEGORIES.map((category) => (
              <option key={category.slug} value={category.name}>
                {category.name}
              </option>
            ))}
          </select>

          <select
            name="condition"
            defaultValue={product.condition || 'Used'}
            className="w-full rounded-lg p-3 text-black"
          >
            <option>Used</option>
            <option>New</option>
            <option>New – Open box</option>
            <option>Refurbished</option>
            <option>For parts</option>
          </select>

          <ManualProductImages initialUrls={initialImageUrls} />

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
