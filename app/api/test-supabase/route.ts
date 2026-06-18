import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';

  const { data, error } = await supabaseAdmin
    .from('products_test')
    .select('id')
    .limit(1);

  return NextResponse.json({
    supabaseUrl: url,
    success: !error,
    error,
    data,
  });
}
