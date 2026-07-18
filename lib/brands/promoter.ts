import { supabaseAdmin } from '@/lib/supabase-admin';

import type {
  ValidatedBrandEvidence,
} from '@/lib/brands/validator';

export const BRAND_PROMOTER_VERSION =
  'BRAND-PROMOTER-V1';

export interface PromoteResult {
  inserted: boolean;
  skipped: boolean;
  reason: string;
}

export async function promoteEvidence(
  evidence: ValidatedBrandEvidence,
  dryRun = false
): Promise<PromoteResult> {

  if (
    evidence.validationDecision !==
    'eligible'
  ) {
    return {
      inserted: false,
      skipped: true,
      reason: 'not-eligible',
    };
  }

  const existing =
  await supabaseAdmin
    .from('brand_evidence')
    .select('id')
    .eq('brand_id', evidence.winningBrandId)
    .eq('evidence_type', evidence.type)
    .eq('normalized_value', evidence.normalizedValue)
    .eq('source', 'auto-learning')
    .maybeSingle();

  if (existing.data) {
    return {
      inserted: false,
      skipped: true,
      reason: 'already-exists',
    };
  }

  if (dryRun) {
    return {
      inserted: false,
      skipped: false,
      reason: 'dry-run',
    };
  }

  const insert =
    await supabaseAdmin
      .from('brand_evidence')
      .insert({
        brand_id:
          evidence.winningBrandId,

        evidence_type:
          evidence.type,

        evidence_value:
          evidence.value,

        normalized_value:
          evidence.normalizedValue,

        occurrence_count:
          evidence.occurrenceCount,

        matching_brand_count:
          evidence.winningBrandCount,

        conflicting_brand_count:
          evidence.conflictingCount,

        purity:
          evidence.purity,

        weight:
          evidence.validationScore,

        status:
          'approved',

        source:
          'auto-learning',

        metadata: {
          validatorVersion:
            BRAND_PROMOTER_VERSION,

          recommendation:
            evidence.recommendation,

          validationDecision:
            evidence.validationDecision,

          validationScore:
            evidence.validationScore,

          sampleProducts:
            evidence.sampleProductIds,

          distribution:
            evidence.brandDistribution,
        },
      });

  if (insert.error) {
    throw insert.error;
  }

  return {
    inserted: true,
    skipped: false,
    reason: 'inserted',
  };
}
