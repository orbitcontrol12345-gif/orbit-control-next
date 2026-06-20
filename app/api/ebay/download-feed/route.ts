import { NextResponse } from 'next/server';
import { getEbayToken } from '@/lib/ebay';
import JSZip from 'jszip';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const taskId = 'task-20-27945426550787';

  try {
    const token = await getEbayToken();
    const accessToken = String(token.access_token).trim();

    const response = await fetch(
      `https://api.ebay.com/sell/feed/v1/task/${taskId}/download_result_file`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Accept-Language': 'en-US',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();

      return NextResponse.json({
        success: false,
        status: response.status,
        error: errorText,
      });
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    const zip = await JSZip.loadAsync(buffer);

    const fileName = Object.keys(zip.files)[0];

    const xml = await zip.files[fileName].async('string');

    return NextResponse.json({
      success: true,
      fileName,
      xmlLength: xml.length,
      preview: xml.substring(0, 5000),
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
    });
  }
}
