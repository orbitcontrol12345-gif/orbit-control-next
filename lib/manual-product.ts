import { z } from 'zod';

const optionalHttpUrl = z
  .string()
  .trim()
  .max(2048)
  .refine((value) => {
    if (!value) return true;

    try {
      const url = new URL(value);
      return url.protocol === 'https:';
    } catch {
      return false;
    }
  }, 'Image URL must use https');

export const manualProductInputSchema = z.object({
  name: z.string().trim().min(2).max(300),
  brand: z.string().trim().max(120).default('Unknown'),
  model_number: z.string().trim().min(1).max(160),
  category: z
    .string()
    .trim()
    .max(160)
    .default('Industrial Automation'),
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
  quantity: z.coerce.number().int().min(0).max(1_000_000).default(1),
  image_url: optionalHttpUrl.default(''),
  description: z.string().trim().max(20_000).default(''),
});

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
