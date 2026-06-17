import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { extractPartNumberFromTitle } from '@/lib/part-number-cleaner';

async function handler() {
  const { data, error } = await supabaseAdmin
    .from('products')
    .select('id,name,part_number')
    .limit(1000)

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  const results = [];

  for (const product of data || []) {
    const partNumber = extractPartNumberFromTitle(product.name);

    results.push({
      id: product.id,
      title: product.name,
      oldPartNumber: product.part_number,
      extractedPartNumber: partNumber,
    });
  }

  return NextResponse.json({
    count: results.length,
    results,
  });
}

export async function GET() {
  return handler();
}

export async function POST() {
  return handler();
}
