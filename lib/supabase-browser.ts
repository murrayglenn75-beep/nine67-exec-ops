import { createBrowserClient } from "@supabase/ssr";

// Client-side Supabase client — for "use client" components only (login
// form, Nav's logout button). Session tokens live in cookies (not
// localStorage) so the same session is visible to middleware.ts and to the
// server client in lib/supabase.ts. Never import lib/supabase.ts (the
// service-role client) here.
export function createBrowserSupabaseClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
