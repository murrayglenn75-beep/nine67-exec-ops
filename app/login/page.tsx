"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-accent">
            Signal Desk
          </p>
          <h1 className="mt-2 font-sans text-2xl font-semibold tracking-tight text-zinc-50">
            Sign in
          </h1>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-md border border-zinc-800 bg-zinc-900/50 p-6"
        >
          <div>
            <label
              htmlFor="email"
              className="mb-1.5 block font-mono text-[11px] uppercase tracking-wide text-zinc-500"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-accent focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1.5 block font-mono text-[11px] uppercase tracking-wide text-zinc-500"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-accent focus:outline-none"
            />
          </div>

          {error && <p className="text-sm text-orange-300">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-accent px-4 py-2 text-sm font-medium text-black transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-zinc-600">
          Demo user: demo@signaldesk.app
        </p>
      </div>
    </main>
  );
}
