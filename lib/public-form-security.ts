type RateLimitRecord = {
  count: number;
  resetAt: number;
};

type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

const FORM_WINDOW_MS = 10 * 60 * 1000;
const FORM_MAX_REQUESTS = 5;
const MAX_STORED_CLIENTS = 5000;

const globalFormState = globalThis as typeof globalThis & {
  orbitFormRateLimits?: Map<string, RateLimitRecord>;
};

const formRateLimits =
  globalFormState.orbitFormRateLimits ||
  new Map<string, RateLimitRecord>();

globalFormState.orbitFormRateLimits = formRateLimits;

function getClientIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip')?.trim() ||
    'unknown'
  );
}

export function checkPublicFormRateLimit(
  request: Request,
  formName: string,
): RateLimitResult {
  const now = Date.now();
  const key = `${formName}:${getClientIp(request)}`;
  const existing = formRateLimits.get(key);

  if (!existing || existing.resetAt <= now) {
    formRateLimits.set(key, {
      count: 1,
      resetAt: now + FORM_WINDOW_MS,
    });

    return { allowed: true };
  }

  if (existing.count >= FORM_MAX_REQUESTS) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((existing.resetAt - now) / 1000),
      ),
    };
  }

  existing.count += 1;

  if (formRateLimits.size > MAX_STORED_CLIENTS) {
    for (const [storedKey, record] of formRateLimits) {
      if (record.resetAt <= now) {
        formRateLimits.delete(storedKey);
      }
    }
  }

  return { allowed: true };
}

export function cleanFormText(
  value: unknown,
  maxLength: number,
): string {
  return String(value || '')
    .replace(/\0/g, '')
    .trim()
    .slice(0, maxLength);
}

export function sanitizeAttachmentFilename(value: unknown): string {
  const cleaned = String(value || 'attachment')
    .replace(/[\0\r\n]/g, '')
    .replace(/[\\/]/g, '_')
    .trim()
    .slice(0, 180);

  return cleaned || 'attachment';
}

export function escapeHtml(value: unknown): string {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
    .replace(/\r?\n/g, '<br />');
}

export function isValidEmail(value: string): boolean {
  return (
    value.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  );
}

const ALLOWED_ATTACHMENT_EXTENSIONS = new Set([
  'csv',
  'jpeg',
  'jpg',
  'pdf',
  'png',
  'xls',
  'xlsx',
  'zip',
]);

const MAX_ATTACHMENT_FILES = 8;
const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;
const MAX_TOTAL_ATTACHMENT_SIZE = 25 * 1024 * 1024;

export function validateAttachments(files: File[]): string | null {
  const nonEmptyFiles = files.filter((file) => file.size > 0);

  if (nonEmptyFiles.length > MAX_ATTACHMENT_FILES) {
    return `A maximum of ${MAX_ATTACHMENT_FILES} files is allowed.`;
  }

  let totalSize = 0;

  for (const file of nonEmptyFiles) {
    totalSize += file.size;

    if (file.size > MAX_ATTACHMENT_SIZE) {
      return `Each file must be 10MB or smaller.`;
    }

    const extension = file.name
      .split('.')
      .pop()
      ?.toLowerCase();

    if (!extension || !ALLOWED_ATTACHMENT_EXTENSIONS.has(extension)) {
      return `Unsupported attachment type: ${file.name}`;
    }
  }

  if (totalSize > MAX_TOTAL_ATTACHMENT_SIZE) {
    return 'The total attachment size must be 25MB or smaller.';
  }

  return null;
}
