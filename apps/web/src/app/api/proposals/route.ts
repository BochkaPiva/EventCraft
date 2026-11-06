import { createProposalInputSchema, idSchema } from "@eventcraft/core";
import {
  boundary,
  databaseError,
  HttpError,
  json,
  readJson,
  requireOrigin,
  singleRecord,
} from "../../../lib/http.ts";
import { requireSession } from "../../../lib/supabase.ts";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return boundary(async () => {
    const { client } = await requireSession();
    const agency = idSchema.safeParse(
      new URL(request.url).searchParams.get("agencyId"),
    );
    if (!agency.success) throw new HttpError(400, "invalid_agency_id");
    const { data: workspace, error: lookupError } = await client
      .from("agencies")
      .select("id")
      .eq("id", agency.data)
      .maybeSingle();
    if (lookupError) databaseError(lookupError);
    if (!workspace) throw new HttpError(404, "not_found");
    const { data, error } = await client
      .from("proposals")
      .select("id,agency_id,title,revision,updated_at")
      .eq("agency_id", agency.data)
      .order("updated_at", { ascending: false })
      .limit(100);
    if (error) databaseError(error);
    return json({ proposals: data });
  });
}
export async function POST(request: Request) {
  return boundary(async () => {
    const { client, origin } = await requireSession();
    requireOrigin(request, origin);
    const input = await readJson(request, createProposalInputSchema);
    const { data, error } = await client.rpc("create_proposal", {
      agency_id: input.agencyId,
      proposal_title: input.title,
      proposal_document: input.document,
    });
    if (error) databaseError(error);
    return json({ proposal: singleRecord(data) }, 201);
  });
}
