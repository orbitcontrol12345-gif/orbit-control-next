import { NextResponse } from 'next/server';
import { extractPartNumber } from '@/lib/part-number';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const tests = [
    'Schneider Electric 140DDI35300 24VDC Input Module',
    'Siemens 6ES7321-1BL00-0AA0 Digital Input Module 24VDC',
    'Allen Bradley 1756-L73 ControlLogix Processor',
    'Allen Bradley 1769-IF8 Analog Input Module',
    'Omron CJ1W-OD211 Output Unit 24VDC',
    'ABB ACS550-01-012A-4 VFD Drive 400VAC',
    'Honeywell DC1040CT-302000-E Controller 100-240VAC',
    'Power Supply 24VDC 10A',
    'Sensor 230VAC 50Hz',
    'Motor 400VAC 3PH 50HZ',
  ];

  return NextResponse.json({
    success: true,
    results: tests.map((title) => ({
      title,
      extracted_part_number: extractPartNumber(title),
    })),
  });
}
