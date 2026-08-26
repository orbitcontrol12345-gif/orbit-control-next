import type { Metadata } from 'next';
import type { ReactNode } from 'react';

const SITE_URL = 'https://www.orbit-surplus.com';
const DESCRIPTION =
  'Contact Orbit Control Automation for industrial spare-part inquiries, technical questions, order support and RFQs. Based in the UAE and supplying worldwide.';

export const metadata: Metadata = {
  title: 'Contact Us',
  description: DESCRIPTION,
  alternates: {
    canonical: `${SITE_URL}/contact`,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    url: `${SITE_URL}/contact`,
    title: 'Contact Orbit Control Automation',
    description: DESCRIPTION,
    siteName: 'Orbit Control Automation',
    images: [`${SITE_URL}/og-image.jpg`],
  },
};

export default function ContactLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return children;
}
