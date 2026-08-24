import { z } from 'zod';

import { CATEGORY_NAMES } from '@/lib/catalog-categories';

export const MAX_MANUAL_PRODUCT_IMAGES = 12;

const httpsImageUrl = z
  .string()
  .trim()
  .max(2048)
  .refine((value) => {
    try {
      const url = new URL(value);
      return url.protocol === 'https:';
    } catch {
      return false;
    }
  }, 'Image URL must use https');

const optionalHttpUrl = z.union([
  z.literal(''),
  httpsImageUrl,
]);

const manualGallerySchema = z.preprocess(
  (value) => {
    if (Array.isArray(value)) return value;

    if (typeof value !== 'string' || !value.trim()) {
      return [];
    }

    try {
      const parsed = JSON.parse(value);

      return Array.isArray(parsed) ? parsed : [value];
    } catch {
      return [value];
    }
  },
  z
    .array(httpsImageUrl)
    .max(
      MAX_MANUAL_PRODUCT_IMAGES,
      `A maximum of ${MAX_MANUAL_PRODUCT_IMAGES} images is allowed`,
    )
    .transform((urls) => Array.from(new Set(urls))),
);

export const manualProductInputSchema = z.object({
  name: z.string().trim().min(2).max(300),
  brand: z.string().trim().max(120).default('Unknown'),
  model_number: z.string().trim().min(1).max(160),
  category: z.enum(CATEGORY_NAMES),
  condition: z
    .enum([
      'Used',
      'New',
      'New – Open box',
      'New - Open box',
      'Refurbished',
      'For parts',
    ])
    .default('Used'),
  image_url: optionalHttpUrl.default(''),
  image_urls: manualGallerySchema.default([]),
  description: z.string().trim().max(20_000).default(''),
});

export function buildManualProductGallery(
  imageUrls: string[],
  legacyImageUrl = '',
): string[] {
  return Array.from(
    new Set(
      [...imageUrls, legacyImageUrl]
        .map((url) => url.trim())
        .filter(Boolean),
    ),
  ).slice(0, MAX_MANUAL_PRODUCT_IMAGES);
}

export function slugifyManualProduct(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 180);
}

export function formatValidationError(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join('.') || 'product'}: ${issue.message}`)
    .join('; ');
}
