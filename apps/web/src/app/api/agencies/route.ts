import { createAgencyInputSchema, idSchema } from "@eventcraft/core";
import {
  boundary,
  databaseError,
  HttpError,
  json,
  readJson,
  requireOrigin,
} from "../../../lib/http.ts";
import { requireSession } from "../../../lib/supabase.ts";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  return boundary("agencies.list", async () => {
    const { client } = await requireSession();
    const { data, error } = await client
      .from("agencies")
      .select("id,name,created_at")
      .order("created_at");
    if (error) databaseError(error);
    return json({ agencies: data });
  });
}
export async function POST(request: Request) {
  return boundary("agencies.create", async () => {
    const { client, origin } = await requireSession();
    requireOrigin(request, origin);
    const input = await readJson(request, createAgencyInputSchema, 8192);
    const { data, error } = await client.rpc("create_agency", {
      agency_name: input.name,
    });
    if (error) databaseError(error, "agency_exists");
    if (!idSchema.safeParse(data).success)
      throw new HttpError(503, "storage_unavailable");
    return json({ id: data }, 201);
  });
}
