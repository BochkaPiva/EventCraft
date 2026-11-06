import test from "node:test";
import assert from "node:assert/strict";
import {
  readState,
  initialState,
  createProposal,
  publicationIssues,
  publicDocument,
} from "../src/model.js";
function restore(raw) {
  const previous = globalThis.localStorage;
  let writes = 0;
  globalThis.localStorage = { getItem: () => raw, setItem: () => writes++ };
  try {
    return { ...readState(), writes };
  } finally {
    if (previous === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previous;
  }
}
test("valid saved workspace and unfinished draft are restored intact", () => {
  const state = initialState(true);
  const p = createProposal();
  p.title = "Свой черновик";
  p.estimate = [
    {
      id: "unknown",
      name: "Трансфер",
      quantity: null,
      price: null,
      included: true,
    },
  ];
  state.proposals.push(p);
  assert.deepEqual(restore(JSON.stringify(state)).data, state);
});
test("corrupt JSON and unknown schema preserve raw data and offer recovery", () => {
  for (const raw of [
    "{broken",
    JSON.stringify({ schema: 9 }),
    JSON.stringify({ ...initialState(), proposals: [null] }),
  ]) {
    const result = restore(raw);
    assert.ok(result.error);
    assert.equal(result.writes, 0);
    assert.equal(result.data.agency, null);
  }
});
test("broken nested records are rejected before rendering instead of crashing a page", () => {
  const mutations = [
    (d) => {
      d.agency.name = null;
    },
    (d) => {
      d.proposals[0].program = {};
    },
    (d) => {
      d.proposals[0].scene.items[0].type = "unknown";
    },
    (d) => {
      d.proposals[0].releases[0].document.brand = null;
    },
    (d) => {
      d.team = null;
    },
    (d) => {
      d.billing = null;
    },
  ];
  for (const mutate of mutations) {
    const state = initialState(true);
    mutate(state);
    const result = restore(JSON.stringify(state));
    assert.ok(result.error);
    assert.equal(result.writes, 0);
  }
});
test("storage access failure returns a recoverable state without writes", () => {
  const previous = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: () => {
      throw Error("blocked");
    },
  };
  try {
    assert.ok(readState().error);
  } finally {
    if (previous === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previous;
  }
});
test("hidden content alone does not make an empty visible proposal ready to publish", () => {
  const p = createProposal("team");
  p.sections = ["cover"];
  assert.ok(publicationIssues(p).length);
  p.sections.push("idea");
  assert.deepEqual(publicationIssues(p), []);
});
test("hidden estimate remains in the agency draft while its prices are absent from the customer projection", () => {
  const p = createProposal("team");
  p.sections = ["cover", "idea"];
  const d = initialState(true);
  d.proposals = [p];
  const result = restore(JSON.stringify(d));
  assert.equal(result.data.proposals[0].estimate.length, 3);
  const projected = publicDocument(p, d.agency);
  assert.deepEqual(projected.estimate, []);
  assert.deepEqual(projected.program, []);
  assert.equal(projected.scene, null);
  assert.equal(projected.permissions.layout, false);
});
