import { NextResponse } from 'next/server';
import { getEbayToken } from '@/lib/ebay';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const token = await getEbayToken();
  const accessToken = String(token.access_token).trim();

  const res = await fetch('https://api.ebay.com/sell/feed/v1/inventory_task', {
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
  });

  const location = res.headers.get('location');
  const taskId = location?.split('/').pop();

  if (!res.ok || !taskId) {
    return NextResponse.json(
      {
        success: false,
        status: res.status,
        error: await res.text(),
      },
      { status: 500 }
    );
  }

  await supabaseAdmin
    .from('ebay_sync_state')
    .upsert({
      id: 'active_inventory',
      task_id: taskId,
      status: 'created',
      offset_value: 0,
      updated_at: new Date().toISOString(),
    });

  return NextResponse.json({
    success: true,
    taskId,
    location,
  });
}
