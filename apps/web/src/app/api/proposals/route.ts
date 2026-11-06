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
import { readListOptions, nextCursor } from "../../../lib/proposal-list.ts";
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
    const { q, cursor } = readListOptions(new URL(request.url));
    let query = client
      .rpc("search_proposals", { agency_id: agency.data, search_query: q })
      .select("id,agency_id,title,revision,updated_at")
      .eq("agency_id", agency.data)
      .order("updated_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(51);
    if (cursor)
      query = query.or(
        `updated_at.lt.${cursor.at},and(updated_at.eq.${cursor.at},id.lt.${cursor.id})`,
      );
    const { data, error } = await query;
    if (error) databaseError(error);
    if (!Array.isArray(data)) throw new HttpError(503, "storage_unavailable");
    const proposals = data.slice(0, 50);
    return json({
      proposals,
      nextCursor: data.length > 50 ? nextCursor(proposals[49]) : null,
    });
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
      creation_key: input.creationKey,
    });
    if (error) databaseError(error);
    return json({ proposal: singleRecord(data) }, 201);
  });
}
