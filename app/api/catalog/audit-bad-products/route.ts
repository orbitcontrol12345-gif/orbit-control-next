import { NextRequest, NextResponse } from 'next/server';

import { supabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

type ProductRow = {
  id: string | number;
  ebay_item_id: string | null;
  sku: string | null;
  name: string | null;
  description: string | null;
  brand: string | null;
  part_number: string | null;
};

function normalizeText(value: unknown): string {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

function findProblems(product: ProductRow): string[] {
  const problems: string[] = [];

  const name = normalizeText(product.name);
  const description = normalizeText(product.description);
  const partNumber = normalizeText(product.part_number);
  const brand = normalizeText(product.brand);

  const nameLower = name.toLowerCase();
  const descriptionLower = description.toLowerCase();

  if (!name) {
    problems.push('missing_name');
  }

  if (
    nameLower.includes('reply as soon') ||
    nameLower.includes('not included in the item price')
  ) {
    problems.push('corrupted_name');
  }

  if (
    nameLower.includes('without box') ||
    nameLower.includes('no box') ||
    nameLower.includes('missing cover') ||
    nameLower.includes('broken cover') ||
    nameLower.includes('shipping worldwide') ||
    nameLower.includes('worldwide shipping')
  ) {
    problems.push('dirty_name');
  }

  if (
    /^lot\s+\d+/i.test(name) ||
    /^\d+\s+(pcs?|pieces?|units?)/i.test(name) ||
    /^qty\s*[:#-]?\s*\d+/i.test(name)
  ) {
    problems.push('quantity_in_name');
  }

  if (!description) {
    problems.push('missing_description');
  }

  if (
    descriptionLower.includes('reply as soon') ||
    descriptionLower.includes('not included in the item price')
  ) {
    problems.push('corrupted_description');
  }

  if (
    descriptionLower.includes('<div') ||
    descriptionLower.includes('<span') ||
    descriptionLower.includes('<font') ||
    descriptionLower.includes('<p') ||
    descriptionLower.includes('\\u003c') ||
    descriptionLower.includes('&nbsp;') ||
    descriptionLower.includes('msonormal') ||
    descriptionLower.includes('font-family')
  ) {
    problems.push('html_in_description');
  }

  if (
    descriptionLower.includes('shipping worldwide') ||
    descriptionLower.includes('worldwide shipping') ||
    descriptionLower.includes('payment policy') ||
    descriptionLower.includes('shipping policy') ||
    descriptionLower.includes('feedback') ||
    descriptionLower.includes('buyers are responsible')
  ) {
    problems.push('seller_policy_in_description');
  }

  if (!partNumber) {
    problems.push('missing_part_number');
  }

  if (
    partNumber &&
    /^\d{10,15}$/.test(partNumber)
  ) {
    problems.push('part_number_looks_like_ebay_id');
  }

  if (!brand || brand.toLowerCase() === 'unknown') {
    problems.push('missing_or_unknown_brand');
  }

  return problems;
}

export async function GET(request: NextRequest) {
  try {
    const requestedLimit = Number(
      request.nextUrl.searchParams.get('limit') ||
        DEFAULT_LIMIT
    );

    const offset = Math.max(
      0,
      Number(
        request.nextUrl.searchParams.get('offset') || 0
      )
    );

    const limit = Math.max(
      1,
      Math.min(
        Number.isFinite(requestedLimit)
          ? Math.floor(requestedLimit)
          : DEFAULT_LIMIT,
        MAX_LIMIT
      )
    );

    const { data, error } = await supabaseAdmin
      .from('products')
      .select(
        `
          id,
          ebay_item_id,
          sku,
          name,
          description,
          brand,
          part_number
        `
      )
      .order('id', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) {
      throw error;
    }

    const rows = (data ?? []) as ProductRow[];

    const suspicious = rows
      .map((product) => ({
        id: product.id,
        ebay_item_id: product.ebay_item_id,
        sku: product.sku,
        name: product.name,
        brand: product.brand,
        part_number: product.part_number,
        problems: findProblems(product),
      }))
      .filter((product) => product.problems.length > 0);

    return NextResponse.json({
      success: true,
      mode: 'audit-only',
      safety: {
        updatesDatabase: false,
      },
      batch: {
        offset,
        limit,
        scanned: rows.length,
        suspicious: suspicious.length,
        nextOffset:
          rows.length < limit
            ? null
            : offset + rows.length,
      },
      summary: suspicious.reduce<Record<string, number>>(
        (accumulator, product) => {
          for (const problem of product.problems) {
            accumulator[problem] =
              (accumulator[problem] || 0) + 1;
          }

          return accumulator;
        },
        {}
      ),
      results: suspicious,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      {
        status: 500,
      }
    );
  }
}
