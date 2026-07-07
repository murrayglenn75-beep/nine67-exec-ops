import { createClient } from "@supabase/supabase-js";

// Server-only. This client is constructed with the service-role key, which
// bypasses row-level security — it must never be imported into a "use
// client" component or otherwise reach the browser. Only import this from
// server components and app/api/* route handlers.
//
// Keys are in Supabase's new format (sb_publishable_.../sb_secret_...);
// supabase-js accepts them as drop-in replacements for the legacy JWT-style
// anon/service_role keys.
export function createServerSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variable"
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
