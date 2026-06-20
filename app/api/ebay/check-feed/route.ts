import { NextResponse } from 'next/server';
import { getEbayToken } from '@/lib/ebay';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const taskId = 'task-20-27945426550787';

  try {
    const token = await getEbayToken();
    const accessToken = String(token.access_token).trim();

    const response = await fetch(
      `https://api.ebay.com/sell/feed/v1/task/${taskId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Accept-Language': 'en-US',
        },
      }
    );

    const data = await response.json();

    return NextResponse.json({
      success: response.ok,
      status: response.status,
      taskId,
      data,
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
    });
  }
}
