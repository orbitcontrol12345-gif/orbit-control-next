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

  return NextResponse.json({
    success: true,
    message: 'Copy this authorization code',
    code,
  });
}
