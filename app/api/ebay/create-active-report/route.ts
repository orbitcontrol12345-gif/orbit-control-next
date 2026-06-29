import { NextResponse } from 'next/server';
import { getEbayToken } from '@/lib/ebay';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const { access_token } = await getEbayToken();

    const response = await fetch(
      'https://api.ebay.com/sell/feed/v1/inventory_task',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${access_token}`,
          'Content-Type': 'application/json',
          'Accept-Language': 'en-US',
        },
        body: JSON.stringify({
          feedType: 'LMS_ACTIVE_INVENTORY_REPORT',
          schemaVersion: '1.0',
        }),
      }
    );

    const location = response.headers.get('location');

    let taskId: string | null = null;

    if (location) {
      taskId = location.split('/').pop() ?? null;
    }

    const body =
      response.status === 204
        ? null
        : await response.json().catch(() => null);

    return NextResponse.json({
      success: response.ok,
      status: response.status,
      taskId,
      location,
      body,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err.message,
      },
      { status: 500 }
    );
  }
}
