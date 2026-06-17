import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

const BATCH_SIZE = 500;

function cleanProductTitle(value?: string | null) {
  if (!value) return null;

  let text = value;

  const removePatterns = [
    /\bNEW\s*W\/?\s*FILTHY\s*BOX\b/gi,
    /\bNEW\s*WITH\s*FILTHY\s*BOX\b/gi,
    /\bW\/?\s*FILTHY\s*BOX\b/gi,
    /\bWITH\s*FILTHY\s*BOX\b/gi,
    /\bFILTHY\s*BOX\b/gi,

    /\bNEW\s*W\/?\s*OLD\s*BOX\b/gi,
    /\bWITH\s*OLD\s*BOX\b/gi,
    /\bOLD\s*BOX\b/gi,

    /\bNEW\s*W\/?\s*BOX\b/gi,
    /\bNEW\s*WITH\s*BOX\b/gi,
    /\bWITH\s*BOX\b/gi,

    /\bNEW\s*W\/?\s*O\s*BOX\b/gi,
    /\bW\/?\s*O\s*BOX\b/gi,
    /\bWITHOUT\s*BOX\b/gi,
    /\bNO\s*BOX\b/gi,

    /\bOPEN\s*BOX\b/gi,
    /\bNEW\s*OPEN\s*BOX\b/gi,

    /\bUSED\b/gi,
    /\bNEW\b/gi,
    /\bREFURBISHED\b/gi,
    /\bSELLER\s*REFURBISHED\b/gi,

    /\bTRIED\s*&\s*TESTED\b/gi,
    /\bTRIED\s+AND\s+TESTED\b/gi,
    /\bTESTED\b/gi,

    /\bW\/?\s*O\s*ACCESSORIES\b/gi,
    /\bWITHOUT\s*ACCESSORIES\b/gi,
    /\bNO\s*ACCESSORIES\b/gi,

    /\bMISSING\s*LOCK\b/gi,
    /\bDAMAGED\s*BOX\b/gi,

    /\b\d+\s*PCS\b/gi,
    /\b\d+\s*PC\b/gi,
    /\b\d+\s*PIECES\b/gi,
    /\b\d+\s*LOT\b/gi,
    /\bLOT\s*OF\s*\d+\b/gi,
    /\bLOT\b/gi,

    /\bW\/O\s+ORIG\.?\s*&?\s*BOX\b/gi,
/\bW\/O\s+ORIGINAL\s+BOX\b/gi,
/\bWITHOUT\s+ORIGINAL\s+BOX\b/gi,
/\bNO\s+BOX\b/gi,
/\bOLD\s+BOX\b/gi,
/\bFILTHY\s+BOX\b/gi,
/\bDIRTY\s+BOX\b/gi,
/\bOPEN\s+BOX\b/gi,
/\bNEW\s+W\/?\s*BOX\b/gi,
/\bNEW\s+W\/O\s+BOX\b/gi,
/\bW\/O\s+BOX\b/gi,
/\bWITHOUT\s+BOX\b/gi,
    /[-–]\s*W\/O\s+ORIG\.?\s*&?\s*$/gi,
    /\bW\/O\s+ORIG\.?\s*&?\b/gi,
    /\s*-\s*W\/O\s+ORIG\.\s*&\s*$/gi,
  ];

  for (const pattern of removePatterns) {
    text = text.replace(pattern, ' ');
  }

  text = text
    .replace(/\s*-\s*$/g, '')
    .replace(/^\s*-\s*/g, '')
    .replace(/\s*-\s*-\s*/g, ' - ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return text || null;
}

export async function GET(request: Request) {
  const page = Number(
    new URL(request.url).searchParams.get('page') || '1'
  );

  const from = (page - 1) * BATCH_SIZE;
  const to = from + BATCH_SIZE - 1;

  const { data, error } = await supabaseAdmin
    .from('products')
    .select('id,name,description')
    .order('id', { ascending: true })
    .range(from, to);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results = [];

  for (const product of data || []) {
    const cleanName = cleanProductTitle(product.name);
    const cleanDescription = cleanProductTitle(product.description);

    if (!cleanName) {
      results.push({
        id: product.id,
        status: 'skipped_empty_name',
      });
      continue;
    }

    const shouldUpdate =
      cleanName !== product.name ||
      cleanDescription !== product.description;

    if (!shouldUpdate) {
      results.push({
        id: product.id,
        status: 'no_change',
        name: product.name,
      });
      continue;
    }

    const { error: updateError } = await supabaseAdmin
      .from('products')
      .update({
        name: cleanName,
        description: cleanDescription || cleanName,
      })
      .eq('id', product.id);

    results.push({
      id: product.id,
      status: updateError ? 'failed' : 'updated',
      oldName: product.name,
      newName: cleanName,
      error: updateError?.message || null,
    });
  }

  return NextResponse.json({
    page,
    from,
    to,
    limit: BATCH_SIZE,
    processed: results.length,
    results,
  });
}
