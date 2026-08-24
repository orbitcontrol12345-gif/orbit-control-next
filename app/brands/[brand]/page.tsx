import JsonLd from '@/components/seo/JsonLd';
import ProductCard from '@/components/products/ProductCard';

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { cache } from 'react';

import { BRANDS } from '@/lib/data';
import {
  getSupabaseBrandBySlug,
  getSupabaseProductsPage,
} from '@/lib/supabase-products';

const SITE_URL = 'https://www.orbit-surplus.com';
const PRODUCTS_PER_PAGE = 24;

interface Props {
  params: Promise<{
    brand: string;
  }>;
  searchParams?: Promise<{
    page?: string;
  }>;
}

type BrandRecord = {
  name: string;
  slug: string;
  description: string;
  productCount: number;
};

const getBrandBySlug = cache(
  async (
    slug: string,
  ): Promise<BrandRecord | null> => {
    const staticBrand = BRANDS.find(
      (item) => item.slug === slug,
    );

    if (staticBrand) {
      return staticBrand;
    }

    const supabaseBrand =
      await getSupabaseBrandBySlug(slug);

    if (!supabaseBrand) {
      return null;
    }

    return {
      name: supabaseBrand.name,
      slug: supabaseBrand.slug,
      description: `Browse ${supabaseBrand.name} industrial automation parts, PLCs, HMIs, drives, modules, control equipment and obsolete spare parts.`,
      productCount: supabaseBrand.productCount,
    };
  },
);

