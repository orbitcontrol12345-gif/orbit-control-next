import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const baseUrl = process.env.WOOCOMMERCE_BASE_URL;
  const key = process.env.WOOCOMMERCE_CONSUMER_KEY;
  const secret = process.env.WOOCOMMERCE_CONSUMER_SECRET;

  if (!baseUrl || !key || !secret) {
    return NextResponse.json({ error: 'Missing WooCommerce env variables' }, { status: 500 });
  }

  const auth = Buffer.from(`${key}:${secret}`).toString('base64');
  const url = `${baseUrl}/wp-json/wc/v3/products?per_page=3&status=publish`;

  const res = await fetch(url, {
    headers: { Authorization: `Basic ${auth}` },
    cache: 'no-store',
  });

  const text = await res.text();

  return NextResponse.json({
    status: res.status,
    ok: res.ok,
    preview: text.slice(0, 500),
  });
}
