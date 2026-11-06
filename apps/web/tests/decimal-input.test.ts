import test from "node:test";
import assert from "node:assert/strict";
import {
  parseDecimalInput,
  formatDecimalInput,
} from "../src/lib/decimal-input.ts";
test("money entry uses decimal digits, preserves unknown and rejects unsupported precision", () => {
  assert.equal(parseDecimalInput("100000,50", 2, 1e12), 10000050);
  assert.equal(parseDecimalInput("0", 2, 1e12), 0);
  assert.equal(parseDecimalInput("", 2, 1e12), null);
  for (const value of [
    "1.001",
    "-1",
    "1e5",
    "Infinity",
    "1,2,3",
    "10000000000,01",
  ])
    assert.equal(parseDecimalInput(value, 2, 1e12), undefined);
  assert.equal(parseDecimalInput("0", 3, 100000000, 1), undefined);
  assert.equal(parseDecimalInput("0,001", 3, 100000000, 1), 1);
  for (const value of [0, 1, 10, 10000, 10000050])
    assert.equal(
      parseDecimalInput(formatDecimalInput(value, 2), 2, 1e12),
      value,
    );
});
