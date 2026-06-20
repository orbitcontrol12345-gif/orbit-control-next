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
  `https://api.ebay.com/sell/feed/v1/task/${taskId}/download_result_file`,
  {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Accept-Language': 'en-US',
    },
  }
);

    const text = await response.text();

    return NextResponse.json({
      success: response.ok,
      status: response.status,
      preview: text.substring(0, 3000),
      length: text.length,
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
    });
  }
}
