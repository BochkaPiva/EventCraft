import type { z } from "zod";
import { randomUUID } from "node:crypto";

export type ApiOperation =
  | "auth.sign_in"
  | "auth.sign_out"
  | "auth.session"
  | "agencies.list"
  | "agencies.create"
  | "proposals.list"
  | "proposals.create"
  | "proposals.read"
  | "proposals.save";

export type RequestEvent = {
  event: "api_request";
  requestId: string;
  operation: ApiOperation;
  status: number;
  durationMs: number;
};

function writeRequestEvent(event: RequestEvent) {
  console.info(JSON.stringify(event));
}
export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}
export function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      Pragma: "no-cache",
      Expires: "0",
      "Referrer-Policy": "no-referrer",
    },
  });
}
export function singleRecord(data: unknown) {
  if (
    !Array.isArray(data) ||
    data.length !== 1 ||
    !data[0] ||
    typeof data[0].id !== "string"
  )
    throw new HttpError(503, "storage_unavailable");
  return data[0];
}
export function requireOrigin(request: Request, allowedOrigin: string) {
  const origin = request.headers.get("origin");
  if (
    !origin ||
    origin !== allowedOrigin ||
    request.headers.get("sec-fetch-site") === "cross-site"
  )
    throw new HttpError(403, "invalid_origin");
}
export async function readJson<T>(
  request: Request,
  schema: z.ZodType<T>,
  maxBytes = 300 * 1024,
): Promise<T> {
  if (
    request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !==
    "application/json"
  )
    throw new HttpError(415, "json_required");
  const length = request.headers.get("content-length");
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > maxBytes))
    throw new HttpError(
      Number(length) > maxBytes ? 413 : 400,
      "invalid_body_size",
    );
  if (!request.body) throw new HttpError(400, "invalid_json");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new HttpError(413, "body_too_large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) {
    body.set(c, offset);
    offset += c.byteLength;
  }
  let raw: unknown;
  try {
    raw = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body));
  } catch {
    throw new HttpError(400, "invalid_json");
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new HttpError(400, "invalid_request");
  return parsed.data;
}
export function databaseError(
  error: { code?: string },
  conflictCode = "revision_conflict",
): never {
  if (error.code === "EC409") throw new HttpError(409, conflictCode);
  if (error.code === "EC422") throw new HttpError(409, "creation_key_reused");
  if (["42501", "P0002"].includes(error.code || ""))
    throw new HttpError(404, "not_found");
  if (["22023", "23514", "22003"].includes(error.code || ""))
    throw new HttpError(400, "invalid_request");
  throw new HttpError(503, "storage_unavailable");
}
export async function boundary(
  operation: ApiOperation,
  fn: () => Promise<Response>,
  writeEvent: (event: RequestEvent) => void = writeRequestEvent,
) {
  // No request object enters the logger: URLs, credentials and content stay out.
  const requestId = randomUUID();
  const started = performance.now();
  let response: Response;
  try {
    response = await fn();
  } catch (error) {
    response =
      error instanceof HttpError
        ? json({ error: error.code }, error.status)
        : json({ error: "internal_error" }, 500);
  }
  response.headers.set("X-Request-Id", requestId);
  try {
    writeEvent({
      event: "api_request",
      requestId,
      operation,
      status: response.status,
      durationMs: Math.max(0, Math.round(performance.now() - started)),
    });
  } catch {
    // An unavailable diagnostic sink cannot turn a committed write into a 500.
  }
  return response;
}
