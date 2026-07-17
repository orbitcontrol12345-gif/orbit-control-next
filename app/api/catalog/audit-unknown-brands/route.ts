import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const PAGE_SIZE = 1000;

const BAD_WORDS = new Set([
  '',
  'UNKNOWN',
  'NEW',
  'USED',
  'OPEN',
  'BOX',
  'LOT',
  'PCS',
  'PLC',
  'HMI',
  'VFD',
  'DRIVE',
  'MODULE',
  'CONTROLLER',
  'CONTROL',
  'RELAY',
  'SWITCH',
  'BOARD',
  'CARD',
  'POWER',
  'SUPPLY',
  'SENSOR',
  'MOTOR',
  'PANEL',
  'DISPLAY',
  'SYSTEM',
  'UNIT',
  'CIRCUIT',
  'BREAKER',
  'CONTACTOR',
  'INVERTER',
  'CONVERTER',
  'AMPLIFIER',
  'TRANSFORMER',
  'AUTOMATION',
  'INDUSTRIAL',
  'ELECTRIC',
  'ELECTRICAL',
]);

function normalize(value: unknown): string {
  return String(value || '')
    .replace(/[()[\]{}]/g, ' ')
    .replace(/[|,:;]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getCandidateFromTitle(title: unknown): string {
  const text = normalize(title);

  if (!text) return '';

  const words = text.split(/\s+/).filter(Boolean);

  const first = normalize(words[0]).toUpperCase();
  const firstTwo = normalize(words.slice(0, 2).join(' ')).toUpperCase();

  if (
    !first ||
    BAD_WORDS.has(first) ||
    /^\d+$/.test(first) ||
    /^[A-Z]*\d+[A-Z0-9./-]*$/i.test(first)
  ) {
    return '';
  }

  const twoWordPrefixes = [
    'ALLEN BRADLEY',
    'PHOENIX CONTACT',
    'GENERAL ELECTRIC',
    'MITSUBISHI ELECTRIC',
    'CARLO GAVAZZI',
    'MORS SMITT',
    'HMS NETWORKS',
    'ANDOVER CONTROLS',
    'FUJI ELECTRIC',
    'PEPPERL FUCHS',
    'SEW EURODRIVE',
  ];

  if (twoWordPrefixes.includes(firstTwo)) {
    return firstTwo;
  }

  return first;
}

function getConfidence(
  candidate: string,
  count: number,
  examples: string[]
): 'high' | 'review' | 'reject' {
  const value = candidate.toUpperCase().trim();

  if (!value) return 'reject';

  if (BAD_WORDS.has(value)) return 'reject';

  if (/^\d+$/.test(value)) return 'reject';

  if (/^[A-Z]{0,4}\d+[A-Z0-9./-]*$/i.test(value))
    return 'reject';

  if (value.length < 3 || value.length > 40)
    return 'reject';

  const startsCorrectly = examples.filter((example) => {
    const title = normalize(example).toUpperCase();

    return (
      title === value ||
      title.startsWith(value + ' ')
    );
  }).length;

  const ratio =
    examples.length > 0
      ? startsCorrectly / examples.length
      : 0;

  if (count >= 3 && ratio >= 0.8) return 'high';

  if (count >= 2 && ratio >= 0.5) return 'review';

  return 'review';
}

export async function GET() {
  try {
    const candidates = new Map<
      string,
      {
        count: number;
        examples: string[];
      }
    >();

    let offset = 0;
    let totalScanned = 0;

    while (true) {
      const { data: rows, error } = await supabaseAdmin
        .from('products')
        .select('id,name,brand,part_number')
        .or(
          'brand.is.null,brand.eq.UNKNOWN,brand.eq.Unknown,brand.eq.unknown'
        )
        .order('id', { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1);

      if (error) throw error;

      if (!rows || rows.length === 0) break;

      totalScanned += rows.length;

      for (const product of rows) {
        const candidate = getCandidateFromTitle(
          product.name
        );

        if (!candidate) continue;

        const current = candidates.get(candidate) ?? {
          count: 0,
          examples: [],
        };

        current.count++;

        if (
          product.name &&
          current.examples.length < 5 &&
          !current.examples.includes(product.name)
        ) {
          current.examples.push(product.name);
        }

        candidates.set(candidate, current);
      }

      if (rows.length < PAGE_SIZE) break;

      offset += PAGE_SIZE;
    }

    const results = Array.from(candidates.entries())
      .map(([candidate, details]) => ({
        candidate,
        count: details.count,
        confidence: getConfidence(
          candidate,
          details.count,
          details.examples
        ),
        examples: details.examples,
      }))
      .sort((a, b) => b.count - a.count);

    const highConfidence = results.filter(
      (x) => x.confidence === 'high'
    );

    const review = results.filter(
      (x) => x.confidence === 'review'
    );

    const rejected = results.filter(
      (x) => x.confidence === 'reject'
    );

    return NextResponse.json({
      success: true,
      totalScanned,
      uniqueCandidates: results.length,

      counts: {
        highConfidence: highConfidence.length,
        review: review.length,
        rejected: rejected.length,
      },

      highConfidence,
      review,
      rejected,
    });
  } catch (error) {
    console.error('AUDIT UNKNOWN BRANDS ERROR:', error);

    return NextResponse.json(
      {
        success: false,
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
