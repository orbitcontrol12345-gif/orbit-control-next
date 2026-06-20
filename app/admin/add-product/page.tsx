'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function AddProductPage() {
  const [status, setStatus] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [uploading, setUploading] = useState(false);

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setStatus('Uploading image...');

    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;

    const { error } = await supabase.storage
      .from('manual-products')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      setStatus(`Image upload error: ${error.message}`);
      setUploading(false);
      return;
    }

    const { data } = supabase.storage
      .from('manual-products')
      .getPublicUrl(fileName);

    setImageUrl(data.publicUrl);
    setStatus('Image uploaded successfully ✅');
    setUploading(false);
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

    const data = await res.json();

    if (data.success) {
      setStatus(`Product added successfully ✅ SKU: ${data.product?.sku}`);
      setImageUrl('');
      e.currentTarget.reset();
    } else {
      setStatus(`Error: ${data.error?.message || data.error}`);
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
      <div className="mx-auto max-w-3xl rounded-2xl border border-cyan-400/10 bg-[#0b1f2f] p-8">
        <h1 className="mb-6 text-3xl font-bold">Add Manual Product</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input name="name" required placeholder="Product Name" className="w-full rounded-lg p-3 text-black" />
          <input name="brand" placeholder="Brand" className="w-full rounded-lg p-3 text-black" />
          <input name="model_number" required placeholder="Model Number" className="w-full rounded-lg p-3 text-black" />
          <input name="category" placeholder="Category" className="w-full rounded-lg p-3 text-black" />

          <select name="condition" className="w-full rounded-lg p-3 text-black">
            <option>Used</option>
            <option>New</option>
            <option>New – Open box</option>
            <option>Refurbished</option>
            <option>For parts</option>
          </select>

          <input name="quantity" type="number" defaultValue="1" className="w-full rounded-lg p-3 text-black" />

          <div className="rounded-lg border border-cyan-400/20 bg-[#071827] p-4">
            <label className="mb-2 block font-bold text-cyan-200">Upload Product Image</label>
            <input
              type="file"
              accept="image/*"
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
            <input name="image_url" placeholder="Or paste Image URL" className="w-full rounded-lg p-3 text-black" />
          )}

          <textarea
            name="description"
            placeholder="Description"
            rows={5}
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
  );
}
