import { NextResponse } from 'next/server';
import { cleanTitle } from '@/app/api/ebay/process-queue/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const title = searchParams.get('title') || '';

  const cleanedTitle = cleanTitle(title);

  return NextResponse.json({
    success: true,
    originalTitle: title,
    cleanedTitle,
  });
}
