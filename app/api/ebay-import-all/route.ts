import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    message: 'Importer Ready',
    keywords: [
      'PLC',
      'Siemens',
      'ABB',
      'Schneider',
      'Allen Bradley',
      'Honeywell',
      'Omron',
      'Yokogawa',
      'Phoenix Contact',
      'Relay',
      'Module',
      'Controller',
      'Drive',
      'VFD',
      'Sensor'
    ]
  });
}
