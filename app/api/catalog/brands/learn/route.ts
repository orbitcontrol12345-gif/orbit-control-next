import { NextResponse } from 'next/server';
import { brandEngine } from '@/lib/catalog/brands/engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const result = await brandEngine.learn();

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unknown error',
      },
      {
        status: 500,
      },
    );
  }
}
