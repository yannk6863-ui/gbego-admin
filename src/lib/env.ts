type PublicEnvName = "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_ANON_KEY";

const PUBLIC_ENV: Record<PublicEnvName, string | undefined> = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
};

function readEnv(name: PublicEnvName): string | null {
  const value = PUBLIC_ENV[name];
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function requirePublicEnv(name: PublicEnvName): string {
  const value = readEnv(name);
  if (!value) {
    throw new Error(`Missing ${name}. Define it in admin/.env.local before starting Next.js.`);
  }
  return value;
}
