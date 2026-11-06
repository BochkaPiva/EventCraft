import test from "node:test";
import assert from "node:assert/strict";
import { DraftSaver, type WorkingDraft } from "../src/lib/draft-saver.ts";
const initial: WorkingDraft = {
  title: "Первый",
  document: { schemaVersion: 1, blocks: [] },
};
test("returning to the previous text while a write is pending still protects navigation", async () => {
  let resolve!: (result: { revision: number }) => void;
  const saver = new DraftSaver(
    initial,
    0,
    () => new Promise((r) => (resolve = r)),
    () => {},
  );
  saver.update({ ...initial, title: "B" });
  const pending = saver.flush();
  saver.update(initial);
  assert.equal(saver.view.dirty, true);
  resolve({ revision: 1 });
  await pending;
  assert.equal(saver.view.dirty, true);
  assert.equal(saver.view.status, "unsaved");
});
test("a lost acknowledgement followed by reverting text cannot falsely report saved", async () => {
  let serverRevision = 0,
    calls = 0;
  const saver = new DraftSaver(
    initial,
    0,
    async (_draft, expected) => {
      calls++;
      if (expected !== serverRevision) throw { status: 409 };
      serverRevision++;
      throw Error("reply lost after commit");
    },
    () => {},
  );
  saver.update({ ...initial, title: "B" });
  await saver.flush();
  saver.update(initial);
  saver.retry();
  assert.equal(saver.view.dirty, true);
  assert.equal(saver.view.status, "unsaved");
  await saver.flush();
  assert.equal(calls, 2);
  assert.equal(saver.view.status, "conflict");
  assert.equal(saver.view.dirty, true);
  assert.equal(saver.view.revision, 0);
});
test("typing during a pending save remains dirty and uses the acknowledged revision next", async () => {
  let resolve!: (result: { revision: number }) => void;
  const calls: Array<{ title: string; revision: number }> = [];
  const saver = new DraftSaver(
    initial,
    0,
    async (draft, revision) => {
      calls.push({ title: draft.title, revision });
      if (calls.length === 1) return new Promise((r) => (resolve = r));
      return { revision: revision + 1 };
    },
    () => {},
  );
  saver.update({ ...initial, title: "Отправлено" });
  const pending = saver.flush();
  saver.update({ ...initial, title: "Допечатано" });
  await saver.flush();
  assert.equal(calls.length, 1);
  resolve({ revision: 1 });
  await pending;
  assert.equal(saver.view.status, "unsaved");
  assert.equal(saver.view.dirty, true);
  await saver.flush();
  assert.deepEqual(calls, [
    { title: "Отправлено", revision: 0 },
    { title: "Допечатано", revision: 1 },
  ]);
  assert.equal(saver.view.status, "saved");
});
test("a conflict preserves edits and cannot be blindly retried with a new revision", async () => {
  let calls = 0;
  const saver = new DraftSaver(
    initial,
    4,
    async () => {
      calls++;
      throw { status: 409 };
    },
    () => {},
  );
  saver.update({ ...initial, title: "Мои правки" });
  await saver.flush();
  saver.retry();
  await saver.flush();
  assert.equal(calls, 1);
  assert.equal(saver.view.revision, 4);
  assert.equal(saver.view.status, "conflict");
  assert.equal(saver.view.dirty, true);
});
test("a transport failure waits for explicit retry and never reports saved", async () => {
  let calls = 0;
  const saver = new DraftSaver(
    initial,
    2,
    async () => {
      if (++calls === 1) throw Error("network");
      return { revision: 3 };
    },
    () => {},
  );
  saver.update({ ...initial, title: "Правки" });
  await saver.flush();
  await saver.flush();
  assert.equal(calls, 1);
  assert.equal(saver.view.status, "error");
  saver.retry();
  await saver.flush();
  assert.equal(saver.view.status, "saved");
});
test("unexpected acknowledgement and disposed editor never report a successful save", async () => {
  let events = 0;
  const saver = new DraftSaver(
    initial,
    0,
    async () => ({ revision: 99 }),
    () => events++,
  );
  saver.update({ ...initial, title: "Правки" });
  await saver.flush();
  assert.equal(saver.view.status, "error");
  assert.equal(saver.view.revision, 0);
  saver.dispose();
  const previous = events;
  saver.update({ ...initial, title: "Другие" });
  await saver.flush();
  assert.equal(events, previous);
});
