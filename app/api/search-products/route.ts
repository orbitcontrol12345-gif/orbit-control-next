import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseProductsPage } from '@/lib/supabase-products';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim() || '';

  if (q.length < 2) {
    return NextResponse.json([]);
  }

  const { products } = await getSupabaseProductsPage({
    search: q,
    page: 1,
    perPage: 8,
  });

  const results = products.map((product) => ({
    id: product.id,
    name: product.name,
    slug: product.slug,
    brand: product.brand,
    category: product.category,
    partNumber: product.partNumber,
    imageUrl: product.imageUrl,
    inStock: product.inStock,
  }));

  return NextResponse.json(results);
}
