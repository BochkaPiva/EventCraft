import test from "node:test";
import assert from "node:assert/strict";
import { parseServerConfiguration } from "../src/lib/configuration.ts";

const config = {
  url: "https://synthetic.example.test",
  origin: "https://app.example.test",
  key: "sb_publishable_synthetic_fixture",
};

test("configuration permits TLS and explicit HTTP loopback only", () => {
  assert.deepEqual(parseServerConfiguration(config), config);
  assert.doesNotThrow(() =>
    parseServerConfiguration({
      ...config,
      url: "http://127.0.0.1:54321",
      origin: "http://127.0.0.1:3000",
    }),
  );
  for (const url of [
    "http://remote.example.test",
    "ftp://localhost",
    "https://user:password@example.test",
    "https://example.test/path",
    "https://example.test/?token=secret",
  ]) {
    assert.throws(() => parseServerConfiguration({ ...config, url }), {
      status: 503,
    });
  }
});

test("missing configuration and secret keys cannot initialize the request client", () => {
  assert.throws(() => parseServerConfiguration({}), { status: 503 });
  assert.throws(
    () => parseServerConfiguration({ ...config, key: "sb_secret_fixture" }),
    { status: 503 },
  );
  assert.throws(
    () =>
      parseServerConfiguration({
        ...config,
        origin: "https://app.example.test/",
      }),
    { status: 503 },
  );
});
