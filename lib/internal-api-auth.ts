export function getInternalApiHeaders(
  headers: HeadersInit = {},
): Headers {
  const cronSecret = process.env.CRON_SECRET?.trim() || '';

  if (!cronSecret) {
    throw new Error(
      'CRON_SECRET is required for internal API requests',
    );
  }

  const result = new Headers(headers);
  result.set('Authorization', `Bearer ${cronSecret}`);

  return result;
}
