import { NextResponse } from 'next/server';
import { getEbayToken } from '@/lib/ebay';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const token = await getEbayToken();

    return NextResponse.json({
      success: true,
      hasAccessToken: Boolean(token.access_token),
      tokenType: token.token_type,
      expiresIn: token.expires_in,
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
    });
  }
}
