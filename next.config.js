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
    ];
  },

  async rewrites() {
    return [
      {
        source: '/sitemap.xml',
        destination: '/sitemap-index.xml',
      },
    ];
  },
};

module.exports = nextConfig;
