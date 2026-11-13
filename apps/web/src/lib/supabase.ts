import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { HttpError } from "./http.ts";
import { parseServerConfiguration } from "./configuration.ts";
export function getServerConfiguration() {
  return parseServerConfiguration({
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_PUBLISHABLE_KEY,
    origin: process.env.APP_ORIGIN,
  });
}
export async function createSessionClient() {
  const config = getServerConfiguration();
  const jar = await cookies();
  const client = createServerClient(config.url, config.key, {
    global: {
      fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
    },
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    },
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (values) => {
        for (const { name, value, options } of values)
          jar.set(name, value, options);
      },
    },
  });
  return { client, origin: config.origin };
}
export async function requireSession() {
  const { client, origin } = await createSessionClient();
  const { data, error } = await client.auth.getUser();
  if (error) {
    if ((error.status || 0) >= 500 || error.name === "AuthRetryableFetchError")
      throw new HttpError(503, "authentication_unavailable");
    throw new HttpError(401, "authentication_required");
  }
  if (!data.user) throw new HttpError(401, "authentication_required");
  if (!data.user.email_confirmed_at)
    throw new HttpError(403, "verified_account_required");
  return { client, user: data.user, origin };
}
