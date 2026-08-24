import type { Metadata } from 'next';
import { LockKeyhole, LogIn } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Admin Login',
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

function getSafeNextPath(value?: string): string {
  if (
    !value ||
    !value.startsWith('/admin') ||
    value.startsWith('//') ||
    value.startsWith('/admin/login')
  ) {
    return '/admin/products';
  }

  return value;
}

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    next?: string;
  }>;
}) {
  const resolvedSearchParams = await searchParams;
  const nextPath = getSafeNextPath(resolvedSearchParams.next);
  const invalidCredentials = resolvedSearchParams.error === 'invalid';
  const tooManyAttempts = resolvedSearchParams.error === 'rate-limit';
  const configurationError = resolvedSearchParams.error === 'configuration';

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#06111d] px-6 py-24 text-white">
      <div className="w-full max-w-md rounded-2xl border border-cyan-400/10 bg-[#0b1f2f] p-8 shadow-2xl">
        <div className="mb-7 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-400/10 text-cyan-300">
            <LockKeyhole size={24} />
          </div>

          <div>
            <h1 className="text-2xl font-black">Admin Login</h1>
            <p className="text-sm text-slate-400">
              Orbit Control Automation
            </p>
          </div>
        </div>

        <form
          action="/api/admin/login"
          method="POST"
          className="space-y-4"
        >
          <input type="hidden" name="next" value={nextPath} />

          <div>
            <label
              htmlFor="username"
              className="mb-2 block text-sm font-bold text-slate-200"
            >
              Username
            </label>
            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              required
              maxLength={100}
              className="w-full rounded-lg border border-white/10 bg-[#071827] px-4 py-3 text-white outline-none transition focus:border-cyan-300/50"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-2 block text-sm font-bold text-slate-200"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              maxLength={256}
              className="w-full rounded-lg border border-white/10 bg-[#071827] px-4 py-3 text-white outline-none transition focus:border-cyan-300/50"
            />
          </div>

          {invalidCredentials && (
            <p className="rounded-lg border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-200">
              Invalid username or password.
            </p>
          )}

          {tooManyAttempts && (
            <p className="rounded-lg border border-amber-400/20 bg-amber-500/10 p-3 text-sm text-amber-200">
              Too many attempts. Please wait 15 minutes and try again.
            </p>
          )}

          {configurationError && (
            <p className="rounded-lg border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-200">
              Admin security variables are not configured on the server.
            </p>
          )}

          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-400 px-6 py-3 font-black text-[#06111d] transition hover:bg-cyan-300"
          >
            <LogIn size={18} />
            Sign In
          </button>
        </form>
      </div>
    </main>
  );
}
