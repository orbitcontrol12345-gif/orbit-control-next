import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { extractPartNumber } from '@/lib/part-number';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('products')
      .select(
        'id, ebay_item_id, brand, part_number, model_number, name, description'
      )
      .eq('is_active', true)
      .order('id', { ascending: false })
      .limit(500);

    if (error) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        { status: 500 }
      );
    }

    const results = (data || []).map((item) => {
      const name = String(item.name || '').trim();
      const description = String(item.description || '').trim();

      const extractedFromName = extractPartNumber(name);
      const extractedFromDescription = extractPartNumber(description);

      const extractedPartNumber =
        extractedFromDescription || extractedFromName || '';

      const currentPartNumber = String(
        item.part_number || ''
      ).trim().toUpperCase();

      const normalizedExtracted = String(
        extractedPartNumber || ''
      ).trim().toUpperCase();

      const changed =
        Boolean(normalizedExtracted) &&
        normalizedExtracted !== currentPartNumber;

      return {
        id: item.id,
        ebay_item_id: item.ebay_item_id,
        brand: item.brand,
        current_part_number: item.part_number,
        current_model_number: item.model_number,
        extracted_from_name: extractedFromName || null,
        extracted_from_description:
          extractedFromDescription || null,
        proposed_part_number:
          extractedPartNumber || 'UNKNOWN',
        changed,
        name,
        description,
      };
    });

    const changedResults = results.filter(
      (item) => item.changed
    );

    return NextResponse.json({
      success: true,
      checked: results.length,
      changed: changedResults.length,
      unchanged: results.length - changedResults.length,
      changed_results: changedResults,
      results,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}
