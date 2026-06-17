import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { extractPartNumberFromTitle } from '@/lib/part-number-cleaner';

const BATCH_SIZE = 1000;

function cleanValue(value?: string | null) {
  return value?.trim() || null;
}

function isBadPartNumber(value?: string | null) {
  const text = value?.trim().replace(/\s+/g, '') || '';

  if (!text) return true;

  if (/^v\d+\|\d+\|\d+$/i.test(text)) return true;
  if (/^\d{10,}$/.test(text)) return true;

  const electricalOnly = [
    /^0-10V$/i,
    /^0-5V$/i,
    /^1-5V$/i,
    /^4-20MA$/i,
    /^20MA$/i,
    /^\d+VDC$/i,
    /^\d+VAC$/i,
    /^\d+-\d+VDC$/i,
    /^\d+-\d+VAC$/i,
    /^\d+(\.\d+)?A$/i,
    /^\d+HZ$/i,
  ];

  if (electricalOnly.some((regex) => regex.test(text))) {
    return true;
  }

  return false;
}

function chooseBestPartNumber(product: {
  name: string | null;
  model_number: string | null;
  mpn: string | null;
}) {
  const modelNumber = cleanValue(product.model_number);
  const mpn = cleanValue(product.mpn);
  const extractedFromTitle = extractPartNumberFromTitle(product.name || '');

  const newPartNumber =
    modelNumber ||
    mpn ||
    extractedFromTitle;

  const newModelNumber =
    modelNumber ||
    extractedFromTitle ||
    null;

  return {
    newPartNumber,
    newModelNumber,
    extractedFromTitle,
  };
}

export async function GET(request: Request) {
  const page = Number(
    new URL(request.url).searchParams.get('page') || '1'
  );

  const safePage = Number.isFinite(page) && page > 0 ? page : 1;

  const from = (safePage - 1) * BATCH_SIZE;
  const to = from + BATCH_SIZE - 1;

  const { data, error } = await supabaseAdmin
    .from('products')
    .select('id,name,part_number,model_number,mpn,sku')
    .order('id', { ascending: true })
    .range(from, to);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results = [];

  for (const product of data || []) {
    const currentPartNumber = cleanValue(product.part_number);

    if (!isBadPartNumber(currentPartNumber)) {
      results.push({
        id: product.id,
        status: 'skipped_good_part_number',
        current: currentPartNumber,
      });
      continue;
    }

    const {
      newPartNumber,
      newModelNumber,
      extractedFromTitle,
    } = chooseBestPartNumber(product);

    if (!newPartNumber) {
      results.push({
        id: product.id,
        status: 'no_part_number_found',
        title: product.name,
      });
      continue;
    }

    const updatePayload = {
      part_number: newPartNumber,
      model_number: newModelNumber,
    };

    const { error: updateError } = await supabaseAdmin
      .from('products')
      .update(updatePayload)
      .eq('id', product.id);

    results.push({
      id: product.id,
      status: updateError ? 'update_failed' : 'updated',
      oldPartNumber: currentPartNumber,
      newPartNumber,
      newModelNumber,
      extractedFromTitle,
      title: product.name,
      error: updateError?.message || null,
    });
  }

  return NextResponse.json({
    page: safePage,
    from,
    to,
    limit: BATCH_SIZE,
    processed: results.length,
    results,
  });
}
