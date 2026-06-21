import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    success: false,
    message: 'Disabled. This route was generating incomplete products.',
  }, { status: 410 });
}
