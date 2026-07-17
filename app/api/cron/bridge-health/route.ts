import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  'https://orbit-control-next.vercel.app'
).replace(/\/$/, '');

export async function GET(request: NextRequest) {
  try {
    const authorization = request.headers.get('authorization');

    if (
      process.env.CRON_SECRET &&
      authorization !== `Bearer ${process.env.CRON_SECRET}`
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized',
        },
        {
          status: 401,
        }
      );
    }

    const response = await fetch(
      `${SITE_URL}/api/migration/bridge-health?limit=100`,
      {
        method: 'GET',
        cache: 'no-store',
        headers: {
          'User-Agent': 'Orbit-Control-Bridge-Health-Cron/1.0',
        },
      }
    );

    const data = await response.json().catch(() => null);

    return NextResponse.json(
      {
        success: response.ok,
        cron: 'bridge-health',
        bridgeHealthStatus: response.status,
        data,
      },
      {
        status: response.ok ? 200 : response.status,
      }
    );
  } catch (error) {
    console.error('BRIDGE HEALTH CRON ERROR:', error);

    return NextResponse.json(
      {
        success: false,
        cron: 'bridge-health',
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      {
        status: 500,
      }
    );
  }
}
