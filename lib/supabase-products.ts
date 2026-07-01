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
  return {
    id: String(item.id),
    sku: item.sku || '',
    brand: item.brand || 'Unknown',
    partNumber: item.part_number || item.sku || '',
    name: cleanProductName(item.name || ''),
    category: item.category || 'Industrial Parts',
    condition: item.condition || 'Used',
    inStock: item.is_active !== false,
    description: item.description || item.name || '',
    technicalSpecs: {},
    imageUrl: item.image_url || '/placeholder-product.jpg',
    tags: [item.sku, item.part_number, item.brand, item.category, item.name].filter(Boolean),
    slug: item.slug || item.sku || item.ebay_item_id || String(item.id),
  };
}

function getDedupKey(item: any) {
  const brand = String(item.brand || '').trim().toUpperCase();
  const part = String(item.part_number || item.model_number || item.sku || '').trim().toUpperCase();
  const condition = String(item.condition || '').trim().toUpperCase();

  if (!part) return `ID:${item.id}`;

  return `${brand || 'UNKNOWN'}::${part}::${condition || 'UNKNOWN'}`;
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
  let query = supabaseAdmin
    .from(PRODUCTS_TABLE)
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (search) {
    query = query.or(
      `name.ilike.%${search}%,sku.ilike.%${search}%,part_number.ilike.%${search}%,brand.ilike.%${search}%,category.ilike.%${search}%`
    );
  }

  const { data, error } = await query;

  if (error) {
    return { products: [], totalProducts: 0, totalPages: 0 };
  }

  const seen = new Set<string>();
  const uniqueProducts: any[] = [];

  for (const item of data || []) {
    const key = getDedupKey(item);

    if (seen.has(key)) continue;

    seen.add(key);
    uniqueProducts.push(item);
  }

  const totalProducts = uniqueProducts.length;
  const totalPages = Math.max(1, Math.ceil(totalProducts / perPage));

  const from = (page - 1) * perPage;
  const pagedProducts = uniqueProducts.slice(from, from + perPage);

  return {
    products: pagedProducts.map(mapSupabaseProduct),
    totalProducts,
    totalPages,
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
    .maybeSingle();

  if (!data) {
    const { data: fallback } = await supabaseAdmin
      .from(PRODUCTS_TABLE)
      .select('*')
      .eq('is_active', true)
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
    .or(`brand.eq.${product.brand},category.eq.${product.category}`)
    .neq('sku', product.sku)
    .limit(4);

  if (error) return [];

  return (data || []).map(mapSupabaseProduct);
}
