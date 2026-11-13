import { json } from "../../../lib/http.ts";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  return json({ status: "ok", service: "eventcraft", version: "0.1.0" });
}
