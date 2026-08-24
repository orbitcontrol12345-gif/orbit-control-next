'use client';

import { useState } from 'react';

import { MAX_MANUAL_PRODUCT_IMAGES } from '@/lib/manual-product';

const MAX_IMAGE_SIZE = 8 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

type ManualProductImagesProps = {
  initialUrls?: string[];
};

function uniqueImageUrls(urls: string[]): string[] {
  return Array.from(
    new Set(
      urls
        .map((url) => url.trim())
        .filter(Boolean),
    ),
  ).slice(0, MAX_MANUAL_PRODUCT_IMAGES);
}

export default function ManualProductImages({
  initialUrls = [],
}: ManualProductImagesProps) {
  const [imageUrls, setImageUrls] = useState(() =>
    uniqueImageUrls(initialUrls),
  );
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState('');

  async function handleImagesUpload(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const input = event.currentTarget;
    const selectedFiles = Array.from(input.files || []);
    input.value = '';

    if (!selectedFiles.length) return;

    const availableSlots =
      MAX_MANUAL_PRODUCT_IMAGES - imageUrls.length;

    if (availableSlots <= 0) {
      setStatus(
        `The gallery already contains the maximum of ${MAX_MANUAL_PRODUCT_IMAGES} images.`,
      );
      return;
    }

    const files = selectedFiles.slice(0, availableSlots);
    const invalidFile = files.find(
      (file) =>
        !ALLOWED_IMAGE_TYPES.has(file.type) ||
        file.size <= 0 ||
        file.size > MAX_IMAGE_SIZE,
    );

    if (invalidFile) {
      setStatus(
        `${invalidFile.name}: only JPG, PNG, or WebP images smaller than 8 MB are allowed.`,
      );
      return;
    }

    setUploading(true);
    const uploadedUrls: string[] = [];

    try {
      for (let index = 0; index < files.length; index += 1) {
        setStatus(`Uploading image ${index + 1} of ${files.length}...`);

        const form = new FormData();
        form.set('file', files[index]);

        const response = await fetch(
          '/api/admin/upload-manual-product-image',
          {
            method: 'POST',
            body: form,
          },
        );
        const data = await response.json();

        if (!response.ok || !data.success || !data.imageUrl) {
          throw new Error(data.error || `Unable to upload ${files[index].name}`);
        }

        uploadedUrls.push(String(data.imageUrl));
      }

      setImageUrls((current) =>
        uniqueImageUrls([...current, ...uploadedUrls]),
      );

      const skipped = selectedFiles.length - files.length;
      setStatus(
        skipped > 0
          ? `${uploadedUrls.length} images uploaded. ${skipped} skipped because the gallery limit is ${MAX_MANUAL_PRODUCT_IMAGES}.`
          : `${uploadedUrls.length} images uploaded successfully ✅`,
      );
    } catch (error) {
      if (uploadedUrls.length) {
        setImageUrls((current) =>
          uniqueImageUrls([...current, ...uploadedUrls]),
        );
      }

      setStatus(
        error instanceof Error
          ? `Image upload error: ${error.message}`
          : 'Image upload error: unable to reach the server',
      );
    } finally {
      setUploading(false);
    }
  }

  function makeMainImage(index: number) {
    setImageUrls((current) => {
      const selected = current[index];

      if (!selected || index === 0) return current;

      return [
        selected,
        ...current.filter((_, currentIndex) => currentIndex !== index),
      ];
    });
  }

  function removeImage(index: number) {
    setImageUrls((current) =>
      current.filter((_, currentIndex) => currentIndex !== index),
    );
    setStatus('Image removed from this product gallery.');
  }

  return (
    <div className="rounded-lg border border-cyan-400/20 bg-[#071827] p-4">
      <label className="mb-2 block font-bold text-cyan-200">
        Product Gallery ({imageUrls.length}/{MAX_MANUAL_PRODUCT_IMAGES})
      </label>

      <input
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp"
        disabled={uploading || imageUrls.length >= MAX_MANUAL_PRODUCT_IMAGES}
        onChange={handleImagesUpload}
        className="w-full rounded-lg bg-white p-3 text-black disabled:cursor-not-allowed disabled:opacity-60"
      />

      <p className="mt-2 text-xs text-slate-400">
        Select several images at once. Maximum {MAX_MANUAL_PRODUCT_IMAGES} images,
        8 MB each. The first image is the main product image.
      </p>

      <input
        type="hidden"
        name="image_urls"
        value={JSON.stringify(imageUrls)}
        readOnly
      />

      {imageUrls.length > 0 && (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {imageUrls.map((imageUrl, index) => (
            <div
              key={imageUrl}
              className="rounded-lg border border-white/10 bg-[#0b1f2f] p-2"
            >
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl}
                  alt={`Product image ${index + 1}`}
                  className="h-32 w-full rounded bg-white object-contain"
                />

                {index === 0 && (
                  <span className="absolute left-2 top-2 rounded bg-cyan-400 px-2 py-1 text-[10px] font-black uppercase text-[#06111d]">
                    Main
                  </span>
                )}
              </div>

              <div className="mt-2 flex gap-2">
                {index > 0 && (
                  <button
                    type="button"
                    onClick={() => makeMainImage(index)}
                    className="flex-1 rounded bg-cyan-400/15 px-2 py-1.5 text-xs font-bold text-cyan-200 hover:bg-cyan-400/25"
                  >
                    Make Main
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => removeImage(index)}
                  className="flex-1 rounded bg-red-500/15 px-2 py-1.5 text-xs font-bold text-red-300 hover:bg-red-500/25"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {status && (
        <p className="mt-3 text-sm text-cyan-200" aria-live="polite">
          {status}
        </p>
      )}
    </div>
  );
}
