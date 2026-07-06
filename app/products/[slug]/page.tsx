import ProductGallery from '@/components/product/ProductGallery';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  CheckCircle,
  XCircle,
  FileText,
  Package,
  ChevronRight,
  MessageSquare,
  Tag,
  Boxes,
  Building2,
} from 'lucide-react';
import {
  getSupabaseProductBySlug,
  getSupabaseRelatedProducts,
} from '@/lib/supabase-products';
import ProductCard from '@/components/products/ProductCard';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Props {
  params: { slug: string };
}
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = await getSupabaseProductBySlug(params.slug);

  if (!product) return { title: 'Product Not Found' };

  return {
    title: `${product.partNumber} — ${product.name}`,
    description: `${product.brand} ${product.partNumber} — ${product.description.slice(0, 155)}`,
  };
}

function ConditionBadge({ condition }: { condition: string }) {
  const map: Record<string, string> = {
    New: 'badge-condition-new',
    Used: 'badge-condition-used',
    Refurbished: 'badge-condition-refurbished',
    'Not Working': 'badge-condition-not-working',
  };

  return (
    <span className={`${map[condition] || 'badge-condition-used'} text-sm px-3 py-1`}>
      {condition}
    </span>
  );
}

export default async function ProductDetailPage({ params }: Props) {
  const product = await getSupabaseProductBySlug(params.slug);

  if (!product) notFound();

  const related = await getSupabaseRelatedProducts(product);

  return (
 
    <div className="min-h-screen bg-navy-900 pt-20">
      <div className="bg-navy-800 border-b border-navy-700">
        <div className="page-container py-3">
          <nav className="flex items-center gap-1.5 text-xs text-slate-500">
            <Link href="/" className="hover:text-gold-500">Home</Link>
            <ChevronRight size={12} />
            <Link href="/products" className="hover:text-gold-500">Products</Link>
            <ChevronRight size={12} />
            <span className="text-slate-300 truncate max-w-xs">{product.partNumber}</span>
          </nav>
        </div>
      </div>

      <section className="bg-gradient-to-r from-navy-800 to-navy-700 border-b border-navy-600">
        <div className="page-container py-12">
          <div className="mb-3 flex items-center gap-3">
            <span className="text-sm font-bold uppercase tracking-wider text-gold-500">
              {product.brand}
            </span>
            <span className="text-slate-600">•</span> 
          </div>
          <h1 className="mb-3 text-4xl md:text-5xl font-bold text-white leading-tight">
            {product.name}
          </h1>

          <p className="text-slate-300 max-w-3xl">
            Industrial automation spare part available for RFQ, worldwide shipping and fast quotation support.
          </p>
        </div>
      </section>

      <div className="page-container py-10">
        <div className="grid lg:grid-cols-5 gap-8 mb-14">
          <div className="lg:col-span-2">
           <div className="sticky top-24">
  <ProductGallery
    r2GalleryUrls={product.r2GalleryUrls}
    ebayGalleryUrls={product.ebayGalleryUrls}
    mainImageUrl={product.r2ImageUrl || product.imageUrl}
    alt={product.name}
  />
</div>
          </div>

          <div className="lg:col-span-3">
            <div className="grid grid-cols-1 gap-3 mb-5 sm:grid-cols-5">
              <div className="rounded-xl border border-gold-500/30 bg-gold-500/5 p-5 sm:col-span-2">
                <p className="mb-1 flex items-center gap-1 text-xs uppercase tracking-wider text-gold-500">
                  <Tag size={12} /> Part Number
                </p>
                <p className="font-mono text-3xl font-bold tracking-wide text-white">
                  {product.partNumber}
                </p>
              </div>

              <div className="bg-navy-800 border border-navy-700 rounded-lg p-3">
                <p className="text-xs text-slate-500 mb-1 flex items-center gap-1">
                  <Boxes size={11} /> SKU
                </p>
                <p className="text-sm font-mono text-slate-300">{product.sku}</p>
              </div>

              <div className="bg-navy-800 border border-navy-700 rounded-lg p-3">
                <p className="text-xs text-slate-500 mb-1">Condition</p>
                <ConditionBadge condition={product.condition} />
              </div>

              <div className="bg-navy-800 border border-navy-700 rounded-lg p-3">
                <p className="text-xs text-slate-500 mb-1">Availability</p>
                {product.inStock ? (
                  <div className="flex items-center gap-1.5">
                    <CheckCircle size={14} className="text-emerald-400" />
                    <span className="text-sm text-emerald-400 font-semibold">In Stock</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <XCircle size={14} className="text-slate-500" />
                    <span className="text-sm text-slate-400">RFQ</span>
                  </div>
                )}
              </div>
            </div>

            <div className="mb-6">
              <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Description
              </h2>
              <p className="text-slate-300 text-sm leading-relaxed">
                {product.description || 'Product available for RFQ. Contact us for availability, condition, and delivery time.'}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              <Link
                href={`/rfq?part=${encodeURIComponent(product.partNumber)}&name=${encodeURIComponent(product.name)}`}
                className="btn-gold flex-1 justify-center text-base py-3"
              >
                <FileText size={17} />
                Request a Quote
              </Link>

              <Link
                href={`/contact?part=${encodeURIComponent(product.partNumber)}`}
                className="btn-outline-slate flex-1 justify-center text-base py-3"
              >
                <MessageSquare size={17} />
                Ask About This Item
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-6">
              {['Worldwide Shipping', 'RFQ Response Within 24 Hours', 'New • Used • Surplus', 'Global Industrial Supply'].map((text) => (
                <div key={text} className="bg-navy-800 border border-navy-700 rounded-lg p-3 text-center">
                  <p className="text-xs text-gold-500 font-semibold">{text}</p>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 p-3 bg-navy-800 border border-navy-700 rounded-lg">
              <Building2 size={15} className="text-slate-400 shrink-0" />
              <p className="text-xs text-slate-400">
                Manufactured by <span className="text-gold-500 font-semibold">{product.brand}</span>
              </p>
            </div>
          </div>
        </div>

        {product.tags.length > 0 && (
          <div className="mb-10">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Related Tags
            </h3>
            <div className="flex flex-wrap gap-2">
              {product.tags.map((tag) => (
                <Link
                  key={tag}
                  href={`/products?q=${encodeURIComponent(tag)}`}
                  className="px-3 py-1 bg-navy-800 border border-navy-700 hover:border-gold-500/40 text-slate-400 hover:text-gold-400 rounded text-xs"
                >
                  {tag}
                </Link>
              ))}
            </div>
          </div>
        )}

        {related.length > 0 && (
          <section className="mt-14 rounded-3xl border border-navy-700 bg-navy-800 p-8">
            <h2 className="mb-7 text-2xl font-bold text-white">
              Related Products
            </h2>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {related
                .filter((item) => item.id !== product.id)
                .slice(0, 4)
                .map((item) => (
                  <ProductCard key={item.id} product={item} />
                ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
