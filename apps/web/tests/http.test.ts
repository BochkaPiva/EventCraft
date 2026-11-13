import test from "node:test";
import assert from "node:assert/strict";
import { createAgencyInputSchema } from "@eventcraft/core";
import {
  boundary,
  databaseError,
  json,
  readJson,
  requireOrigin,
} from "../src/lib/http.ts";
test("mutations require exact trusted origin and reject a cross-site request", () => {
  assert.throws(
    () =>
      requireOrigin(
        new Request("https://app.example.test", {
          headers: { Origin: "https://other.example.test" },
        }),
        "https://app.example.test",
      ),
    { status: 403 },
  );
  assert.throws(
    () =>
      requireOrigin(
        new Request("https://app.example.test"),
        "https://app.example.test",
      ),
    { status: 403 },
  );
  assert.doesNotThrow(() =>
    requireOrigin(
      new Request("https://app.example.test", {
        headers: { Origin: "https://app.example.test" },
      }),
      "https://app.example.test",
    ),
  );
});
test("malformed JSON and untrusted owner fields never reach a use case", async () => {
  await assert.rejects(
    readJson(
      new Request("https://app.example.test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{broken",
      }),
      createAgencyInputSchema,
    ),
    { status: 400 },
  );
  await assert.rejects(
    readJson(
      new Request("https://app.example.test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Пример", ownerId: "someone" }),
      }),
      createAgencyInputSchema,
    ),
    { status: 400 },
  );
});
test("actual body size is bounded even without content-length", async () => {
  await assert.rejects(
    readJson(
      new Request("https://app.example.test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Пример" }),
      }),
      createAgencyInputSchema,
      5,
    ),
    { status: 413 },
  );
});
test("private responses and error responses are never publicly cached", async () => {
  assert.equal(
    json({ id: "example" }).headers.get("cache-control"),
    "private, no-store",
  );
  const result = await boundary("proposals.save", async () => {
    throw Error("PRIVATE SQL connection string");
  });
  assert.equal(result.status, 500);
  assert.equal((await result.text()).includes("PRIVATE"), false);
  assert.equal(result.headers.get("cache-control"), "private, no-store");
});
test("database errors distinguish stale edits without exposing SQL messages", async () => {
  const denied = await boundary("proposals.save", async () =>
    databaseError({ code: "42501" }),
  );
  assert.equal(denied.status, 404);
  const stale = await boundary("proposals.save", async () =>
    databaseError({ code: "EC409" }),
  );
  assert.equal(stale.status, 409);
  const unknown = await boundary("proposals.save", async () =>
    databaseError({ code: "XX000" }),
  );
  assert.equal(unknown.status, 503);
});
