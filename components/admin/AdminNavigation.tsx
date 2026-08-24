import Link from 'next/link';

export default function AdminNavigation() {
  return (
    <nav className="mb-6 flex flex-wrap items-center gap-2 rounded-xl border border-cyan-400/10 bg-[#071827] p-3">
      <Link
        href="/admin"
        className="rounded-lg px-4 py-2 text-sm font-bold text-slate-300 transition hover:bg-white/5 hover:text-white"
      >
        Dashboard
      </Link>
      <Link
        href="/admin/products"
        className="rounded-lg px-4 py-2 text-sm font-bold text-slate-300 transition hover:bg-white/5 hover:text-white"
      >
        Manual Products
      </Link>
      <Link
        href="/admin/add-product"
        className="rounded-lg px-4 py-2 text-sm font-bold text-slate-300 transition hover:bg-white/5 hover:text-white"
      >
        Add Product
      </Link>

      <form
        action="/api/admin/logout"
        method="POST"
        className="ml-auto"
      >
        <button
          type="submit"
          className="rounded-lg bg-red-500/15 px-4 py-2 text-sm font-bold text-red-200 transition hover:bg-red-500/25"
        >
          Sign Out
        </button>
      </form>
    </nav>
  );
}

