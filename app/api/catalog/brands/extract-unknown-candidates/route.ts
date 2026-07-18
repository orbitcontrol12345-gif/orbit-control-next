import { NextResponse } from 'next/server';

import { supabaseAdmin } from '@/lib/supabase-admin';

import {
  getActiveBrands,
  getApprovedEvidence,
} from '@/lib/brands/repository';

import {
  buildBrandDictionary,
} from '@/lib/brands/dictionary';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const ROUTE_VERSION =
  'EXTRACT-UNKNOWN-BRAND-CANDIDATES-V2';

const DEFAULT_LIMIT = 2500;
const MAX_LIMIT = 5000;

const DEFAULT_PAGE_SIZE = 500;
const MAX_PAGE_SIZE = 1000;

type ProductRow = {
  id: number | string;
  name?: string | null;
  title?: string | null;
  part_number?: string | null;
  manufacturer?: string | null;
  brand?: string | null;
};

type CandidateSource =
  | 'manufacturer'
  | 'title-first-token'
  | 'title-first-two-tokens'
  | 'title-first-three-tokens';

type CandidateProductSample = {
  productId: number | string;
  title: string;
  partNumber: string | null;
  source: CandidateSource;
};

type CandidateAggregate = {
  normalizedCandidate: string;
  displayCandidate: string;

  occurrenceCount: number;
  productCount: number;

  sourceCounts: Record<
    CandidateSource,
    number
  >;

  productIds: Set<string>;

  samples: CandidateProductSample[];

  knownBrandMatch: boolean;
  knownBrandName: string | null;

  recommendation:
    | 'approve'
    | 'review'
    | 'reject';

  confidenceScore: number;

  reasons: string[];
};

const GENERIC_WORDS = new Set([
  'NEW',
  'USED',
  'OPEN',
  'BOX',
  'REFURBISHED',
  'TESTED',
  'WORKING',

  'MODULE',
  'CONTROL',
  'CONTROLLER',
  'BOARD',
  'CARD',
  'UNIT',
  'DEVICE',
  'SYSTEM',
  'PANEL',
  'DISPLAY',
  'SCREEN',

  'DIGITAL',
  'ANALOG',
  'INPUT',
  'OUTPUT',
  'POWER',
  'SUPPLY',
  'TRANSFORMER',
  'CONVERTER',
  'INVERTER',
  'DRIVE',

  'RELAY',
  'CONTACTOR',
  'SWITCH',
  'PUSHBUTTON',
  'BUTTON',
  'SOCKET',
  'BASE',
  'FUSE',
  'HOLDER',
  'SENSOR',
  'MOTOR',

  'CIRCUIT',
  'PRINTED',
  'ELECTRONIC',
  'ELECTRICAL',
  'INDUSTRIAL',

  'LOT',
  'PCS',
  'PIECE',
  'PIECES',
  'ONLY',
  'WITHOUT',
  'WITH',
  'FOR',
  'THE',
  'AND',

  'UNKNOWN',
  'GENERIC',
  'UNBRANDED',
  'NONE',
  'OTHER',

  'AC',
  'DC',
  'VAC',
  'VDC',
  'AMP',
  'AMPS',
  'VOLT',
  'VOLTS',
  'WATT',
  'WATTS',
]);

const BAD_PREFIXES = [
  'LOT ',
  'PCS ',
  'NEW ',
  'USED ',
  'OPEN BOX ',
  'REFURBISHED ',
];

