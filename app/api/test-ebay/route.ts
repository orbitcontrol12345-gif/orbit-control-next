import { NextResponse } from 'next/server';
import { getEbayToken } from '@/lib/ebay';

export async function GET() {
  const token = await getEbayToken();

  return NextResponse.json(token);
}
