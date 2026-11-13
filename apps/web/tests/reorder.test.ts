import test from "node:test";
import assert from "node:assert/strict";
import { reorderAtSlot, restoreOrder } from "../src/lib/reorder.ts";

test("reordering uses insertion slots and preserves authored data and independent original order", () => {
  const items = [
    {
      id: "a",
      time: "10:00",
      hidden: false,
      children: [{ description: "First" }],
    },
    {
      id: "b",
      time: null,
      hidden: true,
      children: [{ description: "Second" }],
    },
    { id: "c", time: "09:00", hidden: false, children: [] },
  ];
  const first = reorderAtSlot(items, "c", 0)!;
  assert.deepEqual(
    first.map((item) => item.id),
    ["c", "a", "b"],
  );
  assert.equal(first[0], items[2]);
  assert.equal(first[2].time, null);
  assert.equal(first[2].hidden, true);
  assert.equal(first[2].children, items[1].children);
  const last = reorderAtSlot(items, "a", 2)!;
  assert.deepEqual(
    last.map((item) => item.id),
    ["b", "c", "a"],
  );
  assert.deepEqual(
    items.map((item) => item.id),
    ["a", "b", "c"],
  );
});

test("unchanged, stale and invalid targets never become a document update", () => {
  const items = [{ id: "a" }, { id: "b" }];
  for (const [id, slot] of [
    ["a", 0],
    ["b", 1],
    ["missing", 0],
    ["a", -1],
    ["a", 2],
    ["a", 0.5],
    ["a", NaN],
  ] as const)
    assert.equal(reorderAtSlot(items, id, slot), null);
  assert.equal(reorderAtSlot([], "a", 0), null);
});

test("undoing order retains edits made after moving and refuses to discard added or removed objects", () => {
  const current = [
    { id: "b", body: "Поздняя правка" },
    { id: "a", body: "Идея" },
  ];
  const restored = restoreOrder(current, ["a", "b"]);
  assert.equal(restored?.[1], current[0]);
  assert.equal(restored?.[1].body, "Поздняя правка");
  assert.equal(
    restoreOrder([...current, { id: "c", body: "Новый раздел" }], ["a", "b"]),
    null,
  );
  assert.equal(restoreOrder(current, ["a", "missing"]), null);
  assert.equal(restoreOrder(current, ["a", "a"]), null);
  assert.equal(restoreOrder(current, ["b", "a"]), null);
});
