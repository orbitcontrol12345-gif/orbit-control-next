import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ROUTE_VERSION = 'MIGRATION-STATUS-V1';
const OLD_URL_TOTAL = 13156;

export async function GET() {
  try {
    const [
      bridgeCountResult,
      exactCountResult,
      strongCountResult,
      activeCountResult,
      enabledCountResult,
      bridgeJobResult,
    ] = await Promise.all([
      supabaseAdmin
        .from('migration_redirects')
        .select('*', {
          count: 'exact',
          head: true,
        }),

      supabaseAdmin
        .from('migration_redirects')
        .select('*', {
          count: 'exact',
          head: true,
        })
        .eq('match_level', 'EXACT_MATCH'),

      supabaseAdmin
        .from('migration_redirects')
        .select('*', {
          count: 'exact',
          head: true,
        })
        .eq('match_level', 'STRONG_MATCH'),

      supabaseAdmin
        .from('migration_redirects')
        .select('*', {
          count: 'exact',
          head: true,
        })
        .eq('is_active', true),

      supabaseAdmin
        .from('migration_redirects')
        .select('*', {
          count: 'exact',
          head: true,
        })
        .eq('redirect_enabled', true),

      supabaseAdmin
        .from('catalog_jobs')
        .select(`
          job_key,
          cursor_offset,
          last_processed,
          last_updated,
          last_unresolved,
          last_failed,
          last_rate_limited,
          updated_at
        `)
        .eq('job_key', 'migration-save-bridge')
        .single(),
    ]);

    const errors = [
      bridgeCountResult.error,
      exactCountResult.error,
      strongCountResult.error,
      activeCountResult.error,
      enabledCountResult.error,
      bridgeJobResult.error,
    ].filter(Boolean);

    if (errors.length > 0) {
      throw errors[0];
    }

    const savedBridgeRows = bridgeCountResult.count ?? 0;
    const exactMatches = exactCountResult.count ?? 0;
    const strongMatches = strongCountResult.count ?? 0;
    const activeRows = activeCountResult.count ?? 0;
    const redirectEnabledRows = enabledCountResult.count ?? 0;

    const remainingOldUrls = Math.max(
      0,
      OLD_URL_TOTAL - savedBridgeRows
    );

    const progressPercent =
      OLD_URL_TOTAL > 0
        ? Number(
            (
              (savedBridgeRows / OLD_URL_TOTAL) *
              100
            ).toFixed(2)
          )
        : 0;

    return NextResponse.json({
      success: true,
      routeVersion: ROUTE_VERSION,

      migration: {
        totalOldProductUrls: OLD_URL_TOTAL,
        savedBridgeRows,
        exactMatches,
        strongMatches,
        safeMatchesTotal:
          exactMatches + strongMatches,
        remainingOldUrls,
        progressPercent,
      },

      redirects: {
        activeRows,
        redirectEnabledRows,
        redirectDisabledRows: Math.max(
          0,
          savedBridgeRows - redirectEnabledRows
        ),
        liveRedirectsActive:
          redirectEnabledRows > 0,
      },

      job: {
        jobKey:
          bridgeJobResult.data?.job_key ?? null,
        currentOffset: Number(
          bridgeJobResult.data?.cursor_offset || 0
        ),
        lastProcessed: Number(
          bridgeJobResult.data?.last_processed || 0
        ),
        lastSaved: Number(
          bridgeJobResult.data?.last_updated || 0
        ),
        lastUnresolved: Number(
          bridgeJobResult.data?.last_unresolved || 0
        ),
        lastFailed: Number(
          bridgeJobResult.data?.last_failed || 0
        ),
        lastRateLimited:
          bridgeJobResult.data?.last_rate_limited === true,
        updatedAt:
          bridgeJobResult.data?.updated_at ?? null,
      },

      status:
        redirectEnabledRows > 0
          ? 'REDIRECTS_ENABLED'
          : savedBridgeRows >= OLD_URL_TOTAL
            ? 'BRIDGE_COMPLETE_REDIRECTS_DISABLED'
            : 'BRIDGE_BUILDING_REDIRECTS_DISABLED',
    });
  } catch (error) {
    console.error('MIGRATION STATUS ERROR:', error);

    return NextResponse.json(
      {
        success: false,
        routeVersion: ROUTE_VERSION,
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}
