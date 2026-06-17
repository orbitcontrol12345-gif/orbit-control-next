import FloatingContact from '@/components/FloatingContact';
import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  metadataBase: new URL('https://xeltronic.com'),

  alternates: {
    canonical: '/',
  },

  title: {
    default: 'Xeltronic Electrical Solution — Industrial Automation Spare Parts',
    template: '%s | Xeltronic Electrical Solution',
  },
  description:
    'Global supplier of industrial automation and electrical spare parts. PLCs, HMIs, drives, sensors, circuit breakers, and obsolete automation parts. Fast RFQ response. Worldwide shipping via DHL & FedEx.',
  keywords: [
    'industrial automation parts',
    'PLC spare parts',
    'HMI parts',
    'VFD drives',
    'Siemens parts',
    'ABB automation',
    'Allen-Bradley parts',
    'obsolete PLC parts',
    'industrial electrical parts UAE',
    'request for quote industrial',
  ],
  authors: [{ name: 'Xeltronic Electrical Solution' }],
  openGraph: {
    type: 'website',
    siteName: 'Xeltronic Electrical Solution',
    title: 'Xeltronic Electrical Solution — Industrial Automation Spare Parts',
    description: 'Global B2B supplier of industrial automation and electrical spare parts. Fast RFQ response.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Xeltronic Electrical Solution',
    description: 'Global B2B supplier of industrial automation spare parts.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className={`${inter.className} bg-navy-900 text-slate-100`}>
  <Header />
  <main>{children}</main>
  <Footer />
  <FloatingContact />

  <script
  id="organization-schema"
  type="application/ld+json"
  dangerouslySetInnerHTML={{
    __html: JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "Xeltronic Electrical Solution",
      url: "https://xeltronic.com",
      logo: "https://xeltronic.com/logo.png",
    }),
  }}
/>
</body>
    </html>
  );
}
