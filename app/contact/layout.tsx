import type { Metadata } from 'next';
import type { ReactNode } from 'react';

const SITE_URL = 'https://www.orbit-surplus.com';

export const metadata: Metadata = {
  title: 'Contact Us',
  description:
    'Contact Orbit Control Automation for industrial automation parts, RFQ support, worldwide shipping, order assistance, and technical inquiries.',
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
};

export default function ContactLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
