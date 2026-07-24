import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

type ProductMatch = {
  slug: string;
  part_number: string | null;
  model_number: string | null;
};

function normalizeValue(value: string): string {
  return value
    .toUpperCase()
    .replace(/%20/g, '-')
    .replace(/_/g, '-')
    .replace(/[^A-Z0-9]/g, '');
}

function getCandidates(oldSlug: string): string[] {
  const decodedSlug = decodeURIComponent(oldSlug).toUpperCase();

  const ignoredWords = new Set([
    'NEW',
    'USED',
    'REFURBISHED',
    'SELLER',
    'WITHOUT',
    'WITH',
    'BOX',
    'NIB',
    'LOT',
    'PCS',
    'PC',
    'PIECE',
    'PIECES',
    'MODULE',
    'CONTROLLER',
    'CONTROL',
    'BOARD',
    'SYSTEM',
    'ELECTRIC',
    'HARDWARE',
    'REV',
    'DELAY',
    'TIMER',
    'TOOL',
    'VALVE',
    'LOCKING',
  ]);

  const rawParts = decodedSlug
    .split(/[^A-Z0-9_.-]+/)
    .flatMap((part) => part.split('-'))
    .map((part) => part.trim())
    .filter(Boolean);

  const candidates = rawParts
    .filter((part) => {
      if (ignoredWords.has(part)) return false;
      if (part.length < 4) return false;

      // يجب أن يحتوي المرشح على رقم واحد على الأقل
      return /\d/.test(part);
    })
    .sort((a, b) => b.length - a.length);

  // إضافة مجموعات مركبة مثل CEPL130203-02 أو 6010-2XX02-1SF0
  const compoundMatches =
    decodedSlug.match(/[A-Z0-9]+(?:[-_.][A-Z0-9]+)+/g) || [];

  return Array.from(
    new Set([...compoundMatches, ...candidates].map(normalizeValue))
  ).filter((candidate) => candidate.length >= 4);
}

async function findProduct(
  candidates: string[]
): Promise<ProductMatch | null> {
  for (const candidate of candidates) {
    const searchForms = Array.from(
      new Set([
        candidate,
        candidate.replace(/-/g, ''),
        candidate.replace(/_/g, ''),
        candidate.replace(/\./g, ''),
      ])
    );

    for (const searchValue of searchForms) {
      const { data, error } = await supabase
        .from('products')
        .select('slug, part_number, model_number')
        .eq('marketplace', 'EBAY_US')
        .eq('catalog_visible', true)
        .or(
          `part_number.ilike.%${searchValue}%,model_number.ilike.%${searchValue}%`
        )
        .limit(5);

      if (error || !data?.length) continue;

      const exactMatches = data.filter((product) => {
        const partNumber = normalizeValue(product.part_number || '');
        const modelNumber = normalizeValue(product.model_number || '');

        return partNumber === candidate || modelNumber === candidate;
      });

      if (exactMatches.length === 1) {
        return exactMatches[0];
      }

      // نقبل نتيجة واحدة فقط، لمنع التحويل إلى منتج خاطئ
      if (data.length === 1) {
        const product = data[0];
        const partNumber = normalizeValue(product.part_number || '');
        const modelNumber = normalizeValue(product.model_number || '');

        if (
          partNumber.includes(candidate) ||
          modelNumber.includes(candidate) ||
          candidate.includes(partNumber) ||
          candidate.includes(modelNumber)
        ) {
          return product;
        }
      }
    }
  }

  return null;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ oldSlug: string }> }
) {
  const { oldSlug } = await context.params;

  const cleanSlug = oldSlug.replace(/\/+$/, '');
  const candidates = getCandidates(cleanSlug);
  const product = await findProduct(candidates);

  if (product?.slug) {
    const destination = new URL(`/products/${product.slug}`, request.url);

    return NextResponse.redirect(destination, {
      status: 301,
    });
  }

  const fallbackQuery = candidates[0] || cleanSlug;
  const searchUrl = new URL('/search', request.url);
  searchUrl.searchParams.set('q', fallbackQuery);

  return NextResponse.redirect(searchUrl, {
    status: 302,
  });
}
