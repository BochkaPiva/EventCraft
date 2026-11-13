import test from "node:test";
import assert from "node:assert/strict";
import {
  createDefaultScene,
  seatCount,
  validatePlacement,
  furniture,
  findPlacement,
  hall,
  isWalkable,
} from "../src/sceneModel.js";

test("default synthetic hall has 80 seats and every item is valid", () => {
  const scene = createDefaultScene();
  assert.equal(seatCount(scene), 80);
  assert.equal(scene.items.length, 11);
  for (const item of scene.items)
    assert.equal(
      validatePlacement(item, scene).valid,
      true,
      `${item.id}: ${validatePlacement(item, scene).message}`,
    );
});

test("fixed furniture cannot be stretched and invalid numbers are rejected", () => {
  const scene = createDefaultScene(),
    table = scene.items[0];
  assert.equal(validatePlacement({ ...table, width: 3 }, scene).valid, false);
  assert.equal(validatePlacement({ ...table, x: NaN }, scene).valid, false);
  assert.equal(
    validatePlacement({ ...table, rotation: Infinity }, scene).valid,
    false,
  );
  assert.equal(
    validatePlacement({ ...table, type: "constructor" }, scene).valid,
    false,
  );
});

test("hall boundary, columns, furniture and entrance reject occupied placements", () => {
  const scene = createDefaultScene(),
    table = scene.items[0];
  for (const position of [
    { x: -1, z: 5 },
    { x: 15.5, z: 5 },
    { x: 5.5, z: 6.75 },
    { x: 5, z: 5 },
    { x: 8, z: 11.5 },
  ]) {
    assert.equal(
      validatePlacement({ ...table, ...position }, scene).valid,
      false,
      JSON.stringify(position),
    );
  }
  assert.equal(validatePlacement(table, scene).valid, true);
});

test("rotation checks the actual rectangle corners", () => {
  const scene = { items: [] };
  const table = {
    id: "rect",
    type: "banquetTable",
    x: 1.45,
    z: 1.05,
    width: 2.8,
    depth: 1.8,
    rotation: 0,
  };
  assert.equal(validatePlacement(table, scene).valid, false);
  const centered = { ...table, x: 1.6, z: 1.1 };
  assert.equal(validatePlacement(centered, scene).valid, true);
  assert.equal(
    validatePlacement({ ...centered, rotation: 45 }, scene).valid,
    false,
  );
});

test("parametric zones accept supported dimensions but not arbitrary sizes", () => {
  const scene = { items: [] };
  const stage = {
    id: "stage",
    type: "stage",
    x: 8,
    z: 3,
    rotation: 0,
    width: 5,
    depth: 3,
  };
  assert.equal(validatePlacement(stage, scene).valid, true);
  assert.equal(validatePlacement({ ...stage, width: 12 }, scene).valid, false);
  assert.equal(validatePlacement({ ...stage, depth: 0.2 }, scene).valid, false);
});

test("adding and removing kits does not double count their visual chairs", () => {
  const scene = createDefaultScene();
  const extra = findPlacement("roundTable", scene);
  assert.ok(extra);
  assert.equal(seatCount({ items: [...scene.items, extra] }), 88);
  assert.equal(
    seatCount({ items: scene.items.filter((item) => item.id !== "table-1") }),
    72,
  );
  assert.equal(
    seatCount({ items: [{ type: "chair" }, { type: "banquetTable" }] }),
    7,
  );
});

test("walking collides with fixed and dynamic objects", () => {
  const scene = createDefaultScene();
  assert.equal(isWalkable(hall.entrance.x, hall.entrance.z, scene), true);
  assert.equal(isWalkable(2, 5, scene), false);
  assert.equal(isWalkable(5.5, 6.75, scene), false);
  assert.equal(isWalkable(-1, 4, scene), false);
  const empty = {
    items: [
      {
        id: "dance",
        type: "dancefloor",
        x: 2,
        z: 3,
        width: 2,
        depth: 2,
        rotation: 0,
      },
    ],
  };
  assert.equal(isWalkable(2, 3, empty), true);
});

test("validation and search do not mutate input scenes", () => {
  const scene = createDefaultScene(),
    before = JSON.stringify(scene);
  validatePlacement({ ...scene.items[0], x: 20 }, scene);
  for (const type of Object.keys(furniture)) findPlacement(type, scene);
  assert.equal(JSON.stringify(scene), before);
});
