import { NextResponse } from 'next/server';
import { extractIndustrialPartNumberV2 } from '@/lib/industrial-part-number-v2';

export const dynamic = 'force-dynamic';

export async function GET() {
  const samples = [
    'VERTIV 15B10903G1 REV.2 / 15H50581 REV.A BOARD SUPPLY INTERFACE',
    'SIEMENS 15B10621G100 REV.8 15C50416 REV.D CIRCUIT BOARD',
    'EMERSON 710-02821-08P 15H50607 REV.A CIRCUIT BOARD',
    'LOT OF 3 PIECES. SMITT RELAYS FDA-125 HEAVY-DUTY RELAY 125VDC',
    'METROBILITY R643-15 CARD,10/100M TX TO 100M FX/MM-ST',
  ];

  return NextResponse.json(
    samples.map((title) => ({
      title,
      extracted: extractIndustrialPartNumberV2(title),
    }))
  );
}
