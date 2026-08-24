import { NextResponse } from 'next/server';

import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_IMAGE_SIZE = 8 * 1024 * 1024;
const IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

function hasValidImageSignature(
  buffer: Buffer,
  contentType: string,
): boolean {
  if (contentType === 'image/jpeg') {
    return (
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff
    );
  }

  if (contentType === 'image/png') {
    const pngSignature = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
    return (
      buffer.length >= pngSignature.length &&
      buffer.subarray(0, pngSignature.length).equals(pngSignature)
    );
  }

  if (contentType === 'image/webp') {
    return (
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP'
    );
  }

  return false;
}

export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get('file');

  if (!(file instanceof File)) {
    return NextResponse.json(
      {
        success: false,
        error: 'Image file is required',
      },
      { status: 400 },
    );
  }

  const extension = IMAGE_TYPES[file.type];

  if (!extension) {
    return NextResponse.json(
      {
        success: false,
        error: 'Only JPG, PNG, and WebP images are allowed',
      },
      { status: 400 },
    );
  }

  if (file.size <= 0 || file.size > MAX_IMAGE_SIZE) {
    return NextResponse.json(
      {
        success: false,
        error: 'Image must be smaller than 8 MB',
      },
      { status: 400 },
    );
  }

  const now = new Date();
  const objectName = [
    'manual',
    String(now.getUTCFullYear()),
    `${Date.now()}-${crypto.randomUUID()}.${extension}`,
  ].join('/');
  const buffer = Buffer.from(await file.arrayBuffer());

  if (!hasValidImageSignature(buffer, file.type)) {
    return NextResponse.json(
      {
        success: false,
        error: 'The uploaded file is not a valid image',
      },
      { status: 400 },
    );
  }

  const { error } = await supabaseAdmin.storage
    .from('manual-products')
    .upload(objectName, buffer, {
      cacheControl: '31536000',
      contentType: file.type,
      upsert: false,
    });

  if (error) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 },
    );
  }

  const { data } = supabaseAdmin.storage
    .from('manual-products')
    .getPublicUrl(objectName);

  return NextResponse.json({
    success: true,
    imageUrl: data.publicUrl,
  });
}
