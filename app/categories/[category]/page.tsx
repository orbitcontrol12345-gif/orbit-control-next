import JsonLd from '@/components/seo/JsonLd';
import ProductCard from '@/components/products/ProductCard';

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

import { CATEGORIES } from '@/lib/data';
import { getSupabaseProductsByCategoryTerms } from '@/lib/supabase-products';

const SITE_URL = 'https://www.orbit-surplus.com';
const PRODUCTS_PER_PAGE = 24;

interface Props {
  params: {
    category: string;
  };
  searchParams?: {
    page?: string;
  };
}

const categorySearchMap: Record<string, string[]> = {
  plcs: ['PLC'],
  hmis: ['HMI'],
  'drives-vfds': [
    'Variable Frequency Drives',
    'Servo Drives & Amplifiers',
    'General Purpose AC Drives',
    'Speed Controls',
    'Stepper Controls & Drives',
    'Reduced Voltage/Soft Starters',
    'Other Motor Controls',
    'Drive',
    'Drives',
    'VFD',
  ],
  sensors: ['Sensor'],
  'circuit-breakers': ['Breaker', 'Circuit Breaker'],
  relays: ['Relay'],
  'power-supplies': ['Power Supply'],
  'control-boards': ['Control Board', 'Circuit Board', 'PCB'],
  'servo-systems': ['Servo'],
  'safety-devices': ['Safety'],
  'obsolete-parts': ['Obsolete'],
  contactors: ['Contactor'],
};

function cleanText(value?: string | null): string {
  return (value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getCurrentPage(page?: string): number {
  const parsedPage = Number(page);

  if (!Number.isInteger(parsedPage) || parsedPage < 1) {
    return 1;
  }

  return parsedPage;
}

function getCategoryDescription(categoryName: string): string {
  return `Browse ${categoryName} industrial automation parts, components and surplus equipment from our live inventory. Request a quote with worldwide shipping from Orbit Control Automation.`;
}

export async function generateMetadata({
  params,
  searchParams,
}: Props): Promise<Metadata> {
  const category = CATEGORIES.find(
    (item) => item.slug === params.category,
  );

  if (!category) {
    return {
      title: 'Category Not Found',
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const currentPage = getCurrentPage(searchParams?.page);

  const pageSuffix =
    currentPage > 1 ? ` – Page ${currentPage}` : '';

  const title = `${category.name} Industrial Automation Parts${pageSuffix}`;

  const description = (
    cleanText(category.description) ||
    getCategoryDescription(category.name)
  ).slice(0, 160);

  const categoryPath = `/categories/${encodeURIComponent(
    category.slug,
  )}`;

  const canonicalPath =
    currentPage > 1
      ? `${categoryPath}?page=${currentPage}`
      : categoryPath;

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
          alt: `${category.name} industrial automation parts`,
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

export default async function CategoryPage({
  params,
  searchParams,
}: Props) {
  const category = CATEGORIES.find(
    (item) => item.slug === params.category,
  );

  if (!category) {
    notFound();
  }

  const currentPage = getCurrentPage(searchParams?.page);

  const terms =
    categorySearchMap[category.slug] || [category.name];

  const { products, totalPages } =
    await getSupabaseProductsByCategoryTerms({
      terms,
      page: currentPage,
      perPage: PRODUCTS_PER_PAGE,
    });

  if (
    totalPages > 0 &&
    currentPage > totalPages
  ) {
    notFound();
  }

  const categoryUrl = `${SITE_URL}/categories/${encodeURIComponent(
    category.slug,
  )}`;

  const pageUrl =
    currentPage > 1
      ? `${categoryUrl}?page=${currentPage}`
      : categoryUrl;

  const categoryDescription =
    cleanText(category.description) ||
    getCategoryDescription(category.name);

  const categorySchema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': `${pageUrl}#collection`,
    url: pageUrl,

    name:
      currentPage > 1
        ? `${category.name} Industrial Automation Parts – Page ${currentPage}`
        : `${category.name} Industrial Automation Parts`,

    description: categoryDescription,

    isPartOf: {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      name: 'Orbit Control Automation',
      url: SITE_URL,
    },

    about: {
      '@type': 'Thing',
      name: category.name,
      description: categoryDescription,
    },

    mainEntity: {
      '@type': 'ItemList',
      name: `${category.name} Products`,
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
        name: 'Categories',
        item: `${SITE_URL}/categories`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: category.name,
        item: categoryUrl,
      },
    ],
  };

  return (
    <div className="min-h-screen bg-navy-900 pt-20">
      <JsonLd
        id={`category-schema-${category.slug}-${currentPage}`}
        data={categorySchema}
      />

      <JsonLd
        id={`category-breadcrumb-schema-${category.slug}`}
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
              href="/categories"
              className="hover:text-gold-500"
            >
              Categories
            </Link>

            <ChevronRight size={14} />

            <span className="text-white">
              {category.name}
            </span>
          </nav>

          <h1 className="text-4xl font-bold text-white">
            {category.name} Industrial Automation Parts
          </h1>

          <p className="mt-3 max-w-3xl text-slate-300">
            {categoryDescription}
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
          <div>
            <h2 className="text-2xl font-bold text-white">
              Available {category.name}
            </h2>

            <p className="mt-1 text-sm text-slate-400">
              Browse live industrial automation inventory
              and request a quote for worldwide delivery.
            </p>
          </div>

          <Link
            href={`/products?q=${encodeURIComponent(
              category.name,
            )}`}
            className="text-sm font-semibold text-gold-500 hover:text-gold-400"
          >
            Search all {category.name} →
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
                aria-label={`${category.name} product pagination`}
                className="mt-10 flex justify-center"
              >
                <div className="flex flex-wrap items-center justify-center gap-3 rounded-xl border border-navy-700 bg-navy-800 px-4 py-3">
                  <Link
                    href={`/categories/${category.slug}?page=${Math.max(
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
                    action={`/categories/${category.slug}`}
                    method="GET"
                    className="flex items-center gap-2"
                  >
                    <label
                      htmlFor="category-page-number"
                      className="text-sm text-slate-400"
                    >
                      Page
                    </label>

                    <input
                      key={currentPage}
                      id="category-page-number"
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
                    href={`/categories/${category.slug}?page=${Math.min(
                      totalPages,
                      currentPage + 1,
                    )}`}
                    aria-disabled={currentPage >= totalPages}
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
              {category.name}. Contact us to request the
              part you need.
            </p>

            <Link
              href={`/rfq?category=${encodeURIComponent(
                category.name,
              )}`}
              className="btn-gold mt-6 inline-flex justify-center"
            >
              Request {category.name}
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
