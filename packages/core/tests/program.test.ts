import test from "node:test";
import assert from "node:assert/strict";
import {
  draftDocumentSchema,
  projectClientSnapshot,
  programTimeOrderWarnings,
  type DraftDocument,
  type ProgramItem,
} from "../src/index.ts";

const blockId = "10000000-0000-4000-8000-000000000001";
const itemId = "20000000-0000-4000-8000-000000000001";
const secondId = "20000000-0000-4000-8000-000000000002";
const item = (patch: Partial<ProgramItem> = {}): ProgramItem => ({
  id: itemId,
  time: null,
  title: "Конференция",
  description: "Деловая часть",
  ...patch,
});
const doc = (items = [item()]): DraftDocument => ({
  schemaVersion: 1,
  blocks: [
    {
      id: blockId,
      type: "program",
      heading: "Программа",
      visible: true,
      items,
    },
  ],
});

test("time-order warnings identify an earlier time without rewriting the program", () => {
  const items = [
    item({ time: "17:00" }),
    item({ id: secondId, time: "10:00" }),
  ];
  const before = structuredClone(items);
  assert.deepEqual(programTimeOrderWarnings(items), [secondId]);
  assert.deepEqual(items, before);
  assert.deepEqual(
    programTimeOrderWarnings([
      item({ time: "10:00" }),
      item({ id: secondId, time: null }),
    ]),
    [],
  );
});

test("empty editor blocks do not become client placeholders beside a meaningful program", () => {
  const source = doc();
  source.blocks.push({
    id: "10000000-0000-4000-8000-000000000002",
    type: "text",
    heading: "Пустая идея",
    body: " ",
    visible: true,
  });
  source.blocks.push({
    id: "10000000-0000-4000-8000-000000000003",
    type: "program",
    heading: "Пустая программа",
    items: [],
    visible: true,
  });
  const snapshot = projectClientSnapshot(
    { title: "КП", document: source },
    { name: "Пример", accent: "#4f46e5" },
  );
  assert.equal(snapshot.blocks.length, 1);
  assert.equal(source.blocks.length, 3);
});

test("a program alone is meaningful content; unknown time remains unknown", () => {
  const snapshot = projectClientSnapshot(
    { title: "Учебное событие", document: doc() },
    { name: "Пример", accent: "#4f46e5" },
  );
  assert.equal(snapshot.blocks[0].type, "program");
  assert.deepEqual(
    snapshot.blocks[0].type === "program" && snapshot.blocks[0].items,
    [item()],
  );
});
test("program projection keeps authored order and times, skips empty items and remains an independent snapshot", () => {
  const source = doc([
    item({ time: "17:00" }),
    item({ id: secondId, time: "10:00", title: "Обсуждение" }),
    item({
      id: "20000000-0000-4000-8000-000000000003",
      title: " ",
      description: "Не готово",
    }),
  ]);
  const snapshot = projectClientSnapshot(
    { title: "КП", document: source },
    { name: "Пример", accent: "#4f46e5" },
  );
  const block = snapshot.blocks[0];
  assert.equal(block.type, "program");
  if (block.type !== "program") throw Error("Expected program");
  assert.deepEqual(
    block.items.map((row) => row.time),
    ["17:00", "10:00"],
  );
  assert.equal(JSON.stringify(snapshot).includes("Не готово"), false);
  source.blocks[0].heading = "Другой заголовок";
  assert.equal(block.heading, "Программа");
});
test("empty and hidden programs cannot become client content", () => {
  for (const source of [
    doc([]),
    doc([item({ title: " " })]),
    {
      ...doc(),
      blocks: doc().blocks.map((block) => ({ ...block, visible: false })),
    },
  ]) {
    assert.doesNotThrow(() => draftDocumentSchema.parse(source));
    assert.throws(
      () =>
        projectClientSnapshot(
          { title: "КП", document: source },
          { name: "Пример", accent: "#4f46e5" },
        ),
      { code: "not_ready" },
    );
  }
});
test("program validation rejects malformed times, duplicates, oversized values and undeclared fields", () => {
  for (const time of ["", "9:00", "24:00", "12:60", "10:00:00", 100, true]) {
    assert.equal(
      draftDocumentSchema.safeParse(doc([item({ time: time as string })]))
        .success,
      false,
    );
  }
  for (const time of [null, "00:00", "09:00", "23:59"])
    assert.equal(
      draftDocumentSchema.safeParse(doc([item({ time })])).success,
      true,
    );
  for (const items of [
    [item(), item()],
    [item({ title: "x".repeat(201) })],
    [item({ description: "x".repeat(2001) })],
    [{ ...item(), internalNote: "Untrusted field" }],
    Array.from({ length: 201 }, (_, index) =>
      item({
        id: `20000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      }),
    ),
  ]) {
    assert.equal(draftDocumentSchema.safeParse(doc(items)).success, false);
  }
});
