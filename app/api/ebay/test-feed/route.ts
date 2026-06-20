import { NextResponse } from 'next/server';
import { getEbayToken } from '@/lib/ebay';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const token = await getEbayToken();
    const accessToken = String(token.access_token).trim();

    const response = await fetch(
      'https://api.ebay.com/sell/feed/v1/inventory_task',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Accept-Language': 'en-US',
        },
        body: JSON.stringify({
          feedType: 'LMS_ACTIVE_INVENTORY_REPORT',
          schemaVersion: '1.0',
        }),
      }
    );

    const text = await response.text();

    return NextResponse.json({
      success: response.ok,
      status: response.status,
      location: response.headers.get('location'),
      raw: text,
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
    });
  }
}
