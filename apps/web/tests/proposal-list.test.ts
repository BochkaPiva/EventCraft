import test from "node:test";
import assert from "node:assert/strict";
import { readListOptions, nextCursor } from "../src/lib/proposal-list.ts";
test("cursor preserves database microseconds and rejects malformed filter input", () => {
  const row = {
    id: "11111111-1111-4111-8111-111111111111",
    updated_at: "2026-11-07T10:15:21.123456+00:00",
  };
  const result = readListOptions(
    new URL(`https://app.example.test/api/proposals?cursor=${nextCursor(row)}`),
  );
  assert.equal(result.cursor?.at, row.updated_at);
  const bad = Buffer.from(
    JSON.stringify({ at: "now,or(agency_id.neq.null)", id: row.id }),
  ).toString("base64url");
  assert.throws(
    () => readListOptions(new URL(`https://app.example.test/?cursor=${bad}`)),
    { status: 400 },
  );
});
