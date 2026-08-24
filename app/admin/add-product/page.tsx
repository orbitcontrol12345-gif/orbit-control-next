'use client';

import { useState } from 'react';

import AdminNavigation from '@/components/admin/AdminNavigation';
import ManualProductImages from '@/components/admin/ManualProductImages';
import { CATEGORIES } from '@/lib/catalog-categories';

export default function AddProductPage() {
  const [status, setStatus] = useState('');
  const [galleryKey, setGalleryKey] = useState(0);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus('Saving...');

    const form = new FormData(e.currentTarget);
    const imageUrlsValue = String(form.get('image_urls') || '[]');
    let imageUrls: string[] = [];

    try {
      const parsedImageUrls = JSON.parse(imageUrlsValue);
      imageUrls = Array.isArray(parsedImageUrls) ? parsedImageUrls : [];
    } catch {
      setStatus('Error: invalid product gallery');
      return;
    }

    const payload = {
      name: form.get('name'),
      brand: form.get('brand'),
      model_number: form.get('model_number'),
      category: form.get('category'),
      condition: form.get('condition'),
      image_urls: imageUrls,
      description: form.get('description'),
    };

    const res = await fetch('/api/admin/add-manual-product', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    try {
      const data = await res.json();

      if (res.ok && data.success) {
        setStatus(`Product added successfully ✅ SKU: ${data.product?.sku}`);
        setGalleryKey((current) => current + 1);
        e.currentTarget.reset();
      } else {
        setStatus(`Error: ${data.error?.message || data.error}`);
      }
    } catch {
      setStatus('Error: unable to read the server response');
    }
  }

  async function handleDelete() {
    const sku = prompt('Enter product SKU to hide');

    if (!sku) return;

    setStatus('Hiding...');

    const res = await fetch('/api/admin/delete-manual-product', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sku }),
    });

    const data = await res.json();

    if (data.success && data.hidden > 0) {
      setStatus('Product hidden successfully ✅');
    } else {
      setStatus('Product not found');
    }
  }

  return (
    <div className="min-h-screen bg-[#06111d] px-6 py-24 text-white">
      <div className="mx-auto max-w-3xl">
        <AdminNavigation />

        <div className="rounded-2xl border border-cyan-400/10 bg-[#0b1f2f] p-8">
        <h1 className="mb-6 text-3xl font-bold">Add Manual Product</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input name="name" required maxLength={300} placeholder="Product Name" className="w-full rounded-lg p-3 text-black" />
          <input name="brand" maxLength={120} placeholder="Brand" className="w-full rounded-lg p-3 text-black" />
          <input name="model_number" required maxLength={160} placeholder="Model Number" className="w-full rounded-lg p-3 text-black" />
          <select
            name="category"
            required
            defaultValue=""
            className="w-full rounded-lg p-3 text-black"
          >
            <option value="" disabled>
              Select Category
            </option>
            {CATEGORIES.map((category) => (
              <option key={category.slug} value={category.name}>
                {category.name}
              </option>
            ))}
          </select>

          <select name="condition" className="w-full rounded-lg p-3 text-black">
            <option>Used</option>
            <option>New</option>
            <option>New – Open box</option>
            <option>Refurbished</option>
            <option>For parts</option>
          </select>

          <ManualProductImages key={galleryKey} />

          <textarea
            name="description"
            placeholder="Description"
            rows={5}
            maxLength={20000}
            className="w-full rounded-lg p-3 text-black"
          />

          <div className="flex gap-3">
            <button
              type="submit"
              className="rounded-lg bg-cyan-400 px-6 py-3 font-bold text-[#06111d]"
            >
              Save Product
            </button>

            <button
              type="button"
              onClick={handleDelete}
              className="rounded-lg bg-red-500 px-6 py-3 font-bold text-white"
            >
              Hide Product
            </button>
          </div>
        </form>

        {status && <p className="mt-5 text-sm text-cyan-200">{status}</p>}
        </div>
      </div>
    </div>
  );
}
