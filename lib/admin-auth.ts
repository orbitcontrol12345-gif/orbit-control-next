const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const ADMIN_SESSION_COOKIE = 'orbit_admin_session';
export const ADMIN_SESSION_MAX_AGE = 60 * 60 * 8;

type AdminSessionPayload = {
  version: 1;
  username: string;
  issuedAt: number;
  expiresAt: number;
  sessionId: string;
};

function getSessionSecret(): string | null {
  const secret = process.env.ADMIN_SESSION_SECRET?.trim();

  return secret && secret.length >= 32 ? secret : null;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/g, '');
}

function fromBase64Url(value: string): Uint8Array {
  const base64 = value
    .replaceAll('-', '+')
    .replaceAll('_', '/')
    .padEnd(Math.ceil(value.length / 4) * 4, '=');

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

async function importSigningKey(secret: string) {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    {
      name: 'HMAC',
      hash: 'SHA-256',
    },
    false,
    ['sign', 'verify'],
  );
}

export async function createAdminSessionToken(
  username: string,
): Promise<string> {
  const secret = getSessionSecret();

  if (!secret) {
    throw new Error(
      'ADMIN_SESSION_SECRET must contain at least 32 characters',
    );
  }

  const now = Math.floor(Date.now() / 1000);
  const payload: AdminSessionPayload = {
    version: 1,
    username,
    issuedAt: now,
    expiresAt: now + ADMIN_SESSION_MAX_AGE,
    sessionId: crypto.randomUUID(),
  };

  const encodedPayload = toBase64Url(
    encoder.encode(JSON.stringify(payload)),
  );
  const key = await importSigningKey(secret);
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(encodedPayload),
  );

  return `${encodedPayload}.${toBase64Url(
    new Uint8Array(signature),
  )}`;
}

export async function verifyAdminSessionToken(
  token?: string,
): Promise<AdminSessionPayload | null> {
  const secret = getSessionSecret();
  const expectedUsername = process.env.ADMIN_USERNAME?.trim();

  if (!secret || !expectedUsername || !token || token.length > 2048) {
    return null;
  }

  const parts = token.split('.');

  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return null;
  }

  try {
    const [encodedPayload, encodedSignature] = parts;
    const key = await importSigningKey(secret);
    const validSignature = await crypto.subtle.verify(
      'HMAC',
      key,
      fromBase64Url(encodedSignature),
      encoder.encode(encodedPayload),
    );

    if (!validSignature) {
      return null;
    }

    const payload = JSON.parse(
      decoder.decode(fromBase64Url(encodedPayload)),
    ) as Partial<AdminSessionPayload>;
    const now = Math.floor(Date.now() / 1000);

    if (
      payload.version !== 1 ||
      typeof payload.username !== 'string' ||
      payload.username !== expectedUsername ||
      typeof payload.issuedAt !== 'number' ||
      typeof payload.expiresAt !== 'number' ||
      typeof payload.sessionId !== 'string' ||
      payload.issuedAt > now + 60 ||
      payload.expiresAt <= now ||
      payload.expiresAt - payload.issuedAt >
        ADMIN_SESSION_MAX_AGE
    ) {
      return null;
    }

    return payload as AdminSessionPayload;
  } catch {
    return null;
  }
}
