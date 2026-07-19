export interface PromotionCandidate {
  candidate: string;
  normalizedCandidate: string;

  productCount: number;
  occurrenceCount: number;

  confidenceScore: number;

  recommendation: 'approve' | 'review' | 'reject';

  sourceCounts: {
    'name-first-token': number;
    'name-first-two-tokens': number;
    'name-first-three-tokens': number;
  };

  samples: string[];
}

export interface PromotionFilters {
  minimumProductCount: number;
  minimumConfidence: number;
}

export interface PromotionSummary {
  processed: number;
  approved: number;
  inserted: number;
  skippedExisting: number;
  rejected: number;
}

export interface PromotionResult {
  success: boolean;

  dryRun: boolean;

  summary: PromotionSummary;

  insertedBrands: string[];

  skippedBrands: string[];

  rejectedBrands: string[];

  failures: {
    brand: string;
    reason: string;
  }[];
}
