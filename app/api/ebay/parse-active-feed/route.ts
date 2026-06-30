import { NextResponse } from 'next/server';
import { getEbayToken } from '@/lib/ebay';
import JSZip from 'jszip';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const TASK_ID = 'task-20-28117945024514';

function getTag(xml: string, tag: string) {
  const match = xml.match(new RegExp(`<${tag}[^>]*>(.*?)</${tag}>`, 's'));
  return match?.[1]?.trim() || null;
}

export async function GET() {
  try {
    const { access_token } = await getEbayToken();

    const response = await fetch(
      `https://api.ebay.com/sell/feed/v1/task/${TASK_ID}/download_result_file`,
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
          'Accept-Language': 'en-US',
        },
      }
    );

    if (!response.ok) {
      return NextResponse.json({
        success: false,
        status: response.status,
        error: await response.text(),
      });
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const zip = await JSZip.loadAsync(buffer);
    const fileName = Object.keys(zip.files)[0];
    const xml = await zip.files[fileName].async('string');

    const blocks = xml.match(/<SKUDetails>[\s\S]*?<\/SKUDetails>/g) || [];

    const preview = xml.substring(0, 15000);

    return NextResponse.json({
      success: true,
      taskId: TASK_ID,
      fileName,
      totalItems: blocks.length,
      preview,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
