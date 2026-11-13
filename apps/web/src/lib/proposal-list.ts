import { z } from "zod";
import { idSchema } from "@eventcraft/core";
import { HttpError } from "./http.ts";
const cursorSchema = z
  .object({ at: z.string().datetime({ offset: true }), id: idSchema })
  .strict();
export function readListOptions(url: URL) {
  const q = (url.searchParams.get("q") || "").trim();
  if (q.length > 180) throw new HttpError(400, "invalid_search");
  const raw = url.searchParams.get("cursor");
  if (!raw) return { q, cursor: null };
  try {
    if (raw.length > 512 || !/^[a-zA-Z0-9_-]+$/.test(raw)) throw Error();
    return {
      q,
      cursor: cursorSchema.parse(
        JSON.parse(Buffer.from(raw, "base64url").toString("utf8")),
      ),
    };
  } catch {
    throw new HttpError(400, "invalid_cursor");
  }
}
export function nextCursor(row: { id: string; updated_at: string }) {
  return Buffer.from(
    JSON.stringify({ at: row.updated_at, id: row.id }),
  ).toString("base64url");
}
