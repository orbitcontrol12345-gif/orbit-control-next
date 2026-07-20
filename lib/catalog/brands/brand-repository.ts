import { supabaseAdmin } from '@/lib/supabase-admin';
import { normalizeBrand } from './promotion-filters';

export interface UnknownProduct {
  id: number;
  name: string;
  brand: string | null;
  part_number: string | null;
  model_number: string | null;
}

export interface RegistryBrand {
  id: number;
  canonical_brand: string;
  normalized_brand: string;
  status: string;
  product_count: number | null;
}

export async function loadUnknownProducts(limit = 5000) {
  const pageSize = 1000;
  const allProducts: UnknownProduct[] = [];

  let from = 0;

  while (allProducts.length < limit) {
    const to = from + pageSize - 1;

    const { data, error } = await supabaseAdmin
      .from('products')
      .select(`
        id,
        name,
        brand,
        part_number,
        model_number
      `)
      .or('brand.is.null,brand.eq.UNKNOWN')
      .order('id', { ascending: true })
      .range(from, to);

    if (error) throw error;

    const rows = (data ?? []) as UnknownProduct[];

    allProducts.push(...rows);

    if (rows.length < pageSize) {
      break;
    }

    from += pageSize;
  }

  return allProducts.slice(0, limit);
}

export async function loadRegistryBrands() {
  const pageSize = 1000;
  const allBrands: RegistryBrand[] = [];

  let from = 0;

  while (true) {
    const to = from + pageSize - 1;

    const { data, error } = await supabaseAdmin
      .from('brand_registry')
      .select('*')
      .order('id', { ascending: true })
      .range(from, to);

    if (error) throw error;

    const rows = (data ?? []) as RegistryBrand[];

    allBrands.push(...rows);

    if (rows.length < pageSize) {
      break;
    }

    from += pageSize;
  }

  return allBrands;
}

export async function insertRegistryBrand(
  canonicalBrand: string,
  normalizedBrand: string,
  productCount: number,
  source: string,
  metadata: Record<string, unknown>,
) {
  const { data, error } = await supabaseAdmin
    .from('brand_registry')
    .insert({
      canonical_brand: canonicalBrand,
      normalized_brand: normalizedBrand,
      status: 'active',
      product_count: productCount,
      source,
      metadata,
    })
    .select()
    .single();

  if (error) throw error;

  return data as RegistryBrand;
}

export async function insertEvidence(
  brandId: number,
  candidate: string,
  occurrenceCount: number,
  confidence: number,
) {
  const { error } = await supabaseAdmin
    .from('brand_evidence')
    .insert({
      brand_id: brandId,
      evidence_type: 'promotion-engine',
      evidence_value: candidate,
      normalized_value: normalizeBrand(candidate),
      occurrence_count: occurrenceCount,
      matching_brand_count: 1,
      conflicting_brand_count: 0,
      purity: 1,
      weight: confidence,
      status: 'active',
      source: 'promotion-engine',
      metadata: {},
    });

  if (error) throw error;
}
