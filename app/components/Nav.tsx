"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";

const LINKS = [
  { href: "/", label: "This Week" },
  { href: "/projects", label: "Projects" },
  { href: "/clients", label: "Clients" },
  { href: "/capacity", label: "Capacity" },
  { href: "/ask", label: "Ask" },
];

export function Nav() {
  const pathname = usePathname();
  const router = useRouter();

  if (pathname === "/login") return null;

  async function logout() {
    const supabase = createBrowserSupabaseClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <nav className="border-b border-zinc-800 bg-[#08090a]">
      <div className="mx-auto flex max-w-6xl items-center gap-8 px-6 py-4 sm:px-10">
        <span className="font-mono text-xs uppercase tracking-[0.25em] text-accent">
          Signal Desk
        </span>
        <div className="flex flex-1 gap-6">
          {LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm font-medium transition-colors ${
                  active ? "text-zinc-50" : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
        <button
          type="button"
          onClick={logout}
          className="font-mono text-xs uppercase tracking-wide text-zinc-500 transition-colors hover:text-orange-300"
        >
          Log out
        </button>
      </div>
    </nav>
  );
}
