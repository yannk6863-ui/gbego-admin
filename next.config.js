const path = require('path');

function readEnv(name) {
  const value = process.env[name];
  return typeof value === 'string' ? value.trim() : '';
}

function assertAdminEnv() {
  const required = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'];
  const missing = required.filter((name) => !readEnv(name));
  if (missing.length > 0) {
    throw new Error(
      `[Config] Missing required admin env vars: ${missing.join(', ')}. Define them in admin/.env.local before running Next.js.`
    );
  }

  const forbiddenPublic = ['NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY'];
  const leaked = forbiddenPublic.filter((name) => readEnv(name));
  if (leaked.length > 0) {
    throw new Error(
      `[Config] Server-only Supabase secrets must not be public env vars. Remove: ${leaked.join(', ')}.`
    );
  }
}

assertAdminEnv();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.resolve(__dirname),
  images: {
    unoptimized: true,
  },
};

module.exports = nextConfig;
