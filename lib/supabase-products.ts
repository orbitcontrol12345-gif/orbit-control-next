import type { Product } from '@/lib/types';
import { supabaseAdmin } from '@/lib/supabase-admin';
import {
  findProductOverrideItemIds,
  getProductDataOverride,
} from '@/lib/product-data-overrides';
import { unstable_cache } from 'next/cache';
const PRODUCTS_TABLE = 'products';
const MIGRATION_REDIRECTS_TABLE = 'migration_redirects';
const SITE_URL = 'https://www.orbit-surplus.com';
const PRODUCT_LIST_COLUMNS = `
  id,
  sku,
  ebay_item_id,
  slug,
  brand,
  part_number,
  name,
  category,
  condition,
  is_active,
  image_url,
  r2_image_url,
  ebay_image_url,
  created_at,
  updated_at
`;

type ProductSortOption = 'relevance' | 'name' | 'brand' | 'condition';

type ProductsPageOptions = {
  search?: string;
  brand?: string;
  category?: string;
  condition?: string;
  inStockOnly?: boolean;
  sort?: ProductSortOption;
  page?: number;
  perPage?: number;
};

function cleanProductName(name: string): string {
  return name
    .replace(/\bnew without box\b/gi, '')
    .replace(/\bnew w\/o box\b/gi, '')
    .replace(/\bnew no box\b/gi, '')
    .replace(/\bused\b/gi, '')
    .replace(/\bfor parts\b/gi, '')
    .replace(/\bnot working\b/gi, '')
    .replace(/\bparts or not working\b/gi, '')
    .replace(/\bopen box\b/gi, '')
    .replace(/\bnew open box\b/gi, '')
    .replace(/\s*-\s*$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function mapSupabaseProduct(item: any): Product {
  const dataOverride = getProductDataOverride(item);
  const partNumber =
    dataOverride?.partNumber ||
    item.part_number ||
    'UNKNOWN';
  const productName =
    dataOverride?.name || item.name || '';
  const category =
    dataOverride?.category ||
    item.category ||
    'Industrial Parts';
  const bestImage =
    (Array.isArray(item.r2_gallery_urls) && item.r2_gallery_urls.length > 0
      ? item.r2_gallery_urls[0]
      : null) ||
    item.r2_image_url ||
    (Array.isArray(item.ebay_gallery_urls) &&
    item.ebay_gallery_urls.length > 0
      ? item.ebay_gallery_urls[0]
      : null) ||
    item.ebay_image_url ||
    item.image_url ||
    '/placeholder-product.jpg';

  return {
    id: String(item.id),
    sku: item.sku || '',
    brand: item.brand || 'Unknown',
    partNumber,
    name: cleanProductName(productName),
    category,
    condition: item.condition || 'Used',
    inStock: item.is_active !== false,
    description:
      dataOverride?.name ||
      item.description ||
      item.name ||
      '',
    technicalSpecs: {},
    imageUrl: bestImage,
    r2ImageUrl: item.r2_image_url || null,
    r2GalleryUrls: item.r2_gallery_urls || [],
    ebayGalleryUrls: item.ebay_gallery_urls || [],
    tags: [
      item.sku,
      partNumber,
      item.brand,
      category,
      productName,
    ].filter(Boolean),
    slug:
      item.slug ||
      item.sku ||
      item.ebay_item_id ||
      String(item.id),
    createdAt: item.created_at || undefined,
    updatedAt: item.updated_at || undefined,
  };
}

function mapSupabaseProductListItem(item: any): Product {
  const dataOverride = getProductDataOverride(item);
  const bestImage =
    item.r2_image_url ||
    item.ebay_image_url ||
    item.image_url ||
    '/placeholder-product.jpg';

  return {
    id: String(item.id),
    sku: item.sku || '',
    brand: item.brand || 'Unknown',
    partNumber:
      dataOverride?.partNumber ||
      item.part_number ||
      'UNKNOWN',
    name: cleanProductName(
      dataOverride?.name || item.name || '',
    ),
    category:
      dataOverride?.category ||
      item.category ||
      'Industrial Parts',
    condition: item.condition || 'Used',
    inStock: item.is_active !== false,
    description: '',
    technicalSpecs: {},
    imageUrl: bestImage,
    r2ImageUrl: null,
    r2GalleryUrls: [],
    ebayGalleryUrls: [],
    tags: [],
    slug:
      item.slug ||
      item.sku ||
      item.ebay_item_id ||
      String(item.id),
    createdAt: item.created_at || undefined,
    updatedAt: item.updated_at || undefined,
  };
}

function normalizePage(value: number): number {
  return Number.isFinite(value) ? Math.max(1, Math.floor(value)) : 1;
}

function normalizePerPage(value: number): number {
  return Number.isFinite(value)
    ? Math.min(100, Math.max(1, Math.floor(value)))
    : 24;
}

/**
 * Removes characters that can break a PostgREST `.or()` expression.
 * This does not change normal part numbers, brand names, or search terms.
 */
function cleanFilterValue(value: string): string {
  return value
    .trim()
    .replace(/[(),]/g, ' ')
    .replace(/\s+/g, ' ');
}

type ProductLookupColumn =
  | 'slug'
  | 'sku'
  | 'ebay_item_id'
  | 'part_number'
  | 'model_number';

async function findVisibleProductBy(
  column: ProductLookupColumn,
  value: string,
): Promise<any | null> {
  const { data, error } = await supabaseAdmin
    .from(PRODUCTS_TABLE)
    .select('*')
    .eq('is_active', true)
    .neq('catalog_visible', false)
    .eq(column, value)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(
      `Product lookup failed for ${column}:`,
      error,
    );

    return null;
  }

  return data || null;
}

function getRedirectTargetProductSlug(
  newUrl: string,
): string | null {
  try {
    const targetUrl = new URL(newUrl, SITE_URL);
    const match = targetUrl.pathname.match(
      /^\/products\/([^/]+)\/?$/,
    );

    return match
      ? decodeURIComponent(match[1]).trim()
      : null;
  } catch {
    return null;
  }
}

async function findVisibleProductFromRedirect(
  decodedSlug: string,
): Promise<any | null> {
  if (
    !decodedSlug ||
    decodedSlug.includes('/') ||
    decodedSlug.includes('\\')
  ) {
    return null;
  }

  const oldPaths = [
    `/products/${decodedSlug}`,
    `/products/${decodedSlug}/`,
  ];

  for (const oldPath of oldPaths) {
    const { data: redirectRow, error } =
      await supabaseAdmin
        .from(MIGRATION_REDIRECTS_TABLE)
        .select('new_url')
        .eq('old_path', oldPath)
        .eq('is_active', true)
        .eq('redirect_enabled', true)
        .limit(1)
        .maybeSingle();

    if (error) {
      console.error(
        'Product redirect lookup failed:',
        error,
      );

      continue;
    }

    const targetSlug = getRedirectTargetProductSlug(
      String(redirectRow?.new_url || ''),
    );

    if (!targetSlug || targetSlug === decodedSlug) {
      continue;
    }

    const targetProduct = await findVisibleProductBy(
      'slug',
      targetSlug,
    );

    if (targetProduct) {
      return targetProduct;
    }
  }

  return null;
}

async function loadSupabaseProductsPage({
  search = '',
  brand = '',
  category = '',
  condition = '',
  inStockOnly = false,
  sort = 'relevance',
  page = 1,
  perPage = 24,
}: ProductsPageOptions) {
  const safePage = normalizePage(page);
  const safePerPage = normalizePerPage(perPage);

  const from = (safePage - 1) * safePerPage;
  const to = from + safePerPage - 1;

  const cleanSearch = cleanFilterValue(search);
  const cleanBrand = cleanFilterValue(brand);
  const cleanCategory = cleanFilterValue(category);
  const cleanCondition = cleanFilterValue(condition);

  let query = supabaseAdmin
    .from(PRODUCTS_TABLE)
    .select(PRODUCT_LIST_COLUMNS, { count: 'exact' })
    .eq('is_active', true)
    .neq('catalog_visible', false);

  if (cleanSearch) {
    const overrideItemIds =
      findProductOverrideItemIds(cleanSearch);

    query = query.or(
      [
        `name.ilike.%${cleanSearch}%`,
        `sku.ilike.%${cleanSearch}%`,
        `part_number.ilike.%${cleanSearch}%`,
        `brand.ilike.%${cleanSearch}%`,
        `category.ilike.%${cleanSearch}%`,
        ...(overrideItemIds.length > 0
          ? [
              `ebay_item_id.in.(${overrideItemIds.join(',')})`,
            ]
          : []),
      ].join(','),
    );
  }

  if (cleanBrand) {
    query = query.ilike('brand', cleanBrand);
  }

 if (cleanCategory) {
  switch (cleanCategory) {
    case 'PLCs':
      query = query.or(
        [
          'category.ilike.%PLC%',
          'name.ilike.%PLC%',
          'name.ilike.%Programmable Logic Controller%',
          'name.ilike.%PLC Processor%',
          'name.ilike.%PLC CPU%',
          'name.ilike.%CPU Module%',
          'name.ilike.%CompactLogix%',
          'name.ilike.%ControlLogix%',
          'name.ilike.%MicroLogix%',
          'name.ilike.%S7-200%',
          'name.ilike.%S7-300%',
          'name.ilike.%S7-400%',
          'name.ilike.%S7-1200%',
          'name.ilike.%S7-1500%',
        ].join(','),
      );
      break;

    case 'HMIs':
      query = query.or(
        [
          'category.ilike.%HMI%',
          'name.ilike.%HMI%',
          'name.ilike.%Human Machine Interface%',
          'name.ilike.%Touch Panel%',
          'name.ilike.%Operator Panel%',
          'name.ilike.%Touchscreen%',
          'name.ilike.%PanelView%',
        ].join(','),
      );
      break;

    case 'Drives & VFDs':
      query = query.or(
        [
          'category.ilike.%Drive%',
          'category.ilike.%VFD%',
          'name.ilike.%Drive%',
          'name.ilike.%VFD%',
          'name.ilike.%Variable Frequency Drive%',
          'name.ilike.%Inverter%',
          'name.ilike.%Servo Drive%',
          'name.ilike.%Speed Control%',
          'name.ilike.%Soft Starter%',
        ].join(','),
      );
      break;

    case 'Sensors':
      query = query.or(
        [
          'category.ilike.%Sensor%',
          'name.ilike.%Sensor%',
        ].join(','),
      );
      break;

    case 'Circuit Breakers':
      query = query.or(
        [
          'category.ilike.%Breaker%',
          'name.ilike.%Circuit Breaker%',
          'name.ilike.%MCB%',
          'name.ilike.%MCCB%',
          'name.ilike.%ACB%',
        ].join(','),
      );
      break;

    case 'Relays':
      query = query.or(
        [
          'category.ilike.%Relay%',
          'name.ilike.%Relay%',
        ].join(','),
      );
      break;

    case 'Power Supplies':
      query = query.or(
        [
          'category.ilike.%Power Supply%',
          'name.ilike.%Power Supply%',
          'name.ilike.%PSU%',
        ].join(','),
      );
      break;

    case 'Control Boards':
      query = query.or(
        [
          'category.ilike.%Control Board%',
          'name.ilike.%Control Board%',
          'name.ilike.%Circuit Board%',
          'name.ilike.%PCB%',
        ].join(','),
      );
      break;

    case 'Servo Systems':
      query = query.or(
        [
          'category.ilike.%Servo%',
          'name.ilike.%Servo%',
        ].join(','),
      );
      break;

    case 'Safety Devices':
      query = query.or(
        [
          'category.ilike.%Safety%',
          'name.ilike.%Safety%',
          'name.ilike.%Light Curtain%',
          'name.ilike.%E-Stop%',
        ].join(','),
      );
      break;

    case 'Obsolete Parts':
      query = query.or(
        [
          'category.ilike.%Obsolete%',
          'name.ilike.%Obsolete%',
          'name.ilike.%Discontinued%',
          'name.ilike.%Legacy%',
        ].join(','),
      );
      break;

    case 'Contactors':
      query = query.or(
        [
          'category.ilike.%Contactor%',
          'name.ilike.%Contactor%',
        ].join(','),
      );
      break;

    default:
      query = query.ilike(
        'category',
        `%${cleanCategory}%`,
      );
  }
}
  if (cleanCondition) {
    query = query.ilike('condition', cleanCondition);
  }

  /*
   * The current Product mapping treats every active product as in stock.
   * Keep this flag accepted for compatibility with the filters UI.
   * When a real stock column is confirmed, apply it here.
   */
  if (inStockOnly) {
    query = query.eq('is_active', true);
  }

  switch (sort) {
    case 'name':
      query = query.order('name', { ascending: true });
      break;

    case 'brand':
      query = query.order('brand', { ascending: true });
      break;

    case 'condition':
      query = query.order('condition', { ascending: true });
      break;

    case 'relevance':
    default:
      query = query.order('id', { ascending: false });
      break;
  }

  const { data, count, error } = await query.range(from, to);

  if (error) {
    console.error('Products page query failed:', error);

    return {
      products: [],
      totalProducts: 0,
      totalPages: 0,
    };
  }

  const totalProducts = count || 0;

  return {
    products: (data || []).map(mapSupabaseProductListItem),
    totalProducts,
    totalPages: Math.max(
      1,
      Math.ceil(totalProducts / safePerPage),
    ),
  };
}

const getCachedSupabaseProductsPage = unstable_cache(
  async (
    brand: string,
    category: string,
    condition: string,
    inStockOnly: boolean,
    sort: ProductSortOption,
    page: number,
    perPage: number,
  ) =>
    loadSupabaseProductsPage({
      brand,
      category,
      condition,
      inStockOnly,
      sort,
      page,
      perPage,
    }),
  ['visible-products-page-v2'],
  {
    revalidate: 300,
    tags: ['products'],
  },
);

export async function getSupabaseProductsPage(
  options: ProductsPageOptions,
) {
  const search = cleanFilterValue(options.search || '');

  if (search) {
    return loadSupabaseProductsPage({
      ...options,
      search,
    });
  }

  return getCachedSupabaseProductsPage(
    cleanFilterValue(options.brand || ''),
    cleanFilterValue(options.category || ''),
    cleanFilterValue(options.condition || ''),
    options.inStockOnly === true,
    options.sort || 'relevance',
    normalizePage(options.page ?? 1),
    normalizePerPage(options.perPage ?? 24),
  );
}

export async function searchSupabaseProducts(
  rawSearch: string,
  limit = 8,
): Promise<Product[]> {
  const search = cleanFilterValue(rawSearch);

  if (search.length < 2) {
    return [];
  }

  const safeLimit = Math.min(
    12,
    Math.max(1, Math.floor(limit)),
  );
  const overrideItemIds =
    findProductOverrideItemIds(search);
  const { data, error } = await supabaseAdmin
    .from(PRODUCTS_TABLE)
    .select(PRODUCT_LIST_COLUMNS)
    .eq('is_active', true)
    .neq('catalog_visible', false)
    .or(
      [
        `name.ilike.%${search}%`,
        `sku.ilike.%${search}%`,
        `part_number.ilike.%${search}%`,
        `brand.ilike.%${search}%`,
        `category.ilike.%${search}%`,
        ...(overrideItemIds.length > 0
          ? [
              `ebay_item_id.in.(${overrideItemIds.join(',')})`,
            ]
          : []),
      ].join(','),
    )
    .order('id', { ascending: false })
    .limit(safeLimit);

  if (error) {
    console.error('Product suggestions query failed:', error);
    return [];
  }

  return (data || []).map(mapSupabaseProductListItem);
}

async function loadSupabaseProductsByCategoryTerms({
  terms,
  excludeTerms = [],
  page = 1,
  perPage = 24,
}: {
  terms: string[];
  excludeTerms?: string[];
  page?: number;
  perPage?: number;
}) {
  const safePage = normalizePage(page);
  const safePerPage = normalizePerPage(perPage);

  const from = (safePage - 1) * safePerPage;
  const to = from + safePerPage - 1;

  const cleanTerms = terms
    .map(cleanFilterValue)
    .filter(Boolean);

  if (cleanTerms.length === 0) {
    return {
      products: [],
      totalProducts: 0,
      totalPages: 1,
    };
  }

  const filters = cleanTerms
    .flatMap((term) => [
      `name.ilike.%${term}%`,
      `category.ilike.%${term}%`,
      `brand.ilike.%${term}%`,
      `part_number.ilike.%${term}%`,
    ])
    .join(',');

  let query = supabaseAdmin
    .from(PRODUCTS_TABLE)
    .select(PRODUCT_LIST_COLUMNS, { count: 'exact' })
    .eq('is_active', true)
    .neq('catalog_visible', false)
    .or(filters);

  for (const rawTerm of excludeTerms) {
    const term = cleanFilterValue(rawTerm);

    if (!term) {
      continue;
    }

    query = query
      .not('name', 'ilike', `%${term}%`)
      .not('category', 'ilike', `%${term}%`);
  }

  const { data, count, error } = await query
    .order('id', { ascending: false })
    .range(from, to);

  if (error) {
    console.error('Category products query failed:', error);

    return {
      products: [],
      totalProducts: 0,
      totalPages: 0,
    };
  }

  const totalProducts = count || 0;

  return {
    products: (data || []).map(mapSupabaseProductListItem),
    totalProducts,
    totalPages: Math.max(
      1,
      Math.ceil(totalProducts / safePerPage),
    ),
  };
}

const getCachedSupabaseProductsByCategoryTerms = unstable_cache(
  async (
    termsJson: string,
    excludeTermsJson: string,
    page: number,
    perPage: number,
  ) =>
    loadSupabaseProductsByCategoryTerms({
      terms: JSON.parse(termsJson) as string[],
      excludeTerms: JSON.parse(excludeTermsJson) as string[],
      page,
      perPage,
    }),
  ['visible-category-products-v2'],
  {
    revalidate: 300,
    tags: ['products'],
  },
);

export async function getSupabaseProductsByCategoryTerms({
  terms,
  excludeTerms = [],
  page = 1,
  perPage = 24,
}: {
  terms: string[];
  excludeTerms?: string[];
  page?: number;
  perPage?: number;
}) {
  const normalizedTerms = terms
    .map(cleanFilterValue)
    .filter(Boolean);
  const normalizedExcludeTerms = excludeTerms
    .map(cleanFilterValue)
    .filter(Boolean);

  return getCachedSupabaseProductsByCategoryTerms(
    JSON.stringify(normalizedTerms),
    JSON.stringify(normalizedExcludeTerms),
    normalizePage(page),
    normalizePerPage(perPage),
  );
}

async function loadSupabaseProductBySlug(
  slug: string,
): Promise<Product | null> {
  let decodedSlug: string;

  try {
    decodedSlug = decodeURIComponent(slug).trim();
  } catch {
    return null;
  }

  if (!decodedSlug) {
    return null;
  }

  let data = await findVisibleProductBy(
    'slug',
    decodedSlug,
  );

  if (!data) {
    const embeddedEbayItemId = decodedSlug.match(
      /^(\d{12})(?:-|$)/,
    )?.[1];

    const fallbackLookups: Array<{
      column: ProductLookupColumn;
      value: string;
    }> = [
      ...(embeddedEbayItemId
        ? [
            {
              column: 'ebay_item_id' as const,
              value: embeddedEbayItemId,
            },
          ]
        : []),
      { column: 'sku', value: decodedSlug },
      { column: 'ebay_item_id', value: decodedSlug },
      { column: 'part_number', value: decodedSlug },
      { column: 'model_number', value: decodedSlug },
    ];

    const attemptedLookups = new Set<string>();

    for (const lookup of fallbackLookups) {
      const lookupKey = `${lookup.column}:${lookup.value}`;

      if (attemptedLookups.has(lookupKey)) {
        continue;
      }

      attemptedLookups.add(lookupKey);

      data = await findVisibleProductBy(
        lookup.column,
        lookup.value,
      );

      if (data) {
        break;
      }
    }
  }

  if (!data) {
    data = await findVisibleProductFromRedirect(
      decodedSlug,
    );
  }

  if (!data) {
    return null;
  }

  return mapSupabaseProduct(data);
}

const getCachedSupabaseProductBySlug = unstable_cache(
  loadSupabaseProductBySlug,
  ['visible-product-by-slug-v2'],
  {
    revalidate: 300,
    tags: ['products'],
  },
);

export async function getSupabaseProductBySlug(
  slug: string,
): Promise<Product | null> {
  return getCachedSupabaseProductBySlug(slug);
}

async function loadSupabaseRelatedProducts(
  product: Pick<Product, 'id' | 'sku' | 'brand' | 'category'>,
): Promise<Product[]> {
  const brand = cleanFilterValue(product.brand);
  const category = cleanFilterValue(product.category);

  const relatedFilters = [
    brand ? `brand.eq.${brand}` : '',
    category ? `category.eq.${category}` : '',
  ]
    .filter(Boolean)
    .join(',');

  if (!relatedFilters) {
    return [];
  }

  let query = supabaseAdmin
    .from(PRODUCTS_TABLE)
    .select(PRODUCT_LIST_COLUMNS)
    .eq('is_active', true)
    .neq('catalog_visible', false)
    .or(relatedFilters)
    .limit(30);

  if (product.id) {
    query = query.neq('id', product.id);
  }

  if (product.sku) {
    query = query.neq('sku', product.sku);
  }

  const { data, error } = await query;

  if (error) {
    console.error(
      'Related products query failed:',
      error,
    );

    return [];
  }

  const normalizedBrand = String(
    product.brand || '',
  )
    .trim()
    .toLowerCase();

  const normalizedCategory = String(
    product.category || '',
  )
    .trim()
    .toLowerCase();

  const uniqueProducts = new Map<
    string,
    Product
  >();

  for (const row of data || []) {
    const item = mapSupabaseProductListItem(row);

    if (
      !item.imageUrl ||
      item.imageUrl === '/placeholder-product.jpg'
    ) {
      continue;
    }

    if (
      item.id === product.id ||
      (product.sku && item.sku === product.sku)
    ) {
      continue;
    }

    const uniqueKey = String(
      item.id ||
        item.sku ||
        item.slug ||
        item.partNumber,
    );

    if (!uniqueProducts.has(uniqueKey)) {
      uniqueProducts.set(uniqueKey, item);
    }
  }

  return Array.from(uniqueProducts.values())
    .map((item) => {
      const itemBrand = String(item.brand || '')
        .trim()
        .toLowerCase();

      const itemCategory = String(
        item.category || '',
      )
        .trim()
        .toLowerCase();

      let score = 0;

      if (
        normalizedBrand &&
        itemBrand === normalizedBrand
      ) {
        score += 10;
      }

      if (
        normalizedCategory &&
        itemCategory === normalizedCategory
      ) {
        score += 6;
      }

      if (
        normalizedBrand &&
        normalizedCategory &&
        itemBrand === normalizedBrand &&
        itemCategory === normalizedCategory
      ) {
        score += 10;
      }

      return {
        item,
        score,
      };
    })
    .sort((a, b) => b.score - a.score)
    .map(({ item }) => item)
    .slice(0, 4);
}

const getCachedSupabaseRelatedProducts = unstable_cache(
  async (
    id: string,
    sku: string,
    brand: string,
    category: string,
  ) =>
    loadSupabaseRelatedProducts({
      id,
      sku,
      brand,
      category,
    }),
  ['visible-related-products-v2'],
  {
    revalidate: 300,
    tags: ['products'],
  },
);

export async function getSupabaseRelatedProducts(
  product: Product,
): Promise<Product[]> {
  return getCachedSupabaseRelatedProducts(
    product.id,
    product.sku,
    product.brand,
    product.category,
  );
}
export const getVisibleProductsCount = unstable_cache(
  async (): Promise<number | null> => {
    const { count, error } = await supabaseAdmin
      .from('products')
      .select('id', {
        count: 'exact',
        head: true,
      })
      .eq('is_active', true)
      .neq('catalog_visible', false);

    if (error) {
      console.error('Products count query failed:', error);
      return null;
    }

    return count ?? 0;
  },
  ['homepage-visible-products-count-v1'],
  {
    revalidate: 3600, // يتحدث تلقائيًا كل ساعة
    tags: ['products-count'],
  },
);
export type SupabaseBrandSummary = {
  name: string;
  slug: string;
  productCount: number;
};

function createBrandSlug(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export async function getSupabaseBrandBySlug(
  rawSlug: string,
): Promise<SupabaseBrandSummary | null> {
  let decodedSlug = rawSlug;

  try {
    decodedSlug = decodeURIComponent(rawSlug);
  } catch {
    decodedSlug = rawSlug;
  }

  const safeSlug = createBrandSlug(decodedSlug);

  if (!safeSlug) {
    return null;
  }

  const readableName = decodedSlug
    .replace(/-/g, ' ')
    .trim();

  const candidates = Array.from(
    new Set([
      readableName,
      decodedSlug,
      readableName.replace(/\band\b/gi, '&'),
    ]),
  ).filter(Boolean);

  for (const candidate of candidates) {
    const {
      data,
      error,
      count,
    } = await supabaseAdmin
      .from(PRODUCTS_TABLE)
      .select('brand', {
        count: 'exact',
      })
      .eq('is_active', true)
      .neq('catalog_visible', false)
      .ilike('brand', candidate)
      .limit(1);

    if (error) {
      throw new Error(
        `Unable to load brand: ${error.message}`,
      );
    }

    const brandName =
      typeof data?.[0]?.brand === 'string'
        ? data[0].brand.trim()
        : '';

    if (
      brandName &&
      createBrandSlug(brandName) === safeSlug
    ) {
      return {
        name: brandName,
        slug: safeSlug,
        productCount: count ?? 0,
      };
    }
  }

  const anchorWord = safeSlug
    .split('-')
    .filter(Boolean)
    .sort((first, second) => second.length - first.length)[0];

  if (!anchorWord) {
    return null;
  }

  const {
    data: possibleBrands,
    error: possibleBrandsError,
  } = await supabaseAdmin
    .from(PRODUCTS_TABLE)
    .select('brand')
    .eq('is_active', true)
    .neq('catalog_visible', false)
    .ilike('brand', `%${anchorWord}%`)
    .limit(500);

  if (possibleBrandsError) {
    throw new Error(
      `Unable to search brands: ${possibleBrandsError.message}`,
    );
  }

  const matchedBrandName = possibleBrands
    ?.map((item) =>
      typeof item.brand === 'string'
        ? item.brand.trim()
        : '',
    )
    .find(
      (brandName) =>
        brandName &&
        createBrandSlug(brandName) === safeSlug,
    );

  if (!matchedBrandName) {
    return null;
  }

  const {
    count,
    error: countError,
  } = await supabaseAdmin
    .from(PRODUCTS_TABLE)
    .select('id', {
      count: 'exact',
      head: true,
    })
    .eq('is_active', true)
    .neq('catalog_visible', false)
    .eq('brand', matchedBrandName);

  if (countError) {
    throw new Error(
      `Unable to count brand products: ${countError.message}`,
    );
  }

  return {
    name: matchedBrandName,
    slug: safeSlug,
    productCount: count ?? 0,
  };
}
