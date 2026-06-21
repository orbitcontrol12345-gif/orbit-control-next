import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json(
    {
      success: false,
      disabled: true,
      message:
        'Disabled for safety. Feed basic import creates incomplete products and must not write to products table.',
    },
    { status: 410 }
  );
}
