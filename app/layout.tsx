import FloatingContact from '@/components/FloatingContact';
import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  metadataBase: new URL('https://www.orbit-surplus.com'),
  alternates: {
    canonical: '/',
  },
  title: {
    default: 'Orbit Control Automation — Industrial Automation & Surplus Parts',
    template: '%s | Orbit Control Automation',
  },
 description:
  'Worldwide supplier of PLCs, HMIs, VFDs, sensors, relays, circuit breakers, surplus and obsolete industrial automation spare parts. Fast RFQ response and global shipping.',
  keywords: [
  'industrial automation',
  'PLC spare parts',
  'HMI',
  'VFD',
  'industrial surplus',
  'obsolete parts',
  'circuit breakers',
  'sensors',
  'control systems',
  'Orbit Control Automation',
],
  authors: [{ name: 'Orbit Control Automation' }],
  openGraph: {
    type: 'website',
    siteName: 'Orbit Control Automation',
    title: 'Orbit Control Automation — Industrial Automation & Surplus Parts',
    description:
      'Global B2B supplier of industrial automation, electrical, obsolete and surplus spare parts.',
    url: 'https://www.orbit-surplus.com',
    images: ['https://www.orbit-surplus.com/logo.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Orbit Control Automation',
    description:
      'Global supplier of industrial automation and surplus spare parts.',
    images: ['https://www.orbit-surplus.com/logo.png'],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className={`${inter.className} min-h-screen bg-[#07111f] text-slate-100 antialiased`}>
        <div className="fixed inset-0 -z-10 overflow-hidden bg-[radial-gradient(circle_at_top_left,#153c4f_0%,transparent_32%),radial-gradient(circle_at_top_right,#4b2e12_0%,transparent_28%),linear-gradient(180deg,#07111f_0%,#081827_45%,#050b14_100%)]" />
        <div className="fixed inset-0 -z-10 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:42px_42px] opacity-40" />

        <Header />

        <main className="relative">
          {children}
        </main>

        <Footer />
        <FloatingContact />

        <script
  id="seo-schema"
  type="application/ld+json"
  dangerouslySetInnerHTML={{
    __html: JSON.stringify({
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "Organization",
          "@id": "https://www.orbit-surplus.com/#organization",
          name: "Orbit Control Automation",
          url: "https://www.orbit-surplus.com",
          logo: "https://www.orbit-surplus.com/logo.png",
          email: "info@orbit-surplus.com",
          telephone: "+971676777094",
          address: {
            "@type": "PostalAddress",
            addressCountry: "AE",
            addressRegion: "Ajman",
            addressLocality: "Ajman",
          },
          sameAs: [
            "https://www.orbit-surplus.com"
          ],
        },
        {
          "@type": "WebSite",
          "@id": "https://www.orbit-surplus.com/#website",
          url: "https://www.orbit-surplus.com",
          name: "Orbit Control Automation",
          publisher: {
            "@id": "https://www.orbit-surplus.com/#organization",
          },
          potentialAction: {
            "@type": "SearchAction",
            target:
              "https://www.orbit-surplus.com/products?q={search_term_string}",
            "query-input": "required name=search_term_string",
          },
        },
      ],
    }),
  }}
/>
      </body>
    </html>
  );
}
