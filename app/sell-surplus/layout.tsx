import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Sell Your Surplus Inventory',
  description:
    'Sell industrial automation surplus inventory, obsolete spare parts, PLCs, HMIs, drives, circuit breakers, sensors, and control equipment to Orbit Control Automation.',
  alternates: {
    canonical: 'https://www.orbit-surplus.com/sell-surplus',
  },
};

export default function SellSurplusLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
