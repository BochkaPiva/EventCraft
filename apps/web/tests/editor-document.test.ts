import test from "node:test";
import assert from "node:assert/strict";
import { draftDocumentSchema, type DraftDocument } from "@eventcraft/core";
import {
  duplicateBlock,
  restoreDeleted,
  type DeletedContent,
} from "../src/lib/editor-document.ts";

const text = {
  id: "11111111-1111-4111-8111-111111111111",
  type: "text" as const,
  heading: "Идея",
  body: "Исходный текст",
  visible: true,
};
const line = {
  id: "22222222-2222-4222-8222-222222222222",
  description: "Свет",
  quantityThousandths: 1000,
  unitPriceMinor: null,
  unitCostMinor: 0,
  internalNote: "Внутренняя заметка",
  included: false,
};
const estimate = {
  id: "33333333-3333-4333-8333-333333333333",
  type: "estimate" as const,
  heading: "Расчёт",
  lines: [line],
  visible: false,
};
const item = {
  id: "44444444-4444-4444-8444-444444444444",
  time: null,
  title: "Ужин",
  description: "Время уточняется",
};
const program = {
  id: "55555555-5555-4555-8555-555555555555",
  type: "program" as const,
  heading: "Вечер",
  items: [item],
  visible: true,
};

test("duplicating all section types preserves meaning and private fields with independent IDs and objects", () => {
  for (const source of [text, estimate, program]) {
    const copy = duplicateBlock(source);
    assert.notEqual(copy.id, source.id);
    const restored = structuredClone(copy);
    restored.id = source.id;
    if (restored.type === "estimate") {
      assert.notEqual(restored.lines[0].id, line.id);
      restored.lines[0].id = line.id;
    }
    if (restored.type === "program") {
      assert.notEqual(restored.items[0].id, item.id);
      restored.items[0].id = item.id;
    }
    assert.deepEqual(restored, source);
    assert.notEqual(copy, source);
    draftDocumentSchema.parse({ schemaVersion: 1, blocks: [source, copy] });
  }
  const copy = duplicateBlock(estimate);
  if (copy.type !== "estimate") assert.fail();
  copy.lines[0].description = "Другой свет";
  assert.equal(estimate.lines[0].description, "Свет");
});

test("restoring a section retains subsequent edits and additions to the current document", () => {
  const current: DraftDocument = {
    schemaVersion: 1,
    blocks: [{ ...text, body: "Поздняя правка" }, program],
  };
  const removed: DeletedContent = {
    kind: "block",
    label: "Расчёт",
    index: 1,
    block: estimate,
  };
  const result = restoreDeleted(current, removed);
  assert.deepEqual(result?.blocks, [current.blocks[0], estimate, program]);
  assert.equal(current.blocks.length, 2);
  assert.equal(restoreDeleted(result!, removed), null);
});

test("restoring a service or program stage changes only the target collection and keeps unknown values", () => {
  for (const deleted of [
    {
      kind: "line",
      label: "Свет",
      index: 0,
      blockId: estimate.id,
      line,
    } as const,
    {
      kind: "item",
      label: "Ужин",
      index: 0,
      blockId: program.id,
      item,
    } as const,
  ]) {
    const current: DraftDocument = {
      schemaVersion: 1,
      blocks: [
        text,
        { ...estimate, heading: "Поздний заголовок", lines: [] },
        { ...program, items: [] },
      ],
    };
    const result = restoreDeleted(current, deleted)!;
    assert.equal(result.blocks[0], text);
    assert.equal(result.blocks[1].heading, "Поздний заголовок");
    const target = result.blocks.find((block) => block.id === deleted.blockId)!;
    if (target.type === "estimate") assert.deepEqual(target.lines, [line]);
    if (target.type === "program") assert.deepEqual(target.items, [item]);
    assert.equal(restoreDeleted(result, deleted), null);
    draftDocumentSchema.parse(result);
  }
});

test("undo does not exceed document limits or recreate a missing or wrong target section", () => {
  const removed: DeletedContent = {
    kind: "line",
    label: "Свет",
    index: 0,
    blockId: estimate.id,
    line,
  };
  assert.equal(restoreDeleted({ schemaVersion: 1, blocks: [] }, removed), null);
  assert.equal(
    restoreDeleted(
      { schemaVersion: 1, blocks: [{ ...text, id: estimate.id }] },
      removed,
    ),
    null,
  );
  assert.equal(
    restoreDeleted(
      {
        schemaVersion: 1,
        blocks: [
          {
            ...estimate,
            lines: Array.from({ length: 200 }, () => ({
              ...line,
              id: crypto.randomUUID(),
            })),
          },
        ],
      },
      removed,
    ),
    null,
  );
  assert.equal(
    restoreDeleted(
      {
        schemaVersion: 1,
        blocks: Array.from({ length: 64 }, () => ({
          ...text,
          id: crypto.randomUUID(),
        })),
      },
      { kind: "block", label: "Расчёт", index: 1, block: estimate },
    ),
    null,
  );
});
