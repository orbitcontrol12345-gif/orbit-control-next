import type { Product } from '@/lib/types';
import { supabaseAdmin } from '@/lib/supabase-admin';

const PRODUCTS_TABLE = 'products';

function cleanProductName(name: string) {
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
  item.r2_image_url ||
  (Array.isArray(item.r2_gallery_urls) ? item.r2_gallery_urls[0] : null) ||
  item.ebay_image_url ||
  item.image_url ||
  (Array.isArray(item.ebay_gallery_urls) ? item.ebay_gallery_urls[0] : null) ||
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
    tags: [item.sku, item.part_number, item.brand, item.category, item.name].filter(Boolean),
    slug: item.slug || item.sku || item.ebay_item_id || String(item.id),
  };
}

export async function getSupabaseProductsPage({
  search = '',
  page = 1,
  perPage = 24,
}: {
  search?: string;
  page?: number;
  perPage?: number;
}) {
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  let query = supabaseAdmin
    .from(PRODUCTS_TABLE)
    .select('*', { count: 'exact' })
    .eq('is_active', true)
    .neq('catalog_visible', false)
    .order('id', { ascending: false })
    .range(from, to);

  if (search) {
    query = query.or(
      `name.ilike.%${search}%,sku.ilike.%${search}%,part_number.ilike.%${search}%,brand.ilike.%${search}%,category.ilike.%${search}%`
    );
  }

  const { data, count, error } = await query;

  if (error) return { products: [], totalProducts: 0, totalPages: 0 };

  return {
    products: (data || []).map(mapSupabaseProduct),
    totalProducts: count || 0,
    totalPages: Math.max(1, Math.ceil((count || 0) / perPage)),
  };
}

export async function getSupabaseProductsByCategoryTerms({
  terms,
  page = 1,
  perPage = 24,
}: {
  terms: string[];
  page?: number;
  perPage?: number;
}) {
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  const filters = terms
    .map((term) => `category.ilike.%${term}%,name.ilike.%${term}%`)
    .join(',');

  const { data, count, error } = await supabaseAdmin
    .from(PRODUCTS_TABLE)
    .select('*', { count: 'exact' })
    .eq('is_active', true)
    .neq('catalog_visible', false)
    .or(filters)
   .order('id', { ascending: true })
    .range(from, to);

  if (error) return { products: [], totalProducts: 0, totalPages: 0 };

  return {
    products: (data || []).map(mapSupabaseProduct),
    totalProducts: count || 0,
    totalPages: Math.max(1, Math.ceil((count || 0) / perPage)),
  };
}

export async function getSupabaseProductBySlug(slug: string): Promise<Product | null> {
  const decodedSlug = decodeURIComponent(slug);

  let { data, error } = await supabaseAdmin
    .from(PRODUCTS_TABLE)
    .select('*')
    .eq('slug', decodedSlug)
    .eq('is_active', true)
    .neq('catalog_visible', false)
    .maybeSingle();

  if (!data) {
    const { data: fallback } = await supabaseAdmin
      .from(PRODUCTS_TABLE)
      .select('*')
      .eq('is_active', true)
      .neq('catalog_visible', false)
      .or(
        `slug.eq.${decodedSlug},sku.eq.${decodedSlug},ebay_item_id.eq.${decodedSlug},part_number.eq.${decodedSlug},model_number.eq.${decodedSlug}`
      )
      .limit(1)
      .maybeSingle();

    data = fallback;
  }

  if (error || !data) return null;

  return mapSupabaseProduct(data);
}

export async function getSupabaseRelatedProducts(product: Product): Promise<Product[]> {
  const { data, error } = await supabaseAdmin
    .from(PRODUCTS_TABLE)
    .select('*')
    .eq('is_active', true)
    .neq('catalog_visible', false)
    .not('r2_image_url', 'is', null)
    .or(`brand.eq.${product.brand},category.eq.${product.category}`)
    .neq('sku', product.sku)
    .limit(4);

  if (error) return [];

  return (data || []).map(mapSupabaseProduct);
}
