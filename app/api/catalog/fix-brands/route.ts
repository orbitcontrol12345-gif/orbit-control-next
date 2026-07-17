import { NextRequest, NextResponse } from 'next/server';
import { runFixBrands } from '../run-fix-brands';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);

    const data = await runFixBrands({
      offset: Number(url.searchParams.get('offset') || 0),
      ebayItemId: url.searchParams.get('ebay_item_id') || '',
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error('FIX BRANDS ROUTE ERROR:', error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}
