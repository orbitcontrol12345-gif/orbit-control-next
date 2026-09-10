type RateLimitRecord = {
  count: number;
  resetAt: number;
};

type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

type RequestBodyValidationOptions = {
  allowedMediaTypes: readonly string[];
  maxBytes: number;
};

type RequestBodyValidationError = {
  error: string;
  status: 413 | 415;
};

const FORM_WINDOW_MS = 10 * 60 * 1000;
const FORM_MAX_REQUESTS = 5;
const MAX_STORED_CLIENTS = 5000;

export const MAX_PUBLIC_JSON_BODY_BYTES = 64 * 1024;
export const MAX_PUBLIC_MULTIPART_BODY_BYTES =
  28 * 1024 * 1024;

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

export function validateRequestBodyHeaders(
  request: Request,
  options: RequestBodyValidationOptions,
): RequestBodyValidationError | null {
  const mediaType = request.headers
    .get('content-type')
    ?.split(';', 1)[0]
    ?.trim()
    .toLowerCase();

  if (!mediaType || !options.allowedMediaTypes.includes(mediaType)) {
    return {
      error: 'Unsupported request content type.',
      status: 415,
    };
  }

  const rawLength = request.headers.get('content-length');

  if (rawLength) {
    const contentLength = Number(rawLength);

    if (
      Number.isFinite(contentLength) &&
      contentLength > options.maxBytes
    ) {
      return {
        error: 'The request body is too large.',
        status: 413,
      };
    }
  }

  return null;
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

function startsWithBytes(
  bytes: Uint8Array,
  signature: readonly number[],
): boolean {
  return signature.every((byte, index) => bytes[index] === byte);
}

function containsAscii(bytes: Uint8Array, value: string): boolean {
  const signature = new TextEncoder().encode(value);

  for (
    let offset = 0;
    offset <= bytes.length - signature.length;
    offset += 1
  ) {
    if (
      signature.every(
        (byte, index) => bytes[offset + index] === byte,
      )
    ) {
      return true;
    }
  }

  return false;
}

export async function validateAttachmentContents(
  files: File[],
): Promise<string | null> {
  for (const file of files.filter((entry) => entry.size > 0)) {
    const extension = file.name
      .split('.')
      .pop()
      ?.toLowerCase();
    const bytes = new Uint8Array(
      await file.slice(0, 1024).arrayBuffer(),
    );

    let valid = false;

    switch (extension) {
      case 'jpeg':
      case 'jpg':
        valid = startsWithBytes(bytes, [0xff, 0xd8, 0xff]);
        break;
      case 'png':
        valid = startsWithBytes(bytes, [
          0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
        ]);
        break;
      case 'pdf':
        valid = containsAscii(bytes, '%PDF-');
        break;
      case 'xls':
        valid = startsWithBytes(bytes, [
          0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1,
        ]);
        break;
      case 'xlsx':
      case 'zip':
        valid =
          startsWithBytes(bytes, [0x50, 0x4b, 0x03, 0x04]) ||
          startsWithBytes(bytes, [0x50, 0x4b, 0x05, 0x06]) ||
          startsWithBytes(bytes, [0x50, 0x4b, 0x07, 0x08]);
        break;
      case 'csv':
        valid = !startsWithBytes(bytes, [0x4d, 0x5a]);
        break;
      default:
        valid = false;
    }

    if (!valid) {
      return `Attachment content does not match its file type: ${sanitizeAttachmentFilename(
        file.name,
      )}`;
    }
  }

  return null;
}
