/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    formats: ['image/avif', 'image/webp'],
    qualities: [60, 70, 75, 85],
    minimumCacheTTL: 86400,
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
