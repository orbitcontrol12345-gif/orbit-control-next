import type { Product } from '@/lib/types';
import { supabaseAdmin } from '@/lib/supabase-admin';
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
    inStock: true,
    description: item.description || item.name || '',
    technicalSpecs: {},
    imageUrl: item.image_url || '/placeholder-product.jpg',
    tags: [
      item.sku,
      item.part_number,
      item.brand,
      item.category,
      item.name,
    ].filter(Boolean),
    slug: item.slug || String(item.id),
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
    .from('products_test')
    .select('*', { count: 'exact' })
    .order('id', { ascending: true })
    .range(from, to);

  if (search) {
    query = query.or(
  `name.ilike.%${search}%,sku.ilike.%${search}%,part_number.ilike.%${search}%,brand.ilike.%${search}%,category.ilike.%${search}%`
);
  }

  const { data, count, error } = await query;

  if (error) {
    return { products: [], totalProducts: 0, totalPages: 0 };
  }

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
    .from('products')
    .select('*', { count: 'exact' })
    .or(filters)
    .order('id', { ascending: true })
    .range(from, to);

  if (error) {
    return { products: [], totalProducts: 0, totalPages: 0 };
  }

  return {
    products: (data || []).map(mapSupabaseProduct),
    totalProducts: count || 0,
    totalPages: Math.max(1, Math.ceil((count || 0) / perPage)),
  };
}
export async function getSupabaseProductBySlug(slug: string): Promise<Product | null> {
  const decodedSlug = decodeURIComponent(slug);

  let { data, error } = await supabaseAdmin
    .from('products')
    .select('*')
    .eq('slug', decodedSlug)
    .maybeSingle();

  if (!data) {
    const { data: fallback } = await supabaseAdmin
      .from('products')
      .select('*')
      .or(
        `slug.ilike.%${decodedSlug}%,sku.eq.${decodedSlug},ebay_item_id.eq.${decodedSlug},part_number.eq.${decodedSlug}`
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
    .from('products')
    .select('*')
    .or(`brand.eq.${product.brand},category.eq.${product.category}`)
    .neq('slug', product.slug)
    .limit(4);

  if (error) return [];

  return (data || []).map(mapSupabaseProduct);
}