function normalizeText(
  value: unknown
): string {
  if (
    typeof value !== 'string' &&
    typeof value !== 'number'
  ) {
    return '';
  }

  return String(value)
    .normalize('NFKD')
    .replace(
      /[\u0300-\u036f]/g,
      ''
    )
    .replace(/&/g, ' AND ')
    .replace(
      /[^A-Za-z0-9+._/\-\s]/g,
      ' '
    )
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeCandidate(
  value: string
): string {
  return normalizeText(value)
    .replace(
      /^[\s._/+:-]+|[\s._/+:-]+$/g,
      ''
    )
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function cleanTitle(
  value: unknown
): string {
  let title =
    normalizeText(value);

  for (const prefix of BAD_PREFIXES) {
    if (
      title
        .toUpperCase()
        .startsWith(prefix)
    ) {
      title = title.slice(
        prefix.length
      );
    }
  }

  return title.trim();
}

function isNumericOnly(
  value: string
): boolean {
  return /^[0-9\s._/\-]+$/.test(
    value
  );
}

function looksLikePartNumber(
  value: string
): boolean {
  const compact =
    value.replace(/\s+/g, '');

  if (compact.length < 2) {
    return false;
  }

  const hasLetter =
    /[A-Z]/i.test(compact);

  const hasNumber =
    /[0-9]/.test(compact);

  if (
    hasLetter &&
    hasNumber &&
    /^[A-Z0-9._/\-]+$/i.test(
      compact
    )
  ) {
    return true;
  }

  return false;
}

function isVoltageOrRating(
  value: string
): boolean {
  const compact =
    value
      .replace(/\s+/g, '')
      .toUpperCase();

  return (
    /^[0-9.]+(?:VAC|VDC|V|A|AMP|HZ|KW|W)$/.test(
      compact
    ) ||
    /^[0-9.]+-[0-9.]+(?:VAC|VDC|V|A|HZ)$/.test(
      compact
    )
  );
}

function isGenericCandidate(
  candidate: string
): boolean {
  const normalized =
    normalizeCandidate(candidate);

  if (!normalized) {
    return true;
  }

  const tokens =
    normalized.split(' ');

  if (
    tokens.every((token) =>
      GENERIC_WORDS.has(token)
    )
  ) {
    return true;
  }

  if (
    tokens.length === 1 &&
    GENERIC_WORDS.has(tokens[0])
  ) {
    return true;
  }

  return false;
}

function isValidCandidate(
  candidate: string
): boolean {
  const normalized =
    normalizeCandidate(candidate);

  if (
    normalized.length < 2 ||
    normalized.length > 45
  ) {
    return false;
  }

  if (isNumericOnly(normalized)) {
    return false;
  }

  if (isVoltageOrRating(normalized)) {
    return false;
  }

  if (isGenericCandidate(normalized)) {
    return false;
  }

  /*
   * كلمة واحدة تشبه Part Number غالبًا
   * لا نعاملها كاسم براند.
   */
  if (
    !normalized.includes(' ') &&
    looksLikePartNumber(normalized)
  ) {
    return false;
  }

  return true;
}

function extractTitleCandidates(
  titleValue: unknown
): Array<{
  candidate: string;
  source: CandidateSource;
}> {
  const title =
    cleanTitle(titleValue);

  if (!title) {
    return [];
  }

  const tokens =
    title
      .split(' ')
      .map((token) =>
        token.trim()
      )
      .filter(Boolean);

  if (tokens.length === 0) {
    return [];
  }

  const extracted: Array<{
    candidate: string;
    source: CandidateSource;
  }> = [];

  const first =
    tokens[0];

  const firstTwo =
    tokens
      .slice(0, 2)
      .join(' ');

  const firstThree =
    tokens
      .slice(0, 3)
      .join(' ');

  if (isValidCandidate(first)) {
    extracted.push({
      candidate: first,
      source:
        'title-first-token',
    });
  }

  if (
    tokens.length >= 2 &&
    isValidCandidate(firstTwo)
  ) {
    extracted.push({
      candidate: firstTwo,
      source:
        'title-first-two-tokens',
    });
  }

  if (
    tokens.length >= 3 &&
    isValidCandidate(firstThree)
  ) {
    extracted.push({
      candidate: firstThree,
      source:
        'title-first-three-tokens',
    });
  }

  return extracted;
}

function parseInteger(
  value: unknown,
  fallback: number
): number {
  const parsed =
    Number.parseInt(
      String(value ?? ''),
      10
    );

  return Number.isFinite(parsed)
    ? parsed
    : fallback;
}

function clampInteger(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number
): number {
  return Math.min(
    Math.max(
      parseInteger(
        value,
        fallback
      ),
      minimum
    ),
    maximum
  );
}

function getKnownBrandNames(
  dictionary: any
): string[] {
  const names = new Set<string>();

  const possibleCollections = [
    dictionary?.brands,
    dictionary?.brandNames,
    dictionary?.entries,
    dictionary?.aliases,
  ];

  for (
    const collection of
    possibleCollections
  ) {
    if (Array.isArray(collection)) {
      for (const item of collection) {
        if (
          typeof item === 'string'
        ) {
          names.add(
            normalizeCandidate(item)
          );
        } else if (
          item &&
          typeof item === 'object'
        ) {
          const values = [
            item.name,
            item.brand,
            item.canonicalBrand,
            item.canonical_name,
            item.alias,
          ];

          for (const value of values) {
            if (
              typeof value ===
              'string'
            ) {
              names.add(
                normalizeCandidate(
                  value
                )
              );
            }
          }
        }
      }
    }
  }

  return [...names].filter(Boolean);
}

function findKnownBrandMatch(
  candidate: string,
  knownBrandNames: string[]
): string | null {
  const normalized =
    normalizeCandidate(candidate);

  for (const knownBrand of knownBrandNames) {
    if (
      normalized === knownBrand
    ) {
      return knownBrand;
    }
  }

  return null;
}

function addCandidate(
  map: Map<
    string,
    CandidateAggregate
  >,
  candidateValue: string,
  source: CandidateSource,
  product: ProductRow,
  knownBrandNames: string[]
) {
  const normalized =
    normalizeCandidate(
      candidateValue
    );

  if (!isValidCandidate(normalized)) {
    return;
  }

  const productId =
    String(product.id);

  const title =
    cleanTitle(
      product.title ??
        product.name
    );

  const knownBrandName =
    findKnownBrandMatch(
      normalized,
      knownBrandNames
    );

  const current =
    map.get(normalized) ?? {
      normalizedCandidate:
        normalized,

      displayCandidate:
        candidateValue.trim(),

      occurrenceCount: 0,
      productCount: 0,

      sourceCounts: {
        manufacturer: 0,
        'title-first-token': 0,
        'title-first-two-tokens': 0,
        'title-first-three-tokens': 0,
      },

      productIds:
        new Set<string>(),

      samples: [],

      knownBrandMatch:
        Boolean(knownBrandName),

      knownBrandName,

      recommendation:
        'review',

      confidenceScore: 0,

      reasons: [],
    };

  current.occurrenceCount += 1;

  current.sourceCounts[source] += 1;

  if (
    !current.productIds.has(
      productId
    )
  ) {
    current.productIds.add(
      productId
    );

    current.productCount += 1;
  }

  if (
    current.samples.length < 5
  ) {
    current.samples.push({
      productId:
        product.id,

      title,

      partNumber:
        product.part_number ??
        null,

      source,
    });
  }

  map.set(
    normalized,
    current
  );
}

function scoreCandidate(
  candidate: CandidateAggregate
): CandidateAggregate {
  let score = 0;
  const reasons: string[] = [];

  const manufacturerCount =
    candidate.sourceCounts
      .manufacturer;

  const firstTokenCount =
    candidate.sourceCounts[
      'title-first-token'
    ];

  const firstTwoCount =
    candidate.sourceCounts[
      'title-first-two-tokens'
    ];

  if (candidate.knownBrandMatch) {
    score += 50;

    reasons.push(
      'Matches an existing dictionary brand.'
    );
  }

  if (manufacturerCount > 0) {
    score += 40;

    reasons.push(
      'Appears in manufacturer field.'
    );
  }

  if (candidate.productCount >= 10) {
    score += 30;

    reasons.push(
      'Appears in at least 10 products.'
    );
  } else if (
    candidate.productCount >= 5
  ) {
    score += 20;

    reasons.push(
      'Appears in at least 5 products.'
    );
  } else if (
    candidate.productCount >= 2
  ) {
    score += 10;

    reasons.push(
      'Appears in multiple products.'
    );
  }

  if (firstTokenCount >= 2) {
    score += 15;

    reasons.push(
      'Repeatedly appears as the first title token.'
    );
  }

  if (
    firstTwoCount >= 2 &&
    firstTwoCount >=
      firstTokenCount
  ) {
    score += 10;

    reasons.push(
      'Repeatedly appears as the first two title tokens.'
    );
  }

  if (
    candidate.normalizedCandidate
      .split(' ').length <= 3
  ) {
    score += 5;
  }

  let recommendation:
    CandidateAggregate['recommendation'];

  if (
    candidate.knownBrandMatch ||
    (
      manufacturerCount >= 2 &&
      candidate.productCount >= 2
    ) ||
    (
      score >= 60 &&
      candidate.productCount >= 3
    )
  ) {
    recommendation = 'approve';
  } else if (
    score >= 20 ||
    candidate.productCount >= 2
  ) {
    recommendation = 'review';
  } else {
    recommendation = 'reject';
  }

  return {
    ...candidate,

    confidenceScore:
      Math.min(score, 100),

    recommendation,

    reasons,
  };
}

function serializeCandidate(
  candidate: CandidateAggregate
) {
  return {
    candidate:
      candidate.displayCandidate,

    normalizedCandidate:
      candidate
        .normalizedCandidate,

    productCount:
      candidate.productCount,

    occurrenceCount:
      candidate.occurrenceCount,

    sourceCounts:
      candidate.sourceCounts,

    knownBrandMatch:
      candidate.knownBrandMatch,

    knownBrandName:
      candidate.knownBrandName,

    confidenceScore:
      candidate.confidenceScore,

    recommendation:
      candidate.recommendation,

    reasons:
      candidate.reasons,

    samples:
      candidate.samples,
  };
}

export async function GET(
  request: Request
) {
  const startedAt =
    Date.now();

  try {
    const url =
      new URL(request.url);

    const limit =
      clampInteger(
        url.searchParams.get(
          'limit'
        ),
        DEFAULT_LIMIT,
        1,
        MAX_LIMIT
      );

    const pageSize =
      clampInteger(
        url.searchParams.get(
          'pageSize'
        ),
        DEFAULT_PAGE_SIZE,
        1,
        MAX_PAGE_SIZE
      );

    const minimumProductCount =
      clampInteger(
        url.searchParams.get(
          'minimumProductCount'
        ),
        1,
        1,
        1000
      );

    const [brands, evidence] =
      await Promise.all([
        getActiveBrands(),
        getApprovedEvidence(),
      ]);

    const dictionary =
      buildBrandDictionary(
        brands,
        evidence
      );

    const knownBrandNames =
      getKnownBrandNames(
        dictionary
      );

    const candidates =
      new Map<
        string,
        CandidateAggregate
      >();

    let afterId = 0;
    let loaded = 0;
    let pagesProcessed = 0;
    let reachedEnd = false;

    while (
      loaded < limit &&
      !reachedEnd
    ) {
      const currentLimit =
        Math.min(
          pageSize,
          limit - loaded
        );

      const {
        data,
        error,
      } = await supabaseAdmin
        .from('products')
        .select(
          [
            'id',
            'name',
            'title',
            'part_number',
            'manufacturer',
            'brand',
          ].join(',')
        )
        .or(
          [
            'brand.is.null',
            'brand.eq.UNKNOWN',
            'brand.eq.Unknown',
            'brand.eq.unknown',
          ].join(',')
        )
        .gt('id', afterId)
        .order('id', {
          ascending: true,
        })
        .limit(currentLimit);

      if (error) {
        throw new Error(
          `Failed loading UNKNOWN products: ${error.message}`
        );
      }

      const rows =
        (data ?? []) as ProductRow[];

      if (rows.length === 0) {
        reachedEnd = true;
        break;
      }

      pagesProcessed += 1;
      loaded += rows.length;

      for (const product of rows) {
        const manufacturer =
          normalizeText(
            product.manufacturer
          );

        if (
          manufacturer &&
          isValidCandidate(
            manufacturer
          )
        ) {
          addCandidate(
            candidates,
            manufacturer,
            'manufacturer',
            product,
            knownBrandNames
          );
        }

        const titleCandidates =
          extractTitleCandidates(
            product.title ??
              product.name
          );

        for (
          const extracted of
          titleCandidates
        ) {
          addCandidate(
            candidates,
            extracted.candidate,
            extracted.source,
            product,
            knownBrandNames
          );
        }
      }

      const lastRow =
        rows[
          rows.length - 1
        ];

      const nextAfterId =
        Number(lastRow.id);

      if (
        !Number.isFinite(
          nextAfterId
        )
      ) {
        throw new Error(
          `Invalid product ID: ${String(lastRow.id)}`
        );
      }

      afterId = nextAfterId;

      if (
        rows.length <
        currentLimit
      ) {
        reachedEnd = true;
      }
    }

    const scored =
      [...candidates.values()]
        .map(scoreCandidate)
        .filter(
          (candidate) =>
            candidate.productCount >=
            minimumProductCount
        )
        .sort((a, b) => {
          if (
            b.confidenceScore !==
            a.confidenceScore
          ) {
            return (
              b.confidenceScore -
              a.confidenceScore
            );
          }

          return (
            b.productCount -
            a.productCount
          );
        });

    const approve =
      scored.filter(
        (item) =>
          item.recommendation ===
          'approve'
      );

    const review =
      scored.filter(
        (item) =>
          item.recommendation ===
          'review'
      );

    const reject =
      scored.filter(
        (item) =>
          item.recommendation ===
          'reject'
      );

    return NextResponse.json({
      success: true,

      job:
        'extract-unknown-brand-candidates',

      routeVersion:
        ROUTE_VERSION,

      writeEnabled: false,

      scan: {
        loadedProducts:
          loaded,

        pagesProcessed,

        reachedEnd,

        lastScannedId:
          afterId,

        requestedLimit:
          limit,

        minimumProductCount,
      },

      dictionary: {
        totalBrands:
          dictionary.totalBrands,

        totalEvidence:
          dictionary.totalEvidence,

        knownBrandNamesLoaded:
          knownBrandNames.length,

        generatedAt:
          dictionary.generatedAt,
      },

      summary: {
        totalCandidates:
          scored.length,

        approveCount:
          approve.length,

        reviewCount:
          review.length,

        rejectCount:
          reject.length,
      },

      candidates: {
        approve:
          approve
            .slice(0, 300)
            .map(
              serializeCandidate
            ),

        review:
          review
            .slice(0, 500)
            .map(
              serializeCandidate
            ),

        reject:
          reject
            .slice(0, 100)
            .map(
              serializeCandidate
            ),
      },

      timing: {
        durationMs:
          Date.now() -
          startedAt,
      },
    });
  } catch (error) {
    console.error(
      'EXTRACT UNKNOWN BRAND CANDIDATES ERROR:',
      error
    );

    return NextResponse.json(
      {
        success: false,

        job:
          'extract-unknown-brand-candidates',

        routeVersion:
          ROUTE_VERSION,

        writeEnabled: false,

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
