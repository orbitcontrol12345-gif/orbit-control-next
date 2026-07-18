/**
 * Shared Brand Intelligence types.
 *
 * هذا الملف لا يتصل بقاعدة البيانات
 * ولا يحتوي على أي منطق تشغيل.
 */

export const BRAND_EVIDENCE_TYPES = [
  'canonical',
  'alias',
  'part-prefix',
  'manufacturer',
  'title-token',
  'manual',
] as const;

export type BrandEvidenceType =
  (typeof BRAND_EVIDENCE_TYPES)[number];

export const BRAND_STATUSES = [
  'active',
  'inactive',
  'merged',
  'blocked',
] as const;

export type BrandStatus =
  (typeof BRAND_STATUSES)[number];

export const EVIDENCE_STATUSES = [
  'candidate',
  'approved',
  'rejected',
  'disabled',
] as const;

export type EvidenceStatus =
  (typeof EVIDENCE_STATUSES)[number];

export type BrandEvidenceMetadata =
  Record<string, unknown>;

/**
 * الشكل الخام القادم من جدول brand_registry.
 * أسماء الحقول مطابقة تمامًا لقاعدة البيانات.
 */
export interface BrandRegistryRow {
  id: number;

  canonical_brand: string;
  normalized_brand: string;

  product_count: number | null;

  status: BrandStatus | string;

  created_at?: string | null;
  updated_at?: string | null;
}

/**
 * الشكل الخام القادم من جدول brand_evidence.
 * أسماء الحقول مطابقة تمامًا لقاعدة البيانات.
 */
export interface BrandEvidenceRow {
  id: number;

  brand_id: number;

  evidence_type:
    | BrandEvidenceType
    | string;

  evidence_value: string;
  normalized_value: string;

  occurrence_count: number | null;
  matching_brand_count: number | null;
  conflicting_brand_count: number | null;

  purity: number | string | null;
  weight: number | string | null;

  status:
    | EvidenceStatus
    | string;

  source: string | null;

  metadata:
    | BrandEvidenceMetadata
    | null;

  created_at?: string | null;
  updated_at?: string | null;
}

/**
 * الشكل النظيف الذي ستستخدمه بقية ملفات النظام.
 */
export interface Brand {
  id: number;

  canonicalBrand: string;
  normalizedBrand: string;

  productCount: number;

  status: BrandStatus;
}

/**
 * Evidence بعد تنظيف وتحويل بيانات Supabase.
 */
export interface BrandEvidence {
  id: number;

  brandId: number;

  type: BrandEvidenceType;

  value: string;
  normalizedValue: string;

  occurrenceCount: number;
  matchingBrandCount: number;
  conflictingBrandCount: number;

  purity: number;
  weight: number;

  status: EvidenceStatus;

  source: string;

  metadata: BrandEvidenceMetadata;
}

/**
 * مدخل واحد داخل قاموس البراندات.
 */
export interface BrandDictionaryEntry {
  brandId: number;

  brand: string;
  normalizedBrand: string;

  productCount: number;

  aliases: string[];
  partNumberPrefixes: string[];
  manufacturers: string[];
  titleTokens: string[];

  evidence: BrandEvidence[];
}

/**
 * قاموس البراندات الكامل.
 */
export interface BrandDictionary {
  generatedAt: string;

  totalBrands: number;
  totalEvidence: number;

  entries: BrandDictionaryEntry[];
}

/**
 * بيانات المنتج التي يحتاجها محرك تحديد البراند.
 */
export interface BrandScoringProduct {
  id?: number | string;

  name?: string | null;
  title?: string | null;

  partNumber?: string | null;
  manufacturer?: string | null;

  existingBrand?: string | null;
}

/**
 * دليل واحد تم العثور عليه أثناء التقييم.
 */
export interface BrandScoreEvidence {
  type: BrandEvidenceType;

  value: string;

  points: number;
  weight: number;

  evidenceId?: number;
}

/**
 * نتيجة براند واحدة مرشحة للمنتج.
 */
export interface BrandCandidateScore {
  brandId: number;

  brand: string;
  normalizedBrand: string;

  score: number;

  matchedEvidence: BrandScoreEvidence[];
}

/**
 * مستوى الثقة النهائي.
 */
export type BrandConfidence =
  | 'high'
  | 'medium'
  | 'review'
  | 'unresolved';

/**
 * نتيجة محرك تحديد البراند.
 */
export interface BrandScoringResult {
  matched: boolean;

  brandId: number | null;
  brand: string | null;
  normalizedBrand: string | null;

  score: number;
  confidence: BrandConfidence;

  reasons: BrandScoreEvidence[];

  alternatives: BrandCandidateScore[];
}

/**
 * عنصر يمكن تخزينه لاحقًا في brand_resolution_queue.
 */
export interface BrandResolutionQueueItem {
  productId: number | string;

  suggestedBrandId: number | null;
  suggestedBrand: string | null;

  score: number;
  confidence: BrandConfidence;

  reasons: BrandScoreEvidence[];

  status:
    | 'pending'
    | 'approved'
    | 'rejected'
    | 'resolved';
}
