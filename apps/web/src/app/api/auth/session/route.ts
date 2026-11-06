import { boundary, json } from "../../../../lib/http.ts";
import { requireSession } from "../../../../lib/supabase.ts";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  return boundary(async () => {
    const { user } = await requireSession();
    return json({ user: { id: user.id, email: user.email } });
  });
}
