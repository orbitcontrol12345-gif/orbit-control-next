/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },

  images: {
    unoptimized: true,
  },

  async redirects() {
    return [
      {
        source: '/product-category/:path*',
        destination: '/categories',
        permanent: true,
      },
      {
        source: '/shop/:path*',
        destination: '/products',
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
