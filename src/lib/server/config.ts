import "server-only";
import { z } from "zod";
export function isDemo() {
  return process.env.NODE_ENV === "development" && process.env.DEMO_MODE === "true";
}
export function isConfigured() {
  return Boolean(
    process.env.DATABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY &&
    process.env.DATA_ENCRYPTION_KEY,
  );
}
export function authConfig() {
  return z
    .object({ url: z.string().url(), key: z.string().min(20) })
    .parse({
      url: process.env.NEXT_PUBLIC_SUPABASE_URL,
      key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    });
}
