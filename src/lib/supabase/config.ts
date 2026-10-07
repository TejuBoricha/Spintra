// Kept apart from client.ts on purpose: this needs no Supabase library, and the production-config
// banner (rendered on every page) imports it. Importing it from client.ts pulled the whole
// Supabase client (about 63 KB compressed) into the first load of every page (search audit S-7).

// NEXT_PUBLIC_* vars are inlined at build time, so this is a static check —
// dead-code-eliminated entirely when the app is built with them present.
export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
