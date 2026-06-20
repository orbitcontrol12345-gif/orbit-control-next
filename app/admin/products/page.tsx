import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const q = searchParams.q?.trim() || '';

  let query = supabaseAdmin
    .from('products')
    .select('id, sku, name, brand, model_number, part_number, image_url, is_active, source_type, updated_at')
    .eq('source_type', 'manual')
    .order('updated_at', { ascending: false });

  if (q) {
    query = query.or(
      `name.ilike.%${q}%,sku.ilike.%${q}%,part_number.ilike.%${q}%,model_number.ilike.%${q}%,brand.ilike.%${q}%`
    );
  }

  const { data: products, error } = await query;

  if (error) {
    return (
      <div className="min-h-screen bg-[#06111d] px-6 pt-40 pb-24 text-white">
        Error loading products
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#06111d] px-6 pt-40 pb-24 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <h1 className="text-3xl font-bold">Manual Products</h1>

          <Link
            href="/admin/add-product"
            className="rounded-lg bg-cyan-400 px-5 py-3 font-bold text-[#06111d]"
          >
            Add Product
          </Link>
        </div>

        <form method="GET" className="mb-6">
          <div className="flex gap-3">
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder="Search by SKU, model number, brand, or product name..."
              className="w-full rounded-lg border border-cyan-400/20 bg-[#071827] px-4 py-3 text-white outline-none"
            />

            <button
              type="submit"
              className="rounded-lg bg-cyan-400 px-6 py-3 font-bold text-[#06111d]"
            >
              Search
            </button>

            {q && (
              <Link
                href="/admin/products"
                className="rounded-lg bg-slate-600 px-6 py-3 font-bold text-white"
              >
                Clear
              </Link>
            )}
          </div>
        </form>

        <div className="overflow-hidden rounded-2xl border border-cyan-400/10 bg-[#0b1f2f]">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#071827] text-cyan-200">
              <tr>
                <th className="p-4">Image</th>
                <th className="p-4">SKU</th>
                <th className="p-4">Name</th>
                <th className="p-4">Brand</th>
                <th className="p-4">Model</th>
                <th className="p-4">Status</th>
                <th className="p-4">Actions</th>
              </tr>
            </thead>

            <tbody>
              {(products || []).map((p) => (
                <tr key={p.id} className="border-t border-cyan-400/10">
                  <td className="p-4">
                    {p.image_url ? (
                      <img
                        src={p.image_url}
                        alt={p.name}
                        className="h-14 w-14 rounded bg-white object-contain"
                      />
                    ) : (
                      <div className="flex h-14 w-14 items-center justify-center rounded bg-white text-xs text-slate-500">
                        No Image
                      </div>
                    )}
                  </td>

                  <td className="p-4 text-xs text-slate-300">{p.sku}</td>
                  <td className="p-4 font-semibold">{p.name}</td>
                  <td className="p-4">{p.brand}</td>
                  <td className="p-4">{p.model_number || p.part_number}</td>

                  <td className="p-4">
                    {p.is_active ? (
                      <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs text-emerald-300">
                        Active
                      </span>
                    ) : (
                      <span className="rounded-full bg-red-500/20 px-3 py-1 text-xs text-red-300">
                        Hidden
                      </span>
                    )}
                  </td>

                  <td className="p-4">
                    <div className="flex gap-2">
                      <Link
                        href={`/admin/edit-product?sku=${encodeURIComponent(p.sku)}`}
                        className="rounded bg-cyan-500 px-3 py-2 text-xs font-bold text-[#06111d]"
                      >
                        Edit
                      </Link>

                      {p.is_active ? (
                        <a
                          href={`/api/admin/delete-manual-product?sku=${encodeURIComponent(p.sku)}`}
                          className="rounded bg-red-500 px-3 py-2 text-xs font-bold text-white"
                        >
                          Hide
                        </a>
                      ) : (
                        <a
                          href={`/api/admin/restore-manual-product?sku=${encodeURIComponent(p.sku)}`}
                          className="rounded bg-emerald-500 px-3 py-2 text-xs font-bold text-white"
                        >
                          Restore
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!products?.length && (
          <p className="mt-6 text-slate-400">No manual products found.</p>
        )}
      </div>
    </div>
  );
}
