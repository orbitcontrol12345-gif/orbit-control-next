import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import {
  generateSafeBrandDictionary,
} from '@/lib/brand-dictionary-generator';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const ROUTE_VERSION =
  'BRAND-INTELLIGENCE-BUILDER-V2-SAFE';
const PAGE_SIZE = 1000;

const INVALID_BRANDS = new Set([
  '',
  'UNKNOWN',
  'UNBRANDED',
  'GENERIC',
  'DOES NOT APPLY',
  'DOES NOT APPLY.',
  'N/A',
  'NA',
  'NONE',
  'NO BRAND',
  'NOT APPLICABLE',
  'OTHER',
]);

const BAD_TITLE_WORDS = new Set([
  '',
  'NEW',
  'USED',
  'OPEN',
  'BOX',
  'LOT',
  'LOTS',
  'PCS',
  'PC',
  'PIECE',
  'PIECES',
  'TESTED',
  'WORKING',
  'ORIGINAL',
  'GENUINE',
  'FOR',
  'PARTS',
  'PART',
  'ONLY',
  'WITHOUT',
  'WITH',
  'W/O',
  'NO',
  'OLD',
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

type CounterMap = Map<string, number>;

type BrandStats = {
  productCount: number;
  titlePrefixes: CounterMap;
  partNumberPrefixes: CounterMap;
  examples: string[];
};

function normalizeSpace(value: unknown): string {
  return String(value ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeUpper(value: unknown): string {
  return normalizeSpace(value).toUpperCase();
}

function normalizeBrand(value: unknown): string {
  return normalizeSpace(value)
    .replace(/[®™©]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isValidBrand(value: unknown): boolean {
  const brand = normalizeUpper(value);

  if (!brand) return false;
  if (INVALID_BRANDS.has(brand)) return false;
  if (brand.length < 2 || brand.length > 80) return false;
  if (/^\d+$/.test(brand)) return false;

  return true;
}

function cleanTitle(value: unknown): string {
  return normalizeSpace(value)
    .replace(/[®™©]/g, '')
    .replace(/[()[\]{}]/g, ' ')
    .replace(/[|,:;]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanPartNumber(value: unknown): string {
  return normalizeUpper(value)
    .replace(/\s+/g, '')
    .replace(/^[#.:/_-]+|[#.:/_-]+$/g, '')
    .trim();
}

function incrementCounter(
  map: CounterMap,
  key: string,
  amount = 1
): void {
  if (!key) return;
  map.set(key, (map.get(key) ?? 0) + amount);
}

function getTitlePrefixCandidates(titleValue: unknown): string[] {
  const title = cleanTitle(titleValue);

  if (!title) return [];

  const rawWords = title
    .split(/\s+/)
    .map((word) =>
      word
        .replace(/^[^A-Za-z0-9+&.-]+/, '')
        .replace(/[^A-Za-z0-9+&.-]+$/, '')
        .trim()
    )
    .filter(Boolean);

  const words: string[] = [];

  for (const rawWord of rawWords) {
    const word = normalizeUpper(rawWord);

    if (!word) continue;

    if (
      words.length === 0 &&
      (
        BAD_TITLE_WORDS.has(word) ||
        /^\d+$/.test(word) ||
        /^(LOT|QTY|QUANTITY)[-:]?\d*$/i.test(word) ||
        /^\d+\s*(PCS?|PIECES?)$/i.test(word)
      )
    ) {
      continue;
    }

    words.push(word);

    if (words.length >= 3) break;
  }

  if (words.length === 0) return [];

  const candidates = new Set<string>();

  const first = words[0];

  if (
    first.length >= 2 &&
    !BAD_TITLE_WORDS.has(first) &&
    !/^\d+$/.test(first)
  ) {
    candidates.add(first);
  }

  if (words.length >= 2) {
    const firstTwo = `${words[0]} ${words[1]}`;

    if (
      firstTwo.length <= 50 &&
      !BAD_TITLE_WORDS.has(words[1])
    ) {
      candidates.add(firstTwo);
    }
  }

  if (words.length >= 3) {
    const firstThree = `${words[0]} ${words[1]} ${words[2]}`;

    if (
      firstThree.length <= 65 &&
      !BAD_TITLE_WORDS.has(words[1]) &&
      !BAD_TITLE_WORDS.has(words[2])
    ) {
      candidates.add(firstThree);
    }
  }

  return Array.from(candidates);
}

function getPartNumberPrefixCandidates(
  value: unknown
): string[] {
  const partNumber = cleanPartNumber(value);

  if (!partNumber) return [];
  if (partNumber.length < 3 || partNumber.length > 80) return [];
  if (/^\d{8,}$/.test(partNumber)) return [];

  const compact = partNumber.replace(/[^A-Z0-9]/g, '');

  if (compact.length < 3) return [];

  const candidates = new Set<string>();

  // أول مقطع قبل الفاصل، مثل:
  // 6ES7 من 6ES7-315-2AG10-0AB0
  // 1756 من 1756-L71
  const firstSegment = partNumber
    .split(/[-/_.\s]+/)
    .filter(Boolean)[0];

  if (
    firstSegment &&
    firstSegment.length >= 3 &&
    firstSegment.length <= 12 &&
    /[A-Z]/.test(firstSegment) &&
    /\d/.test(firstSegment)
  ) {
    candidates.add(firstSegment);
  }

  // Prefixes متدرجة حتى نتعلم:
  // 6ES, 6ES7, 1756, 2711P
  for (const length of [3, 4, 5, 6, 7, 8]) {
    if (compact.length < length) continue;

    const prefix = compact.slice(0, length);

    if (!/[A-Z]/.test(prefix)) continue;
    if (!/\d/.test(prefix)) continue;

    candidates.add(prefix);
  }

  return Array.from(candidates);
}

function sortCounter(map: CounterMap) {
  return Array.from(map.entries())
    .map(([value, count]) => ({
      value,
      count,
    }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.value.localeCompare(b.value);
    });
}

function percentage(
  numerator: number,
  denominator: number
): number {
  if (!denominator) return 0;

  return Number(
    ((numerator / denominator) * 100).toFixed(2)
  );
}

export async function GET() {
  try {
    const brands = new Map<string, BrandStats>();

    /*
     * هذه الخرائط مهمة لاكتشاف التضارب.
     * مثال: Prefix واحد يظهر مع Siemens وABB،
     * فلا يجوز اعتماده تلقائياً.
     */
    const titlePrefixOwners = new Map<
      string,
      Map<string, number>
    >();

    const partPrefixOwners = new Map<
      string,
      Map<string, number>
    >();

    let offset = 0;
    let totalScanned = 0;
    let validBrandProducts = 0;
    let skippedInvalidBrand = 0;

    while (true) {
      const { data: rows, error } = await supabaseAdmin
        .from('products')
        .select('id,name,brand,part_number')
        .order('id', { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1);

      if (error) throw error;
      if (!rows || rows.length === 0) break;

      totalScanned += rows.length;

      for (const product of rows) {
        if (!isValidBrand(product.brand)) {
          skippedInvalidBrand++;
          continue;
        }

        validBrandProducts++;

        const brand = normalizeBrand(product.brand);
        const brandKey = normalizeUpper(brand);

        const current = brands.get(brandKey) ?? {
          productCount: 0,
          titlePrefixes: new Map<string, number>(),
          partNumberPrefixes: new Map<string, number>(),
          examples: [],
        };

        current.productCount++;

        if (
          product.name &&
          current.examples.length < 5 &&
          !current.examples.includes(product.name)
        ) {
          current.examples.push(product.name);
        }

        const titleCandidates =
          getTitlePrefixCandidates(product.name);

        for (const prefix of titleCandidates) {
          incrementCounter(current.titlePrefixes, prefix);

          const owners =
            titlePrefixOwners.get(prefix) ??
            new Map<string, number>();

          incrementCounter(owners, brandKey);
          titlePrefixOwners.set(prefix, owners);
        }

        const partNumberCandidates =
          getPartNumberPrefixCandidates(
            product.part_number
          );

        for (const prefix of partNumberCandidates) {
          incrementCounter(
            current.partNumberPrefixes,
            prefix
          );

          const owners =
            partPrefixOwners.get(prefix) ??
            new Map<string, number>();

          incrementCounter(owners, brandKey);
          partPrefixOwners.set(prefix, owners);
        }

        brands.set(brandKey, current);
      }

      if (rows.length < PAGE_SIZE) break;

      offset += PAGE_SIZE;
    }

    const learnedBrands = Array.from(brands.entries())
      .map(([brand, stats]) => {
        const titlePrefixes = sortCounter(
          stats.titlePrefixes
        )
          .map((entry) => {
            const owners =
              titlePrefixOwners.get(entry.value) ??
              new Map<string, number>();

            const totalOccurrences = Array.from(
              owners.values()
            ).reduce((sum, count) => sum + count, 0);

            const ownOccurrences =
              owners.get(brand) ?? 0;

            const purity = percentage(
              ownOccurrences,
              totalOccurrences
            );

            return {
              prefix: entry.value,
              count: entry.count,
              coverage: percentage(
                entry.count,
                stats.productCount
              ),
              purity,
              ownerCount: owners.size,
              accepted:
                entry.count >= 2 &&
                purity >= 95 &&
                owners.size <= 2,
            };
          })
          .filter(
            (entry) =>
              entry.accepted ||
              entry.count >= 2
          )
          .slice(0, 30);

        const partNumberPrefixes = sortCounter(
          stats.partNumberPrefixes
        )
          .map((entry) => {
            const owners =
              partPrefixOwners.get(entry.value) ??
              new Map<string, number>();

            const totalOccurrences = Array.from(
              owners.values()
            ).reduce((sum, count) => sum + count, 0);

            const ownOccurrences =
              owners.get(brand) ?? 0;

            const purity = percentage(
              ownOccurrences,
              totalOccurrences
            );

            return {
              prefix: entry.value,
              count: entry.count,
              coverage: percentage(
                entry.count,
                stats.productCount
              ),
              purity,
              ownerCount: owners.size,
              accepted:
                entry.count >= 3 &&
                purity >= 98 &&
                owners.size === 1,
            };
          })
          .filter(
            (entry) =>
              entry.accepted ||
              entry.count >= 2
          )
          .slice(0, 40);

        const acceptedTitlePrefixes =
          titlePrefixes.filter(
            (entry) => entry.accepted
          );

        const acceptedPartNumberPrefixes =
          partNumberPrefixes.filter(
            (entry) => entry.accepted
          );

        return {
          brand,
          productCount: stats.productCount,

          learned: {
            titlePrefixes: acceptedTitlePrefixes,
            partNumberPrefixes:
              acceptedPartNumberPrefixes,
          },

          review: {
            titlePrefixes: titlePrefixes.filter(
              (entry) => !entry.accepted
            ),
            partNumberPrefixes:
              partNumberPrefixes.filter(
                (entry) => !entry.accepted
              ),
          },

          examples: stats.examples,
        };
      })
      .sort((a, b) => {
        if (b.productCount !== a.productCount) {
          return b.productCount - a.productCount;
        }

        return a.brand.localeCompare(b.brand);
      });

    const brandsWithLearnedEvidence =
      learnedBrands.filter(
        (brand) =>
          brand.learned.titlePrefixes.length > 0 ||
          brand.learned.partNumberPrefixes.length > 0
      );

    const safeDictionaryResult =
  generateSafeBrandDictionary(
    brandsWithLearnedEvidence
  );

    return NextResponse.json({
      success: true,
      job: 'build-brand-intelligence',
      routeVersion: ROUTE_VERSION,

      summary: {
        totalScanned,
        validBrandProducts,
        skippedInvalidBrand,
        uniqueValidBrands: learnedBrands.length,
        brandsWithLearnedEvidence:
          brandsWithLearnedEvidence.length,
        dictionaryEntries:
  safeDictionaryResult.dictionary.length,

safeAliases:
  safeDictionaryResult.summary.totalAliases,

safePartNumberPrefixes:
  safeDictionaryResult.summary
    .totalPartNumberPrefixes,
      },

      /*
       * هذا القسم هو القاموس النظيف الذي سنستخدمه
       * في المرحلة التالية.
       */
      dictionaryVersion:
  safeDictionaryResult.version,

exportDictionary:
  safeDictionaryResult.dictionary,
      /*
       * هذا القسم يعرض التفاصيل والتضارب للمراجعة،
       * ولا يستخدم تلقائياً بعد.
       */
      brands: learnedBrands,
    });
  } catch (error) {
    console.error(
      'BUILD BRAND INTELLIGENCE ERROR:',
      error
    );

    return NextResponse.json(
      {
        success: false,
        job: 'build-brand-intelligence',
        routeVersion: ROUTE_VERSION,
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