function cleanText(value?: string | null): string {
  return (value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getCurrentPage(page?: string): number {
  const parsedPage = Number(page);

  if (
    !Number.isInteger(parsedPage) ||
    parsedPage < 1
  ) {
    return 1;
  }

  return parsedPage;
}

export async function generateMetadata({
  params,
  searchParams,
}: Props): Promise<Metadata> {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const brand = await getBrandBySlug(
    resolvedParams.brand,
  );

  if (!brand) {
    return {
      title: 'Brand Not Found',
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const currentPage = getCurrentPage(
    resolvedSearchParams?.page,
  );

  const pageSuffix =
    currentPage > 1
      ? ` – Page ${currentPage}`
      : '';

  const title = `${brand.name} Industrial Automation Parts${pageSuffix}`;

  const description = (
    cleanText(brand.description) ||
    `Browse ${brand.name} industrial automation parts, PLCs, HMIs, drives, modules and surplus equipment. Request a quote with worldwide shipping from Orbit Control Automation.`
  ).slice(0, 160);

  const brandPath = `/brands/${encodeURIComponent(
    brand.slug,
  )}`;

  const canonicalPath =
    currentPage > 1
      ? `${brandPath}?page=${currentPage}`
      : brandPath;

  const canonicalUrl = `${SITE_URL}${canonicalPath}`;

  return {
    title,
    description,

    alternates: {
      canonical: canonicalPath,
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
      description,
      url: canonicalUrl,

      images: [
        {
          url: `${SITE_URL}/logo.png`,
          alt: `${brand.name} industrial automation parts`,
        },
      ],
    },

    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [`${SITE_URL}/logo.png`],
    },
  };
}

export default async function BrandPage({
  params,
  searchParams,
}: Props) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const brand = await getBrandBySlug(
    resolvedParams.brand,
  );

  if (!brand) {
    notFound();
  }

  const currentPage = getCurrentPage(
    resolvedSearchParams?.page,
  );

  const {
    products,
    totalProducts,
    totalPages,
  } = await getSupabaseProductsPage({
    brand: brand.name,
    page: currentPage,
    perPage: PRODUCTS_PER_PAGE,
  });

  if (
    totalProducts > 0 &&
    totalPages > 0 &&
    currentPage > totalPages
  ) {
    notFound();
  }

  const brandUrl = `${SITE_URL}/brands/${encodeURIComponent(
    brand.slug,
  )}`;

  const pageUrl =
    currentPage > 1
      ? `${brandUrl}?page=${currentPage}`
      : brandUrl;

  const brandDescription =
    cleanText(brand.description) ||
    `Browse ${brand.name} industrial automation parts from our live inventory. Request a quote for PLCs, HMIs, drives, modules and surplus equipment with worldwide shipping.`;

  const brandSchema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': `${pageUrl}#collection`,
    url: pageUrl,

    name:
      currentPage > 1
        ? `${brand.name} Industrial Automation Parts – Page ${currentPage}`
        : `${brand.name} Industrial Automation Parts`,

    description: brandDescription,

    isPartOf: {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      name: 'Orbit Control Automation',
      url: SITE_URL,
    },

    about: {
      '@type': 'Brand',
      '@id': `${brandUrl}#brand`,
      name: brand.name,
      url: brandUrl,
      description: brandDescription,
    },

    mainEntity: {
      '@type': 'ItemList',
      name: `${brand.name} Products`,
      numberOfItems: products.length,
    },

    provider: {
      '@type': 'Organization',
      '@id': `${SITE_URL}/#organization`,
      name: 'Orbit Control Automation',
      url: SITE_URL,
    },
  };

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    '@id': `${pageUrl}#breadcrumb`,

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
        name: 'Brands',
        item: `${SITE_URL}/brands`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: brand.name,
        item: brandUrl,
      },
    ],
  };

  return (
    <div className="min-h-screen bg-navy-900 pt-20">
      <JsonLd
        id={`brand-schema-${brand.slug}-${currentPage}`}
        data={brandSchema}
      />

      <JsonLd
        id={`brand-breadcrumb-schema-${brand.slug}`}
        data={breadcrumbSchema}
      />

      <section className="border-b border-navy-700 bg-navy-800">
        <div className="page-container py-12">
          <nav
            aria-label="Breadcrumb"
            className="mb-6 flex items-center gap-2 text-sm text-slate-400"
          >
            <Link
              href="/"
              className="hover:text-gold-500"
            >
              Home
            </Link>

            <ChevronRight size={14} />

            <Link
              href="/brands"
              className="hover:text-gold-500"
            >
              Brands
            </Link>

            <ChevronRight size={14} />

            <span className="text-white">
              {brand.name}
            </span>
          </nav>

          <h1 className="text-4xl font-bold text-white">
            {brand.name} Industrial Automation Parts
          </h1>

          <p className="mt-3 max-w-3xl text-slate-300">
            {brandDescription}
          </p>

          {currentPage > 1 && (
            <p className="mt-3 text-sm font-semibold text-gold-500">
              Page {currentPage} of {totalPages}
            </p>
          )}
        </div>
      </section>

      <section className="page-container py-10">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-2xl font-bold text-white">
            {brand.name} Parts ({totalProducts})
          </h2>

          <Link
            href={`/products?brand=${encodeURIComponent(
              brand.name,
            )}`}
            className="text-sm font-semibold text-gold-500 hover:text-gold-400"
          >
            Search all {brand.name} →
          </Link>
        </div>

        {products.length > 0 ? (
          <>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                />
              ))}
            </div>

            {totalPages > 1 && (
              <nav
                aria-label={`${brand.name} product pagination`}
                className="mt-10 flex justify-center"
              >
                <div className="flex flex-wrap items-center justify-center gap-3 rounded-xl border border-navy-700 bg-navy-800 px-4 py-3">
                  <Link
                    href={`/brands/${brand.slug}?page=${Math.max(
                      1,
                      currentPage - 1,
                    )}`}
                    aria-disabled={currentPage <= 1}
                    className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                      currentPage <= 1
                        ? 'pointer-events-none bg-navy-700 text-slate-400 opacity-40'
                        : 'border border-gold-500 text-gold-400 hover:bg-gold-500 hover:text-navy-950'
                    }`}
                  >
                    ← Previous
                  </Link>

                  <form
                    action={`/brands/${brand.slug}`}
                    method="GET"
                    className="flex items-center gap-2"
                  >
                    <label
                      htmlFor="brand-page-number"
                      className="text-sm text-slate-400"
                    >
                      Page
                    </label>

                    <input
                      key={currentPage}
                      id="brand-page-number"
                      type="number"
                      name="page"
                      min="1"
                      max={totalPages}
                      defaultValue={currentPage}
                      aria-label="Page number"
                      className="w-20 rounded-lg border border-navy-600 bg-navy-900 px-2 py-2 text-center text-sm font-bold text-white"
                    />

                    <span className="text-sm text-slate-400">
                      of {totalPages}
                    </span>

                    <button
                      type="submit"
                      className="rounded-lg border border-gold-500 px-3 py-2 text-sm font-semibold text-gold-400 hover:bg-gold-500 hover:text-navy-950"
                    >
                      Go
                    </button>
                  </form>

                  <Link
                    href={`/brands/${brand.slug}?page=${Math.min(
                      totalPages,
                      currentPage + 1,
                    )}`}
                    aria-disabled={
                      currentPage >= totalPages
                    }
                    className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                      currentPage >= totalPages
                        ? 'pointer-events-none bg-navy-700 text-slate-400 opacity-40'
                        : 'border border-gold-500 text-gold-400 hover:bg-gold-500 hover:text-navy-950'
                    }`}
                  >
                    Next →
                  </Link>
                </div>
              </nav>
            )}
          </>
        ) : (
          <div className="rounded-xl border border-navy-700 bg-navy-800 p-10 text-center">
            <h2 className="text-xl font-bold text-white">
              No products found
            </h2>

            <p className="mt-2 text-slate-400">
              No products are currently listed for{' '}
              {brand.name}. Contact us to request the part
              you need.
            </p>

            <Link
              href={`/rfq?brand=${encodeURIComponent(
                brand.name,
              )}`}
              className="btn-gold mt-6 inline-flex justify-center"
            >
              Request {brand.name} Part
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
