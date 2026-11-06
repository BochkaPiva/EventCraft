import { z } from "zod";
import {
  boundary,
  HttpError,
  json,
  readJson,
  requireOrigin,
} from "../../../../lib/http.ts";
import { createSessionClient } from "../../../../lib/supabase.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const credentials = z
  .object({
    email: z.string().trim().max(254).email(),
    password: z.string().min(1).max(1024),
  })
  .strict();

export async function POST(request: Request) {
  return boundary(async () => {
    const { client, origin } = await createSessionClient();
    requireOrigin(request, origin);
    const input = await readJson(request, credentials, 8192);
    const { data, error } = await client.auth.signInWithPassword(input);
    if (error) {
      if (error.status === 429) throw new HttpError(429, "too_many_attempts");
      if (
        (error.status || 0) >= 500 ||
        error.name === "AuthRetryableFetchError"
      )
        throw new HttpError(503, "authentication_unavailable");
      throw new HttpError(401, "invalid_credentials");
    }
    if (!data.user?.email_confirmed_at) {
      await client.auth.signOut({ scope: "local" });
      throw new HttpError(403, "verified_account_required");
    }
    return json({ user: { id: data.user.id, email: data.user.email } });
  });
}
