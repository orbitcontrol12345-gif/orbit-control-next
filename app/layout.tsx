import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

import './globals.css';

import FloatingContact from '@/components/FloatingContact';
import Footer from '@/components/layout/Footer';
import Header from '@/components/layout/Header';
import JsonLd from '@/components/seo/JsonLd';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const SITE_URL = 'https://www.orbit-surplus.com';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),

  alternates: {
    canonical: '/',
  },

  title: {
    default:
      'Orbit Control Automation | Industrial Automation & Surplus Parts',
    template: '%s | Orbit Control Automation',
  },

  description:
    'Worldwide supplier of PLCs, HMIs, VFDs, sensors, relays, circuit breakers, obsolete and surplus industrial automation spare parts. Fast RFQ response and global shipping.',

  applicationName: 'Orbit Control Automation',

  keywords: [
    'industrial automation',
    'industrial automation spare parts',
    'PLC spare parts',
    'HMI spare parts',
    'VFD drives',
    'industrial sensors',
    'industrial relays',
    'circuit breakers',
    'obsolete automation parts',
    'surplus industrial parts',
    'control systems',
    'Orbit Control Automation',
  ],

  authors: [
    {
      name: 'Orbit Control Automation',
      url: SITE_URL,
    },
  ],

  creator: 'Orbit Control Automation',
  publisher: 'Orbit Control Automation',
  category: 'Industrial Automation',

  robots: {
    index: true,
    follow: true,

    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },

  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: 'Orbit Control Automation',
    title:
      'Orbit Control Automation | Industrial Automation & Surplus Parts',
    description:
      'Global B2B supplier of industrial automation, electrical, obsolete and surplus spare parts with worldwide shipping.',
    url: SITE_URL,

    images: [
      {
        url: '/logo.png',
        width: 1200,
        height: 630,
        alt: 'Orbit Control Automation',
      },
    ],
  },

  twitter: {
    card: 'summary_large_image',
    title: 'Orbit Control Automation',
    description:
      'Global supplier of industrial automation, obsolete and surplus spare parts.',
    images: ['/logo.png'],
  },

  icons: {
    icon: '/icon.png',
  },

  verification: {
    // سنضيف رمز Google Search Console هنا لاحقًا.
    // google: 'YOUR_GOOGLE_VERIFICATION_CODE',
  },
};

const globalSchema = {
  '@context': 'https://schema.org',

  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${SITE_URL}/#organization`,

      name: 'Orbit Control Automation',
      legalName: 'Orbit Control Automation',

      url: SITE_URL,

      description:
        'Worldwide supplier of industrial automation, electrical, obsolete and surplus spare parts.',

      logo: {
        '@type': 'ImageObject',
        '@id': `${SITE_URL}/#logo`,
        url: `${SITE_URL}/logo.png`,
        contentUrl: `${SITE_URL}/logo.png`,
        caption: 'Orbit Control Automation',
      },

      image: {
        '@id': `${SITE_URL}/#logo`,
      },

      email: 'info@orbit-surplus.com',
      telephone: '+97167677094',

      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Ajman',
        addressRegion: 'Ajman',
        addressCountry: 'AE',
      },

      areaServed: {
        '@type': 'Place',
        name: 'Worldwide',
      },

      contactPoint: [
        {
          '@type': 'ContactPoint',
          telephone: '+97167677094',
          email: 'info@orbit-surplus.com',
          contactType: 'customer service',
          areaServed: 'Worldwide',
          availableLanguage: ['English', 'Arabic'],
        },

        {
          '@type': 'ContactPoint',
          telephone: '+971554835199',
          email: 'info@orbit-surplus.com',
          contactType: 'sales',
          areaServed: 'Worldwide',
          availableLanguage: ['English', 'Arabic'],
        },
      ],
    },
  {
  '@type': 'WebSite',
  '@id': `${SITE_URL}/#website`,

  url: SITE_URL,
  name: 'Orbit Control Automation',

  description:
    'Industrial automation, electrical, obsolete and surplus spare parts supplied worldwide.',

  publisher: {
    '@id': `${SITE_URL}/#organization`,
  },

  inLanguage: 'en',
},

{
  '@type': 'WebPage',
  '@id': `${SITE_URL}/#webpage`,

  url: SITE_URL,
  name: 'Orbit Control Automation',

  isPartOf: {
    '@id': `${SITE_URL}/#website`,
  },

  about: {
    '@id': `${SITE_URL}/#organization`,
  },

  primaryImageOfPage: {
    '@id': `${SITE_URL}/#logo`,
  },

  inLanguage: 'en',
},
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body
        className={`${inter.className} min-h-screen bg-[#07111f] text-slate-100 antialiased`}
      >
        <div className="fixed inset-0 -z-10 overflow-hidden bg-[radial-gradient(circle_at_top_left,#153c4f_0%,transparent_32%),radial-gradient(circle_at_top_right,#4b2e12_0%,transparent_28%),linear-gradient(180deg,#07111f_0%,#081827_45%,#050b14_100%)]" />

        <div className="fixed inset-0 -z-10 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:42px_42px] opacity-40" />

        <Header />

        <main className="relative">{children}</main>

        <Footer />

        <FloatingContact />

        <JsonLd id="global-schema" data={globalSchema} />
      </body>
    </html>
  );
}
