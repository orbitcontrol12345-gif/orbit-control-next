import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('ebay_sync_state')
    .select('current_offset')
    .eq('id', 1)
    .single();

  if (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    current_offset: data.current_offset || 0,
  });
}

export async function POST(request: Request) {
  const body = await request.json();

  const currentOffset = Number(body.current_offset || 0);

  const { error } = await supabaseAdmin
    .from('ebay_sync_state')
    .update({
      current_offset: currentOffset,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 1);

  if (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    current_offset: currentOffset,
  });
}
