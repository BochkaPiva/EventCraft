import test from "node:test";
import assert from "node:assert/strict";
import {
  boundary,
  HttpError,
  json,
  type RequestEvent,
} from "../src/lib/http.ts";

test("request correlation covers success, denial, conflict and unexpected failure without content", async () => {
  const events: RequestEvent[] = [];
  const responses = [];
  const secret =
    "PRIVATE email=person@example.test password=secret SQL bearer cookie";
  for (const action of [
    async () => json({ document: secret }, 201),
    async () => {
      throw new HttpError(401, "authentication_required");
    },
    async () => {
      throw new HttpError(409, "revision_conflict");
    },
    async () => {
      throw new Error(secret);
    },
  ]) {
    responses.push(
      await boundary("proposals.save", action, (event) => events.push(event)),
    );
  }
  assert.deepEqual(
    events.map((event) => event.status),
    [201, 401, 409, 500],
  );
  assert.equal(new Set(events.map((event) => event.requestId)).size, 4);
  for (const [index, event] of events.entries()) {
    assert.deepEqual(Object.keys(event).sort(), [
      "durationMs",
      "event",
      "operation",
      "requestId",
      "status",
    ]);
    assert.match(
      event.requestId,
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    assert.equal(responses[index].headers.get("x-request-id"), event.requestId);
    assert.equal(
      responses[index].headers.get("cache-control"),
      "private, no-store",
    );
    assert.ok(Number.isInteger(event.durationMs) && event.durationMs >= 0);
  }
  assert.equal(JSON.stringify(events).includes(secret), false);
  assert.deepEqual(await responses[3].json(), { error: "internal_error" });
});

test("diagnostic sink failure preserves an acknowledged write and its request id", async () => {
  const response = await boundary(
    "proposals.create",
    async () => json({ id: "committed" }, 201),
    () => {
      throw Error("sink unavailable");
    },
  );
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { id: "committed" });
  assert.ok(response.headers.get("x-request-id"));
});
