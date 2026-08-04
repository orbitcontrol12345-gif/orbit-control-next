import ProductGallery from '@/components/product/ProductGallery';

import JsonLd from '@/components/seo/JsonLd';
import ProductCard from '@/components/products/ProductCard';
import { buildProductSeo } from '@/lib/seo/productSeo';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';

import {
  CheckCircle,
  XCircle,
  FileText,
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

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const SITE_URL = 'https://www.orbit-surplus.com';

interface Props {
  params: {
    slug: string;
  };
}

function cleanText(value?: string | null): string {
  return (value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getSchemaCondition(condition?: string): string {
  switch (condition?.trim().toLowerCase()) {
    case 'new':
      return 'https://schema.org/NewCondition';

    case 'refurbished':
      return 'https://schema.org/RefurbishedCondition';

    case 'not working':
    case 'for parts':
    case 'damaged':
      return 'https://schema.org/DamagedCondition';

    case 'used':
    default:
      return 'https://schema.org/UsedCondition';
  }
}

function uniqueImages(
  values: Array<string | null | undefined>,
): string[] {
  return [
    ...new Set(
      values.filter(
        (value): value is string =>
          typeof value === 'string' && value.trim().length > 0,
      ),
    ),
  ];
}

export async function generateMetadata({
  params,
}: Props): Promise<Metadata> {
  const product = await getSupabaseProductBySlug(params.slug);

  if (!product) {
    return {
      title: 'Product Not Found',
      robots: {
        index: false,
        follow: false,
      },
    };
  }

 const seo = buildProductSeo({
  brand: product.brand,
  manufacturer: product.brand,
  partNumber: product.partNumber,
  name: product.name,
  description: product.description,
  condition: product.condition,
  category:
    product.category ||
    product.tags?.[0] ||
    'Industrial Automation Parts',
});

const {
  brand,
  partNumber,
  title,
  metaDescription,
  description,
  imageAlt,
} = seo;

  const productPath = `/products/${encodeURIComponent(params.slug)}`;
  const productUrl = `${SITE_URL}${productPath}`;

  const image =
    product.r2ImageUrl ||
    product.imageUrl ||
    `${SITE_URL}/logo.png`;

  return {
  title,
  description: metaDescription,

    alternates: {
      canonical: productPath,
    },

    robots: {
      index: true,
      follow: true,

      googleBot: {
        index: true,
        follow: true,
        'max-image-preview': 'large',
        'max-snippet': -1,
        'max-video-preview': -1,
      },
    },

    openGraph: {
  type: 'website',
  siteName: 'Orbit Control Automation',
  title,
  description: metaDescription,
  url: productUrl,

      images: [
        {
          url: image,
          alt: imageAlt,
        },
      ],
    },

    twitter: {
  card: 'summary_large_image',
  title,
  description: metaDescription,
  images: [image],
},

    other: {
      'product:brand': brand,
      'product:retailer_item_id':
        product.sku || partNumber,
      'product:condition':
        product.condition || 'Used',
      'product:availability': product.inStock
        ? 'in stock'
        : 'available for order',
    },
  };
}

function ConditionBadge({
  condition,
}: {
  condition: string;
}) {
  const map: Record<string, string> = {
    New: 'badge-condition-new',
    Used: 'badge-condition-used',
    Refurbished: 'badge-condition-refurbished',
    'Not Working': 'badge-condition-not-working',
  };

  return (
    <span
      className={`${
        map[condition] || 'badge-condition-used'
      } px-3 py-1 text-sm`}
    >
      {condition}
    </span>
  );
}

export default async function ProductDetailPage({
  params,
}: Props) {
  const product = await getSupabaseProductBySlug(
    params.slug,
  );

  if (!product) {
    notFound();
  }

  const seo = buildProductSeo({
    brand: product.brand,
    partNumber: product.partNumber,
    name: product.name,
    description: product.description,
    condition: product.condition,
  });

  const related =
    await getSupabaseRelatedProducts(product);

  const productUrl = `${SITE_URL}/products/${encodeURIComponent(
    params.slug,
  )}`;

  const productImages = uniqueImages([
    product.r2ImageUrl,
    product.imageUrl,
    ...(product.r2GalleryUrls || []),
    ...(product.ebayGalleryUrls || []),
  ]);

 const schemaDescription = seo.description;

 const productSchema = {
  '@context': 'https://schema.org',
  '@type': 'Product',
  '@id': `${productUrl}#product`,

  url: productUrl,

 name: product.name,

  description: schemaDescription,

  image:
    productImages.length > 0
      ? productImages
      : [`${SITE_URL}/logo.png`],

  sku: product.sku || product.partNumber,

  mpn: product.partNumber,

 brand: {
  '@type': 'Brand',
  name: product.brand,
},

manufacturer: {
  '@type': 'Organization',
  name: product.brand,
},

  category:
    product.category ||
    product.tags?.[0] ||
    'Industrial Automation Parts',

  itemCondition: getSchemaCondition(
    product.condition,
  ),

  additionalProperty: [
    {
      '@type': 'PropertyValue',
      name: 'Part Number',
      value: product.partNumber,
    },
    {
      '@type': 'PropertyValue',
  name: 'Manufacturer',
  value: product.brand,
    },
    {
      '@type': 'PropertyValue',
      name: 'Condition',
      value: product.condition,
    },
    {
      '@type': 'PropertyValue',
      name: 'Availability',
      value: product.inStock
        ? 'In Stock'
        : 'Request for Quote',
    },
  ],

  offers: {
    '@type': 'Offer',

    url: productUrl,

    availability: product.inStock
      ? 'https://schema.org/InStock'
      : 'https://schema.org/PreOrder',

    itemCondition: getSchemaCondition(
      product.condition,
    ),

    seller: {
      '@type': 'Organization',
      name: 'Orbit Control Automation',
    },
  },
};

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    '@id': `${productUrl}#breadcrumb`,

    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: SITE_URL,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Products',
        item: `${SITE_URL}/products`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: product.partNumber,
        item: productUrl,
      },
    ],
  };

  return (
    <div className="min-h-screen bg-navy-900 pt-20">
      <JsonLd
        id={`product-schema-${product.id}`}
        data={productSchema}
      />

      <JsonLd
        id={`breadcrumb-schema-${product.id}`}
        data={breadcrumbSchema}
      />

      <div className="border-b border-navy-700 bg-navy-800">
        <div className="page-container py-3">
          <nav
            aria-label="Breadcrumb"
            className="flex items-center gap-1.5 text-xs text-slate-500"
          >
            <Link
              href="/"
              className="hover:text-gold-500"
            >
              Home
            </Link>

            <ChevronRight size={12} />

            <Link
              href="/products"
              className="hover:text-gold-500"
            >
              Products
            </Link>

            <ChevronRight size={12} />

            <span className="max-w-xs truncate text-slate-300">
              {product.partNumber}
            </span>
          </nav>
        </div>
      </div>

      <section className="border-b border-navy-600 bg-gradient-to-r from-navy-800 to-navy-700">
        <div className="page-container py-12">
          <div className="mb-3 flex items-center gap-3">
            <span className="text-sm font-bold uppercase tracking-wider text-gold-500">
              {product.brand}
            </span>

            <span className="text-slate-600">
              •
            </span>
          </div>

          <h1 className="mb-3 text-4xl font-bold leading-tight text-white md:text-5xl">
            {product.name}
          </h1>

          <p className="max-w-3xl text-slate-300">
            Industrial automation spare part available
            for RFQ, worldwide shipping and fast
            quotation support.
          </p>
        </div>
      </section>

      <div className="page-container py-10">
        <div className="mb-14 grid gap-8 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <div className="sticky top-24">
              <ProductGallery
                r2GalleryUrls={
                  product.r2GalleryUrls
                }
                ebayGalleryUrls={
                  product.ebayGalleryUrls
                }
                mainImageUrl={
                  product.r2ImageUrl ||
                  product.imageUrl
                }
                alt={`${product.brand} ${product.partNumber} ${product.name}`}
              />
            </div>
          </div>

          <div className="lg:col-span-3">
            <div className="mb-5 grid grid-cols-12 gap-3">
              <div className="col-span-7 rounded-xl border border-gold-500/30 bg-gold-500/5 p-5">
                <p className="mb-1 flex items-center gap-1 text-xs uppercase tracking-wider text-gold-500">
                  <Tag size={12} />
                  Part Number
                </p>

                <p className="font-mono text-3xl font-bold tracking-wide text-white">
                  {product.partNumber}
                </p>
              </div>

              
              <div className="col-span-2 rounded-lg border border-navy-700 bg-navy-800 p-3">
                <p className="mb-1 text-xs text-slate-500">
                  Condition
                </p>

                <ConditionBadge
                  condition={product.condition}
                />
              </div>

             <div className="col-span-3 rounded-lg border border-navy-700 bg-navy-800 p-3">
                <p className="mb-1 text-xs text-slate-500">
                  Availability
                </p>

                {product.inStock ? (
                  <div className="flex items-center gap-1.5">
                    <CheckCircle
                      size={14}
                      className="text-emerald-400"
                    />

                    <span className="text-sm font-semibold text-emerald-400">
                      In Stock
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <XCircle
                      size={14}
                      className="text-slate-500"
                    />

                    <span className="text-sm text-slate-400">
                      RFQ
                    </span>
                  </div>
                )}
              </div>
            </div>
<div className="mb-8 rounded-xl border border-navy-700 bg-navy-800 overflow-hidden">
  <div className="border-b border-navy-700 px-5 py-4">
    <h2 className="text-lg font-bold text-white">
      Product Specifications
    </h2>
  </div>

  <div className="grid grid-cols-1 md:grid-cols-2">

    <div className="flex justify-between border-b border-navy-700 px-5 py-3">
      <span className="text-slate-400">Manufacturer</span>
      <span className="font-semibold text-white">{product.brand}</span>
    </div>

    <div className="flex justify-between border-b border-navy-700 px-5 py-3">
      <span className="text-slate-400">Part Number</span>
      <span className="font-mono font-semibold text-gold-500">
        {product.partNumber}
      </span>
    </div>

    <div className="flex justify-between border-b border-navy-700 px-5 py-3">
      <span className="text-slate-400">Condition</span>
      <span className="text-white">
        {product.condition}
      </span>
    </div>

    <div className="flex justify-between border-b border-navy-700 px-5 py-3">
      <span className="text-slate-400">Availability</span>
      <span className="text-white">
        {product.inStock ? 'In Stock' : 'Request For Quote'}
      </span>
    </div>

    <div className="flex justify-between border-b border-navy-700 px-5 py-3">
      <span className="text-slate-400">SKU</span>
      <span className="font-mono text-white">
        {product.sku || product.partNumber}
      </span>
    </div>

    <div className="flex justify-between border-b border-navy-700 px-5 py-3">
      <span className="text-slate-400">Shipping</span>
      <span className="text-white">
        DHL / FedEx Worldwide
      </span>
    </div>

  </div>
</div>
            <div className="mb-6">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-slate-300">
                Description
              </h2>

              <div className="space-y-5 text-sm leading-8 text-slate-300">
  {seo.description
    .split('\n\n')
    .filter(Boolean)
    .map((paragraph, index) => (
      <p
        key={`${product.id}-description-${index}`}
        className={
          index === 0
            ? 'font-medium text-slate-200'
            : ''
        }
      >
        {paragraph}
      </p>
    ))}
</div>
            </div>

            <div className="mb-6 flex flex-col gap-3 sm:flex-row">
              <Link
                href={`/rfq?part=${encodeURIComponent(
                  product.partNumber,
                )}&name=${encodeURIComponent(
                  product.name,
                )}`}
                className="btn-gold flex-1 justify-center py-3 text-base"
              >
                <FileText size={17} />
                Request a Quote
              </Link>

              <Link
                href={`/contact?part=${encodeURIComponent(
                  product.partNumber,
                )}`}
                className="btn-outline-slate flex-1 justify-center py-3 text-base"
              >
                <MessageSquare size={17} />
                Ask About This Item
              </Link>
            </div>

            <div className="mb-6 grid grid-cols-2 gap-3">
              {[
                'Worldwide Shipping',
                'RFQ Response Within 24 Hours',
                'New • Used • Surplus',
                'Global Industrial Supply',
              ].map((text) => (
                <div
                  key={text}
                  className="rounded-lg border border-navy-700 bg-navy-800 p-3 text-center"
                >
                  <p className="text-xs font-semibold text-gold-500">
                    {text}
                  </p>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 rounded-lg border border-navy-700 bg-navy-800 p-3">
              <Building2
                size={15}
                className="shrink-0 text-slate-400"
              />

              <p className="text-xs text-slate-400">
                Manufactured by{' '}
                <span className="font-semibold text-gold-500">
                  {product.brand}
                </span>
              </p>
            </div>
          </div>
        </div>

        {product.tags?.length > 0 && (
          <div className="mb-10">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">
              Related Tags
            </h2>

            <div className="flex flex-wrap gap-2">
              {product.tags.map((tag) => (
                <Link
                  key={tag}
                  href={`/products?q=${encodeURIComponent(
                    tag,
                  )}`}
                  className="rounded border border-navy-700 bg-navy-800 px-3 py-1 text-xs text-slate-400 hover:border-gold-500/40 hover:text-gold-400"
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
                .filter(
                  (item) =>
                    item.id !== product.id,
                )
                .slice(0, 4)
                .map((item) => (
                  <ProductCard
                    key={item.id}
                    product={item}
                  />
                ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
