import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateEstimate,
  projectClientSnapshot,
  applyDraftUpdate,
  createAgencyInputSchema,
  createProposalInputSchema,
  draftDocumentSchema,
  type DraftDocument,
  type EstimateLine,
} from "../src/index.ts";
const id = "00000000-0000-4000-8000-000000000001";
const other = "00000000-0000-4000-8000-000000000002";
const line = (patch: Partial<EstimateLine> = {}): EstimateLine => ({
  id,
  description: "Программа",
  quantityThousandths: 1000,
  unitPriceMinor: 100_00,
  included: true,
  ...patch,
});
const doc = (): DraftDocument => ({
  schemaVersion: 1,
  blocks: [
    { id, type: "text", heading: "Идея", body: "День команды", visible: true },
    {
      id: other,
      type: "estimate",
      heading: "Расчёт",
      visible: true,
      lines: [
        line({ unitCostMinor: 30_00, internalNote: "Внутреннее обсуждение" }),
      ],
    },
  ],
});
test("money is calculated in minor units with explicit line rounding", () => {
  assert.deepEqual(
    calculateEstimate([
      line({ quantityThousandths: 333, unitPriceMinor: 100 }),
    ]),
    {
      currency: "RUB",
      knownTotalMinor: 33,
      incomplete: false,
      includedCount: 1,
    },
  );
  assert.equal(
    calculateEstimate([line({ quantityThousandths: 500, unitPriceMinor: 1 })])
      .knownTotalMinor,
    1,
  );
});
test("zero, unknown price, unknown quantity and excluded costs have different effects", () => {
  assert.equal(
    calculateEstimate([line({ unitPriceMinor: 0 })]).incomplete,
    false,
  );
  assert.equal(
    calculateEstimate([line({ unitPriceMinor: null })]).incomplete,
    true,
  );
  assert.equal(
    calculateEstimate([line({ quantityThousandths: null })]).incomplete,
    true,
  );
  assert.equal(
    calculateEstimate([
      line(),
      line({ included: false, unitPriceMinor: 999999 }),
    ]).knownTotalMinor,
    10000,
  );
  assert.equal(calculateEstimate([]).incomplete, true);
});
test("money overflow is rejected instead of silently rounding an unsafe number", () => {
  assert.throws(
    () =>
      calculateEstimate([
        line({
          quantityThousandths: 100_000_000,
          unitPriceMinor: 1_000_000_000_000,
        }),
      ]),
    { code: "money_overflow" },
  );
});
test("client snapshot excludes hidden blocks and nested internal costs", () => {
  const source = doc();
  source.blocks.push({
    id: "00000000-0000-4000-8000-000000000003",
    type: "text",
    heading: "Внутреннее",
    body: "PRIVATE",
    visible: false,
  });
  const result = projectClientSnapshot(
    { title: "КП", document: source },
    { name: "Пример", accent: "#047857" },
  );
  const serialized = JSON.stringify(result);
  assert.equal(result.blocks.length, 2);
  for (const secret of [
    "PRIVATE",
    "unitCostMinor",
    "internalNote",
    "Внутреннее обсуждение",
  ])
    assert.equal(serialized.includes(secret), false);
  assert.equal(
    result.blocks.find((b) => b.type === "estimate")?.summary.knownTotalMinor,
    10000,
  );
});
test("published snapshot stays independent from later content and brand changes", () => {
  const source = doc(),
    brand = { name: "Пример", accent: "#047857" };
  const snapshot = projectClientSnapshot(
    { title: "Первый выпуск", document: source },
    brand,
  );
  const expected = structuredClone(snapshot);
  source.blocks[0].heading = "Новая идея";
  brand.name = "Другой бренд";
  assert.deepEqual(snapshot, expected);
});
test("hidden-only proposal cannot be published but can remain a draft", () => {
  const source = doc();
  source.blocks.forEach((b) => (b.visible = false));
  assert.doesNotThrow(() => draftDocumentSchema.parse(source));
  assert.throws(
    () =>
      projectClientSnapshot(
        { title: "КП", document: source },
        { name: "Пример", accent: "#047857" },
      ),
    { code: "not_ready" },
  );
});
test("untrusted owner and membership fields are rejected by input contracts", () => {
  assert.equal(
    createAgencyInputSchema.safeParse({ name: "Пример", ownerId: other })
      .success,
    false,
  );
  assert.equal(
    createProposalInputSchema.safeParse({
      agencyId: id,
      title: "КП",
      role: "owner",
    }).success,
    false,
  );
});
test("draft update preserves identity and rejects a stale expected revision", () => {
  const record = {
    id,
    agencyId: other,
    title: "КП",
    revision: 3,
    document: doc(),
  };
  const next = applyDraftUpdate(record, 3, {
    title: "Уточнение",
    document: doc(),
  });
  assert.equal(next.revision, 4);
  assert.equal(next.id, id);
  assert.equal(next.agencyId, other);
  assert.equal(record.revision, 3);
  assert.throws(
    () =>
      applyDraftUpdate(next, 3, { title: "Старая вкладка", document: doc() }),
    { code: "revision_conflict" },
  );
});
test("duplicate nested identifiers and invalid numeric representations are rejected", () => {
  const duplicate = doc();
  duplicate.blocks.push({ ...duplicate.blocks[0] });
  assert.equal(draftDocumentSchema.safeParse(duplicate).success, false);
  for (const bad of [-1, 0.1, "", true, Infinity])
    assert.throws(() =>
      calculateEstimate([line({ unitPriceMinor: bad as number })]),
    );
});
