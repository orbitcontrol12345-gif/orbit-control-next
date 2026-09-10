import { NextResponse } from 'next/server';
import { z } from 'zod';

import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const RFQ_COLUMNS = [
  'id',
  'name',
  'company',
  'email',
  'phone',
  'country',
  'part_number',
  'quantity',
  'message',
  'status',
  'created_at',
].join(',');

const SURPLUS_COLUMNS = [
  'id',
  'company',
  'contact_person',
  'email',
  'phone',
  'country',
  'brand',
  'part_numbers',
  'quantity',
  'condition',
  'message',
  'status',
  'created_at',
].join(',');

const updateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['pending', 'reviewed', 'quoted', 'closed']),
});

export async function GET() {
  const [rfqResult, surplusResult] = await Promise.all([
    supabaseAdmin
      .from('rfq_requests')
      .select(RFQ_COLUMNS)
      .order('created_at', { ascending: false })
      .limit(500),
    supabaseAdmin
      .from('sell_surplus_requests')
      .select(SURPLUS_COLUMNS)
      .order('created_at', { ascending: false })
      .limit(500),
  ]);

  if (rfqResult.error || surplusResult.error) {
    console.error('ADMIN REQUEST LIST ERROR', {
      rfq: rfqResult.error?.message,
      surplus: surplusResult.error?.message,
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Unable to load requests',
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    rfqs: rfqResult.data || [],
    surplusRequests: surplusResult.data || [],
  });
}

export async function PATCH(request: Request) {
  let input: unknown;

  try {
    input = await request.json();
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: 'A valid JSON body is required',
      },
      { status: 400 },
    );
  }

  const parsed = updateSchema.safeParse(input);

  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: 'Invalid request update',
      },
      { status: 400 },
    );
  }

  const { data, error } = await supabaseAdmin
    .from('rfq_requests')
    .update({ status: parsed.data.status })
    .eq('id', parsed.data.id)
    .select('id,status')
    .maybeSingle();

  if (error) {
    console.error('ADMIN REQUEST UPDATE ERROR:', error.message);

    return NextResponse.json(
      {
        success: false,
        error: 'Unable to update request',
      },
      { status: 500 },
    );
  }

  if (!data) {
    return NextResponse.json(
      {
        success: false,
        error: 'Request not found',
      },
      { status: 404 },
    );
  }

  return NextResponse.json({
    success: true,
    request: data,
  });
}
