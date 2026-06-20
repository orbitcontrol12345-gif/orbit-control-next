'use client';

import { useState } from 'react';

export default function AddProductPage() {
  const [status, setStatus] = useState('');

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
      image_url: form.get('image_url'),
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
      e.currentTarget.reset();
    } else {
      setStatus(`Error: ${data.error?.message || data.error}`);
    }
  }

  async function handleDelete() {
    const sku = prompt('Enter manual product SKU to delete');

    if (!sku) return;

    setStatus('Deleting...');

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
          <input name="image_url" placeholder="Image URL" className="w-full rounded-lg p-3 text-black" />

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
