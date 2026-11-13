import assert from "node:assert/strict";

const base = new URL(process.argv[2] || "http://127.0.0.1:3000");
assert.ok(
  base.protocol === "http:" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname) &&
    !base.username &&
    !base.password &&
    base.pathname === "/" &&
    !base.search &&
    !base.hash,
  "This smoke check targets a local, deliberately unconfigured instance only",
);

const health = await fetch(new URL("/api/health", base));
assert.equal(health.status, 200);
assert.equal((await health.json()).status, "ok");
const id = "11111111-1111-4111-8111-111111111111";
const requestIds = new Set();
for (const [path, method] of [
  ["/api/agencies", "GET"],
  ["/api/auth/session", "GET"],
  ["/api/auth/sign-in", "POST"],
  ["/api/auth/sign-out", "POST"],
  ["/api/agencies", "POST"],
  [`/api/proposals?agencyId=${id}`, "GET"],
  ["/api/proposals", "POST"],
  [`/api/proposals/${id}`, "GET"],
  [`/api/proposals/${id}`, "PATCH"],
]) {
  const response = await fetch(new URL(path, base), {
    method,
    headers: {
      Origin: base.origin,
      "Content-Type": "application/json",
      "X-Request-Id": "untrusted-client-value",
    },
    ...(method === "GET" ? {} : { body: "{}" }),
  });
  assert.equal(response.status, 503, `${method} ${path} must fail closed`);
  assert.deepEqual(await response.json(), {
    error: "workspace_not_configured",
  });
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  const requestId = response.headers.get("x-request-id");
  assert.match(
    requestId || "",
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );
  assert.ok(!requestIds.has(requestId), "Each request gets a fresh server ID");
  requestIds.add(requestId);
}
assert.equal((await fetch(new URL("/.env.local", base))).status, 404);
console.log(
  "Local smoke passed: process health, nine closed API operations, private headers, fresh server request IDs, no environment file.",
);
