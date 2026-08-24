const OPTIMIZED_IMAGE_HOSTS = new Set([
  'pub-e11286a0a91241bfbfe0d74a29552eed.r2.dev',
  'i.ebayimg.com',
  'images.pexels.com',
  'xofucnqpqmxztazhtqix.supabase.co',
]);

export function canOptimizeImage(value: unknown): boolean {
  const src = String(value || '').trim();

  if (!src) {
    return false;
  }

  if (src.startsWith('/')) {
    return !src.toLowerCase().endsWith('.svg');
  }

  try {
    const url = new URL(src);

    return (
      url.protocol === 'https:' &&
      OPTIMIZED_IMAGE_HOSTS.has(url.hostname.toLowerCase())
    );
  } catch {
    return false;
  }
}
