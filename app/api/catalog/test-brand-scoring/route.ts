import { NextResponse } from 'next/server';

import {
  BRAND_SCORING_ENGINE_VERSION,
  scoreProductBrand,
  type BrandDictionaryEntry,
  type BrandScoringInput,
} from '@/lib/brand-scoring-engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ROUTE_VERSION = 'TEST-BRAND-SCORING-V1';

/*
 * قاموس تجريبي نظيف لاختبار المحرك فقط.
 * هذا الـRoute لا يعدّل أي منتج في Supabase.
 */
const TEST_DICTIONARY: BrandDictionaryEntry[] = [
  {
    brand: 'ABB',

    aliases: [
      'ABB',
      'BBC',
      'ENTRELEC',
      'BUSCH-JAEGER',
      'ABB SACE',
    ],

    partNumberPrefixes: [
      '3BSE',
      '1SVR',
      'HENF',
      'GHQ6',
      'S200',
      'ROFBU',
    ],
  },

  {
    brand: 'SIEMENS',

    aliases: [
      'SIEMENS',
      'SIMATIC',
      'SITOP',
      'SINUMERIK',
      'SIPROTEC',
      'SIRIUS',
      'RUGGEDCOM',
      'LANDIS & STAEFA',
    ],

    partNumberPrefixes: [
      '6ES5',
      '6ES7',
      '6AV',
      '6SC',
      '6DS',
      '5WG1',
      '7PA',
      'TXM1',
    ],
  },

  {
    brand: 'SCHNEIDER ELECTRIC',

    aliases: [
      'SCHNEIDER',
      'SCHNEIDER ELECTRIC',
      'TELEMECANIQUE',
      'MERLIN GERIN',
      'SQUARE D',
      'TAC',
      'GUTOR',
    ],

    partNumberPrefixes: [
      '140DDI',
      '140CPU',
      '170PNT',
      'LC1D',
      'VW3A',
      'ZB4B',
      'NSX100',
      'MTN6',
      'TM2',
    ],
  },

  {
    brand: 'GE',

    aliases: [
      'GE',
      'GE FANUC',
      'GENERAL ELECTRIC',
      'GE MULTILIN',
      'GE ENERGY',
      'GE DIGITAL ENERGY',
    ],

    partNumberPrefixes: [
      'IC200',
      'IC693',
      'IC360',
      'DS200',
      'IS220',
      'FD160',
    ],
  },

  {
    brand: 'HONEYWELL',

    aliases: [
      'HONEYWELL',
      'NOTIFIER',
      'ESSER',
      'CENTRALINE',
      'GENT',
      'EX-OR',
    ],

    partNumberPrefixes: [
      'XSU821',
      'HC900',
      'IOCHAS',
      'W775',
      'FX808',
      'OM30',
      'TPSU24',
    ],
  },

  {
    brand: 'YOKOGAWA',

    aliases: [
      'YOKOGAWA',
    ],

    partNumberPrefixes: [
      'ADV551',
      'ADV151',
      'AAI543',
      'AAI143',
      'SDV144',
      'CP461',
      'SB401',
      'AAB841',
    ],
  },
];

type TestCase = {
  id: string;
  expectedBrand: string | null;
  input: BrandScoringInput;
};

const TEST_CASES: TestCase[] = [
  {
    id: 'siemens-title-and-part-number',
    expectedBrand: 'SIEMENS',

    input: {
      title: 'SIEMENS SIMATIC S7 PLC MODULE',
      partNumber: '6ES7-315-2AG10-0AB0',
      manufacturer: null,
      brand: 'UNKNOWN',
    },
  },

  {
    id: 'abb-title-and-part-number',
    expectedBrand: 'ABB',

    input: {
      title: 'ABB PLC INPUT OUTPUT MODULE',
      partNumber: '3BSE008508R1',
      manufacturer: null,
      brand: 'UNKNOWN',
    },
  },

  {
    id: 'ge-fanuc-part-number',
    expectedBrand: 'GE',

    input: {
      title: 'GE FANUC VERSAMAX INPUT MODULE',
      partNumber: 'IC200MDL650',
      manufacturer: null,
      brand: 'UNKNOWN',
    },
  },

  {
    id: 'schneider-telemecanique',
    expectedBrand: 'SCHNEIDER ELECTRIC',

    input: {
      title: 'TELEMECANIQUE CONTACTOR',
      partNumber: 'LC1D18',
      manufacturer: null,
      brand: 'UNKNOWN',
    },
  },

  {
    id: 'honeywell-notifier',
    expectedBrand: 'HONEYWELL',

    input: {
      title: 'NOTIFIER FIRE ALARM CONTROL MODULE',
      partNumber: 'NFS2-3030',
      manufacturer: null,
      brand: 'UNKNOWN',
    },
  },

  {
    id: 'yokogawa-part-number',
    expectedBrand: 'YOKOGAWA',

    input: {
      title: 'ANALOG INPUT MODULE',
      partNumber: 'AAI543-S00',
      manufacturer: null,
      brand: 'UNKNOWN',
    },
  },

  {
    id: 'manufacturer-only',
    expectedBrand: 'SIEMENS',

    input: {
      title: 'INDUSTRIAL POWER SUPPLY MODULE',
      partNumber: null,
      manufacturer: 'SIEMENS',
      brand: 'UNKNOWN',
    },
  },

  {
    id: 'unresolved-product',
    expectedBrand: null,

    input: {
      title: 'INDUSTRIAL ELECTRONIC MODULE',
      partNumber: 'XYZ-99999',
      manufacturer: null,
      brand: 'UNKNOWN',
    },
  },
];

export async function GET() {
  try {
    const tests = TEST_CASES.map((test) => {
      const result = scoreProductBrand(
        test.input,
        TEST_DICTIONARY
      );

      const passed =
        test.expectedBrand === null
          ? result.decision === 'unresolved'
          : result.brand === test.expectedBrand;

      return {
        id: test.id,
        passed,
        expectedBrand: test.expectedBrand,
        input: test.input,

        result: {
          matched: result.matched,
          brand: result.brand,
          score: result.score,
          confidence: result.confidence,
          decision: result.decision,
          secondPlaceScore:
            result.secondPlaceScore,
          scoreGap: result.scoreGap,
          evidence: result.evidence,
          candidates: result.candidates,
        },
      };
    });

    const passed = tests.filter(
      (test) => test.passed
    ).length;

    const failed = tests.length - passed;

    return NextResponse.json({
      success: true,
      job: 'test-brand-scoring',
      routeVersion: ROUTE_VERSION,
      engineVersion:
        BRAND_SCORING_ENGINE_VERSION,

      summary: {
        totalTests: tests.length,
        passed,
        failed,
        passRate: Number(
          ((passed / tests.length) * 100).toFixed(2)
        ),
        dictionaryBrands:
          TEST_DICTIONARY.length,
      },

      tests,
    });
  } catch (error) {
    console.error(
      'TEST BRAND SCORING ERROR:',
      error
    );

    return NextResponse.json(
      {
        success: false,
        job: 'test-brand-scoring',
        routeVersion: ROUTE_VERSION,
        engineVersion:
          BRAND_SCORING_ENGINE_VERSION,

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
