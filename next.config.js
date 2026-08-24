/** @type {import('next').NextConfig} */
const nextConfig = {
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
