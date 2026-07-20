import { NextRequest, NextResponse } from 'next/server';
import { extractPartNumber } from '@/lib/part-number';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const title = String(
      req.nextUrl.searchParams.get('title') || ''
    ).trim();

    if (!title) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing title parameter',
          example:
            '/api/test-part-number?title=Bently Nevada P/N 125840-02 Proximitor Module',
        },
        { status: 400 }
      );
    }

    const partNumber = extractPartNumber(title);

    return NextResponse.json({
      success: true,
      title,
      partNumber: partNumber || 'UNKNOWN',
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}
