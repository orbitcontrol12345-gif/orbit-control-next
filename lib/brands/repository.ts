import { supabaseAdmin } from '@/lib/supabase-admin';

import type {
  Brand,
  BrandEvidence,
  BrandEvidenceMetadata,
  BrandEvidenceRow,
  BrandEvidenceType,
  BrandRegistryRow,
  BrandStatus,
  EvidenceStatus,
} from '@/lib/brands/types';

const PAGE_SIZE = 1000;

/**
 * نتأكد أن القيمة Object قبل قراءة خصائصها.
 */
function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  );
}

function toStringValue(
  value: unknown,
  fallback = ''
): string {
  if (
    typeof value === 'string' ||
    typeof value === 'number'
  ) {
    return String(value).trim();
  }

  return fallback;
}

function toNumberValue(
  value: unknown,
  fallback = 0
): number {
  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : fallback;
}

function toMetadata(
  value: unknown
): BrandEvidenceMetadata {
  return isRecord(value)
    ? value
    : {};
}

/**
 * يحول صف brand_registry الخام إلى الشكل النظيف المستخدم داخل المشروع.
 */
function mapBrandRow(
  row: BrandRegistryRow
): Brand {
  return {
    id: toNumberValue(row.id),

    canonicalBrand:
      toStringValue(
        row.canonical_brand
      ),

    normalizedBrand:
      toStringValue(
        row.normalized_brand
      ).toUpperCase(),

    productCount:
      toNumberValue(
        row.product_count
      ),

    status:
      toStringValue(
        row.status,
        'active'
      ) as BrandStatus,
  };
}

/**
 * يحول صف brand_evidence الخام إلى الشكل النظيف المستخدم داخل المشروع.
 */
function mapEvidenceRow(
  row: BrandEvidenceRow
): BrandEvidence {
  return {
    id:
      toNumberValue(row.id),

    brandId:
      toNumberValue(row.brand_id),

    type:
      toStringValue(
        row.evidence_type
      ) as BrandEvidenceType,

    value:
      toStringValue(
        row.evidence_value
      ),

    normalizedValue:
      toStringValue(
        row.normalized_value ||
          row.evidence_value
      ).toUpperCase(),

    occurrenceCount:
      toNumberValue(
        row.occurrence_count
      ),

    matchingBrandCount:
      toNumberValue(
        row.matching_brand_count
      ),

    conflictingBrandCount:
      toNumberValue(
        row.conflicting_brand_count
      ),

    purity:
      toNumberValue(row.purity),

    weight:
      toNumberValue(row.weight),

    status:
      toStringValue(
        row.status,
        'candidate'
      ) as EvidenceStatus,

    source:
      toStringValue(
        row.source,
        'unknown'
      ),

    metadata:
      toMetadata(row.metadata),
  };
}

/**
 * تحويل بيانات Supabase إلى صفوف brand_registry
 * بدون الاعتماد على Supabase generated types.
 */
function parseBrandRows(
  data: unknown
): BrandRegistryRow[] {
  if (!Array.isArray(data)) {
    return [];
  }

  return data
    .filter(isRecord)
    .map((row): BrandRegistryRow => ({
      id:
        toNumberValue(row.id),

      canonical_brand:
        toStringValue(
          row.canonical_brand
        ),

      normalized_brand:
        toStringValue(
          row.normalized_brand
        ),

      product_count:
        row.product_count == null
          ? null
          : toNumberValue(
              row.product_count
            ),

      status:
        toStringValue(
          row.status,
          'active'
        ),

      created_at:
        row.created_at == null
          ? null
          : toStringValue(
              row.created_at
            ),

      updated_at:
        row.updated_at == null
          ? null
          : toStringValue(
              row.updated_at
            ),
    }));
}

/**
 * تحويل بيانات Supabase إلى صفوف brand_evidence
 * بدون Cast مباشر يسبب GenericStringError.
 */
function parseEvidenceRows(
  data: unknown
): BrandEvidenceRow[] {
  if (!Array.isArray(data)) {
    return [];
  }

  return data
    .filter(isRecord)
    .map((row): BrandEvidenceRow => ({
      id:
        toNumberValue(row.id),

      brand_id:
        toNumberValue(
          row.brand_id
        ),

      evidence_type:
        toStringValue(
          row.evidence_type
        ),

      evidence_value:
        toStringValue(
          row.evidence_value
        ),

      normalized_value:
        toStringValue(
          row.normalized_value
        ),

      occurrence_count:
        row.occurrence_count == null
          ? null
          : toNumberValue(
              row.occurrence_count
            ),

      matching_brand_count:
        row.matching_brand_count == null
          ? null
          : toNumberValue(
              row.matching_brand_count
            ),

      conflicting_brand_count:
        row.conflicting_brand_count == null
          ? null
          : toNumberValue(
              row.conflicting_brand_count
            ),

      purity:
        row.purity == null
          ? null
          : toNumberValue(
              row.purity
            ),

      weight:
        row.weight == null
          ? null
          : toNumberValue(
              row.weight
            ),

      status:
        toStringValue(
          row.status,
          'candidate'
        ),

      source:
        row.source == null
          ? null
          : toStringValue(
              row.source
            ),

      metadata:
        isRecord(row.metadata)
          ? row.metadata
          : null,

      created_at:
        row.created_at == null
          ? null
          : toStringValue(
              row.created_at
            ),

      updated_at:
        row.updated_at == null
          ? null
          : toStringValue(
              row.updated_at
            ),
    }));
}

/**
 * قراءة جميع البراندات النشطة من brand_registry.
 */
export async function getActiveBrands():
  Promise<Brand[]> {
  const brands: Brand[] = [];

  let offset = 0;

  while (true) {
    const { data, error } =
      await supabaseAdmin
        .from('brand_registry')
        .select('*')
        .eq('status', 'active')
        .order('id', {
          ascending: true,
        })
        .range(
          offset,
          offset + PAGE_SIZE - 1
        );

    if (error) {
      throw new Error(
        `Failed to load active brands: ${error.message}`
      );
    }

    const page =
      parseBrandRows(data);

    brands.push(
      ...page.map(mapBrandRow)
    );

    if (page.length < PAGE_SIZE) {
      break;
    }

    offset += PAGE_SIZE;
  }

  return brands;
}

/**
 * قراءة جميع الأدلة المعتمدة من brand_evidence.
 */
export async function getApprovedEvidence():
  Promise<BrandEvidence[]> {
  const evidence: BrandEvidence[] = [];

  let offset = 0;

  while (true) {
    const { data, error } =
      await supabaseAdmin
        .from('brand_evidence')
        .select('*')
        .eq('status', 'approved')
        .order('id', {
          ascending: true,
        })
        .range(
          offset,
          offset + PAGE_SIZE - 1
        );

    if (error) {
      throw new Error(
        `Failed to load approved brand evidence: ${error.message}`
      );
    }

    const page =
      parseEvidenceRows(data);

    evidence.push(
      ...page.map(mapEvidenceRow)
    );

    if (page.length < PAGE_SIZE) {
      break;
    }

    offset += PAGE_SIZE;
  }

  return evidence;
}
