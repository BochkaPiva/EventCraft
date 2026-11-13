import { idSchema, saveProposalInputSchema } from "@eventcraft/core";
import {
  boundary,
  databaseError,
  HttpError,
  json,
  readJson,
  requireOrigin,
  singleRecord,
} from "../../../../lib/http.ts";
import { requireSession } from "../../../../lib/supabase.ts";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
async function identifier(context: Context) {
  const parsed = idSchema.safeParse((await context.params).id);
  if (!parsed.success) throw new HttpError(400, "invalid_proposal_id");
  return parsed.data;
}
export async function GET(_request: Request, context: Context) {
  return boundary("proposals.read", async () => {
    const { client } = await requireSession();
    const id = await identifier(context);
    const { data, error } = await client
      .from("proposals")
      .select(
        "id,agency_id,title,document,revision,created_at,updated_at,created_by",
      )
      .eq("id", id)
      .maybeSingle();
    if (error) databaseError(error);
    if (!data) throw new HttpError(404, "not_found");
    return json({ proposal: data });
  });
}
export async function PATCH(request: Request, context: Context) {
  return boundary("proposals.save", async () => {
    const { client, origin } = await requireSession();
    requireOrigin(request, origin);
    const id = await identifier(context);
    const input = await readJson(request, saveProposalInputSchema);
    const { data, error } = await client.rpc("save_proposal_draft", {
      proposal_id: id,
      expected_revision: input.expectedRevision,
      new_title: input.title,
      new_document: input.document,
    });
    if (error) databaseError(error);
    return json({ proposal: singleRecord(data) });
  });
}
