import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { authConfig } from "./config";
export async function supabase() {
  const store = await cookies();
  const { url, key } = authConfig();
  return createServerClient(url, key, {
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    },
    cookies: {
      getAll: () => store.getAll(),
      setAll: (all) => {
        try {
          all.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          /* Server Components são somente leitura; middleware atualiza a sessão. */
        }
      },
    },
  });
}
