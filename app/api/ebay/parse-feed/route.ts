import { NextResponse } from 'next/server';
import { getEbayToken } from '@/lib/ebay';
import JSZip from 'jszip';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function matchAll(text: string, regex: RegExp) {
  return Array.from(text.matchAll(regex));
}

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

    const blocks = matchAll(xml, /<SKUDetails>([\s\S]*?)<\/SKUDetails>/g);

    const allItems = blocks.map((m) => {
      const block = m[1];
      const itemId = block.match(/<ItemID>(.*?)<\/ItemID>/)?.[1] || '';
      const sku = block.match(/<SKU>(.*?)<\/SKU>/)?.[1] || '';
      const quantity = Number(block.match(/<Quantity>(.*?)<\/Quantity>/)?.[1] || 0);
      const priceMatch = block.match(/<Price currencyID="(.*?)">(.*?)<\/Price>/);
      const currency = priceMatch?.[1] || '';
      const price = Number(priceMatch?.[2] || 0);

      return { itemId, sku, quantity, currency, price };
    });

    const usdItems = allItems.filter((x) => x.currency === 'USD' && x.itemId);

    return NextResponse.json({
      success: true,
      fileName,
      totalItems: allItems.length,
      usdItems: usdItems.length,
      first20Usd: usdItems.slice(0, 20),
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
    });
  }
}
