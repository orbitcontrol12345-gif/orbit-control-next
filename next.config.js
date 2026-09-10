const isDevelopment = process.env.NODE_ENV === 'development';

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data: https://pub-e11286a0a91241bfbfe0d74a29552eed.r2.dev https://i.ebayimg.com https://images.pexels.com https://xofucnqpqmxztazhtqix.supabase.co",
  "font-src 'self' data:",
  "connect-src 'self' https://xofucnqpqmxztazhtqix.supabase.co wss://xofucnqpqmxztazhtqix.supabase.co",
  "media-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "frame-src 'none'",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  'upgrade-insecure-requests',
].join('; ');

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,

  images: {
    // Keep one broadly supported output format and one quality. Product pages
    // retain responsive images, while crawlers cannot fan out every source
    // image across dozens of format/quality/width combinations.
    formats: ['image/webp'],
    qualities: [75],
    deviceSizes: [640, 828, 1080, 1200, 1600],
    imageSizes: [48, 64, 96, 256, 384],

    // R2 product URLs are immutable and receive a new ?v= value whenever an
    // image is replaced, so a one-year optimizer cache cannot make them stale.
    minimumCacheTTL: 31536000,
    remotePatterns: [
      {
        protocol: 'https',
        hostname:
          'pub-e11286a0a91241bfbfe0d74a29552eed.r2.dev',
        pathname: '/orbit-control/products/**',
      },
      {
        protocol: 'https',
        hostname: 'i.ebayimg.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.pexels.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'xofucnqpqmxztazhtqix.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'Permissions-Policy',
            value:
              'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()',
          },
          {
            key: 'X-Permitted-Cross-Domain-Policies',
            value: 'none',
          },
          {
            key: 'Content-Security-Policy',
            value: contentSecurityPolicy,
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000',
          },
          {
            key: 'Cross-Origin-Resource-Policy',
            value: 'same-origin',
          },
          {
            key: 'Origin-Agent-Cluster',
            value: '?1',
          },
        ],
      },
    ];
  },

  async redirects() {
  return [
    {
      source: '/product-category/:path*',
      destination: '/categories',
      permanent: true,
    },
    {
  source: '/home',
  destination: '/',
  permanent: true,
  },
{
  source: '/home/:path*',
  destination: '/:path*',
  permanent: true,
},
    {
      source: '/shop/:path*',
      destination: '/products',
      permanent: true,
    },
    {
      source: '/shop-by-category',
      destination: '/categories',
      permanent: true,
    },
    {
      source: '/shop-by-category/:path*',
      destination: '/categories',
      permanent: true,
    },
    {
      source: '/brand/:path*',
      destination: '/brands',
      permanent: true,
    },
    {
      source: '/about-us',
      destination: '/about',
      permanent: true,
    },
    {
      source: '/contact-us',
      destination: '/contact',
      permanent: true,
    },
    {
      source: '/daily-deals',
      destination: '/products',
      permanent: true,
    },
    {
      source: '/login',
      destination: '/',
      permanent: true,
    },
  ];
},

  async rewrites() {
    return [];
  },
};

module.exports = nextConfig;
