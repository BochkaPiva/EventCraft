import {
  boundary,
  HttpError,
  json,
  requireOrigin,
} from "../../../../lib/http.ts";
import { createSessionClient } from "../../../../lib/supabase.ts";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  return boundary("auth.sign_out", async () => {
    const { client, origin } = await createSessionClient();
    requireOrigin(request, origin);
    const { error } = await client.auth.signOut({ scope: "local" });
    if (error) throw new HttpError(503, "authentication_unavailable");
    return json({ signedOut: true });
  });
}
