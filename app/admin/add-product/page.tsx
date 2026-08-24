'use client';

import { useState } from 'react';

import AdminNavigation from '@/components/admin/AdminNavigation';

export default function AddProductPage() {
  const [status, setStatus] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [uploading, setUploading] = useState(false);

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
      setStatus('Image upload error: image must be smaller than 8 MB');
      return;
    }

    setUploading(true);
    setStatus('Uploading image...');

    try {
      const form = new FormData();
      form.set('file', file);

      const response = await fetch(
        '/api/admin/upload-manual-product-image',
        {
          method: 'POST',
          body: form,
        },
      );
      const data = await response.json();

      if (!response.ok || !data.success) {
        setStatus(`Image upload error: ${data.error || 'Upload failed'}`);
        return;
      }

      setImageUrl(data.imageUrl);
      setStatus('Image uploaded successfully ✅');
    } catch {
      setStatus('Image upload error: unable to reach the server');
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus('Saving...');

    const form = new FormData(e.currentTarget);

    const payload = {
      name: form.get('name'),
      brand: form.get('brand'),
      model_number: form.get('model_number'),
      category: form.get('category'),
      condition: form.get('condition'),
      quantity: form.get('quantity'),
      image_url: imageUrl || form.get('image_url'),
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
        setImageUrl('');
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
          <input name="category" maxLength={160} placeholder="Category" className="w-full rounded-lg p-3 text-black" />

          <select name="condition" className="w-full rounded-lg p-3 text-black">
            <option>Used</option>
            <option>New</option>
            <option>New – Open box</option>
            <option>Refurbished</option>
            <option>For parts</option>
          </select>

          <input name="quantity" type="number" min="0" max="1000000" defaultValue="1" className="w-full rounded-lg p-3 text-black" />

          <div className="rounded-lg border border-cyan-400/20 bg-[#071827] p-4">
            <label className="mb-2 block font-bold text-cyan-200">Upload Product Image</label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleImageUpload}
              className="w-full rounded-lg bg-white p-3 text-black"
            />

            {uploading && <p className="mt-2 text-sm text-cyan-200">Uploading...</p>}

            {imageUrl && (
              <div className="mt-4">
                <img src={imageUrl} alt="Preview" className="h-40 rounded-lg bg-white object-contain p-2" />
                <input
                  name="image_url"
                  value={imageUrl}
                  readOnly
                  className="mt-3 w-full rounded-lg p-3 text-black"
                />
              </div>
            )}
          </div>

          {!imageUrl && (
            <input name="image_url" type="url" maxLength={2048} placeholder="Or paste HTTPS Image URL" className="w-full rounded-lg p-3 text-black" />
          )}

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
