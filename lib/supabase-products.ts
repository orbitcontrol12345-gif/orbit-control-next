import type { Product } from '@/lib/types';
import { supabaseAdmin } from '@/lib/supabase-admin';

const PRODUCTS_TABLE = 'products';

type ProductSortOption = 'relevance' | 'name' | 'brand' | 'condition';

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
    partNumber: item.part_number || 'UNKNOWN',
    name: cleanProductName(item.name || ''),
    category: item.category || 'Industrial Parts',
    condition: item.condition || 'Used',
    inStock: item.is_active !== false,
    description: item.description || item.name || '',
    technicalSpecs: {},
    imageUrl: bestImage,
    r2ImageUrl: item.r2_image_url || null,
    r2GalleryUrls: item.r2_gallery_urls || [],
    ebayGalleryUrls: item.ebay_gallery_urls || [],
    tags: [
      item.sku,
      item.part_number,
      item.brand,
      item.category,
      item.name,
    ].filter(Boolean),
    slug:
      item.slug ||
      item.sku ||
      item.ebay_item_id ||
      String(item.id),
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

export async function getSupabaseProductsPage({
  search = '',
  brand = '',
  category = '',
  condition = '',
  inStockOnly = false,
  sort = 'relevance',
  page = 1,
  perPage = 24,
}: {
  search?: string;
  brand?: string;
  category?: string;
  condition?: string;
  inStockOnly?: boolean;
  sort?: ProductSortOption;
  page?: number;
  perPage?: number;
}) {
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
    .select('*', { count: 'exact' })
    .eq('is_active', true)
    .neq('catalog_visible', false);

  if (cleanSearch) {
    query = query.or(
      [
        `name.ilike.%${cleanSearch}%`,
        `sku.ilike.%${cleanSearch}%`,
        `part_number.ilike.%${cleanSearch}%`,
        `brand.ilike.%${cleanSearch}%`,
        `category.ilike.%${cleanSearch}%`,
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
    products: (data || []).map(mapSupabaseProduct),
    totalProducts,
    totalPages: Math.max(
      1,
      Math.ceil(totalProducts / safePerPage),
    ),
  };
}

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
    .select('*', { count: 'exact' })
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
    products: (data || []).map(mapSupabaseProduct),
    totalProducts,
    totalPages: Math.max(
      1,
      Math.ceil(totalProducts / safePerPage),
    ),
  };
}

export async function getSupabaseProductBySlug(
  slug: string,
): Promise<Product | null> {
  const decodedSlug = decodeURIComponent(slug);

  let { data, error } = await supabaseAdmin
    .from(PRODUCTS_TABLE)
    .select('*')
    .eq('slug', decodedSlug)
    .eq('is_active', true)
    .neq('catalog_visible', false)
    .maybeSingle();

  if (!data) {
    const { data: fallback, error: fallbackError } =
      await supabaseAdmin
        .from(PRODUCTS_TABLE)
        .select('*')
        .eq('is_active', true)
        .neq('catalog_visible', false)
        .or(
          [
            `slug.eq.${decodedSlug}`,
            `sku.eq.${decodedSlug}`,
            `ebay_item_id.eq.${decodedSlug}`,
            `part_number.eq.${decodedSlug}`,
            `model_number.eq.${decodedSlug}`,
          ].join(','),
        )
        .limit(1)
        .maybeSingle();

    data = fallback;
    error = fallbackError;
  }

  if (error || !data) {
    return null;
  }

  return mapSupabaseProduct(data);
}

export async function getSupabaseRelatedProducts(
  product: Product,
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
    .select('*')
    .eq('is_active', true)
    .neq('catalog_visible', false)
    .or(relatedFilters)
    .limit(12);

  if (product.sku) {
    query = query.neq('sku', product.sku);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Related products query failed:', error);
    return [];
  }

  return (data || [])
    .map(mapSupabaseProduct)
    .filter(
      (item) =>
        item.imageUrl &&
        item.imageUrl !== '/placeholder-product.jpg',
    )
    .slice(0, 4);
}
