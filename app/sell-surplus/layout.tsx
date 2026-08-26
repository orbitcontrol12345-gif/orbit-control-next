import type { Metadata } from 'next';
import type { ReactNode } from 'react';

const SITE_URL = 'https://www.orbit-surplus.com';
const DESCRIPTION =
  'Sell surplus industrial automation inventory to Orbit Control Automation. Submit PLCs, HMIs, drives, sensors and obsolete parts for a professional evaluation.';

export const metadata: Metadata = {
  title: 'Sell Surplus Industrial Parts',
  description: DESCRIPTION,
  alternates: {
    canonical: `${SITE_URL}/sell-surplus`,
  },
  openGraph: {
    type: 'website',
    url: `${SITE_URL}/sell-surplus`,
    title: 'Sell Surplus Industrial Parts',
    description: DESCRIPTION,
    siteName: 'Orbit Control Automation',
    images: [`${SITE_URL}/og-image.jpg`],
  },
};

export default function SellSurplusLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return children;
}
