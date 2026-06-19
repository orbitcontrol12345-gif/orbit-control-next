import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  if (error) {
    return NextResponse.json({ success: false, error });
  }

  if (!code) {
    return NextResponse.json({ success: false, message: 'No code received' });
  }

  const clientId = process.env.EBAY_CLIENT_ID;
  const clientSecret = process.env.EBAY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.json({
      success: false,
      error: 'Missing EBAY_CLIENT_ID or EBAY_CLIENT_SECRET',
    });
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: 'Continue_to_Cre-Continue-Xeltro-mxfsgy',
  });

  const response = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  const data = await response.json();

  return NextResponse.json({
    success: response.ok,
    status: response.status,
    data,
  });
}
