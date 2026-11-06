import test from "node:test";
import assert from "node:assert/strict";
import {
  createProposal,
  initialState,
  publicationIssues,
  publicDocument,
  publish,
  total,
  readState,
} from "../src/model.js";
import { createDefaultScene } from "../src/sceneModel.js";

function agency() {
  return {
    name: "Агентство Пример",
    accent: "#334155",
    logo: "/example-logo.png",
    email: "contact@example.test",
    phone: "+7 (000) 000-00-00",
  };
}

function proposal() {
  const value = createProposal();
  return Object.assign(value, {
    title: "Командная встреча",
    client: "Учебный заказчик",
    guests: 80,
    intro: "Программа и предварительный состав работ для обсуждения.",
    program: [
      {
        id: "welcome",
        time: "10:00",
        title: "Встреча",
        description: "Общее начало",
      },
    ],
    estimate: [
      {
        id: "program",
        name: "Программа",
        quantity: 1,
        price: 40000,
        included: true,
      },
    ],
    venue: {
      id: "example-hall",
      name: "Учебный зал",
      city: "Омск",
      description: "Синтетическая геометрия",
      kind: "hall",
      image: "/images/venue.jpg",
      hasScene: true,
    },
    scene: createDefaultScene(),
    sections: ["cover", "idea", "program", "venue", "estimate"],
  });
}

test("publication takes a detached content and brand snapshot without changing the source history", () => {
  const draft = proposal(),
    brand = agency();
  const published = publish(draft, brand);
  const release = published.releases[0];
  const original = structuredClone(release.document);

  assert.equal(draft.releases.length, 0);
  assert.equal(published.releases.length, 1);
  assert.equal(release.number, 1);

  published.title = "Другая концепция";
  published.program[0].title = "Новый этап";
  published.estimate[0].price = 90000;
  published.scene.items[0].x = 3;
  published.venue.name = "Другой зал";
  published.permissions.layout = true;
  published.sections.push("team");
  brand.name = "Другое агентство";
  brand.accent = "#ff0000";
  brand.logo = "/replacement-logo.png";

  assert.deepEqual(release.document, original);
});

test("a new publication includes current changes while keeping the previous release intact", () => {
  const brand = agency();
  const first = publish(proposal(), brand);
  const firstSnapshot = structuredClone(first.releases[0]);
  const revised = {
    ...first,
    revision: first.revision + 1,
    guests: 120,
    estimate: [{ ...first.estimate[0], price: 60000 }],
  };
  brand.accent = "#047857";
  const second = publish(revised, brand);

  assert.equal(first.releases.length, 1);
  assert.equal(second.releases.length, 2);
  assert.deepEqual(second.releases[0], firstSnapshot);
  assert.notEqual(second.releases[1].id, firstSnapshot.id);
  assert.equal(second.releases[1].number, 2);
  assert.equal(second.releases[1].revision, revised.revision);
  assert.equal(second.releases[1].document.guests, 120);
  assert.equal(second.releases[1].document.estimate[0].price, 60000);
  assert.equal(second.releases[1].document.brand.accent, "#047857");
  assert.equal(firstSnapshot.document.guests, 80);
});

test("customer projection excludes private and unknown fields at every nested boundary", () => {
  const draft = proposal(),
    brand = agency();
  draft.internalNotes = "PRIVATE-TOP-LEVEL";
  draft.accessToken = "PRIVATE-ACCESS-TOKEN";
  draft.program[0].internalNotes = "PRIVATE-PROGRAM";
  draft.program[0].unknownProperty = "PRIVATE-UNKNOWN-PROGRAM";
  draft.estimate[0].costPrice = 17000;
  draft.estimate[0].margin = 23000;
  draft.estimate[0].supplierContact = "supplier@example.test";
  draft.venue.internalAccessCode = "PRIVATE-VENUE";
  draft.scene.internalNotes = "PRIVATE-SCENE";
  draft.scene.items[0].procurementCost = 777;
  draft.scene.items[0].unknownProperty = "PRIVATE-UNKNOWN-ITEM";
  draft.permissions.privateRole = "PRIVATE-ROLE";
  brand.billing = "PRIVATE-BILLING";

  const document = publicDocument(draft, brand);
  const serialized = JSON.stringify(document);
  for (const field of [
    "internalNotes",
    "accessToken",
    "code",
    "costPrice",
    "margin",
    "supplierContact",
    "internalAccessCode",
    "procurementCost",
    "privateRole",
    "billing",
    "unknownProperty",
    "releases",
  ]) {
    assert.equal(
      serialized.includes(`"${field}"`),
      false,
      `Customer document leaks ${field}`,
    );
  }
  assert.equal(serialized.includes("PRIVATE-"), false);
  assert.equal(document.program[0].description, "Общее начало");
  assert.equal(document.estimate[0].price, 40000);
  assert.equal(document.venue.name, "Учебный зал");
  assert.equal(document.scene.items.length, draft.scene.items.length);
  assert.equal(document.brand.email, brand.email);
});

test("changing a customer projection does not mutate the working proposal or its brand", () => {
  const draft = proposal(),
    brand = agency();
  const before = structuredClone({ draft, brand });
  const document = publicDocument(draft, brand);
  document.program[0].description = "Изменённый клиентский текст";
  document.estimate.splice(0, 1);
  document.scene.items.pop();
  document.brand.name = "Изменённое отображение";
  assert.deepEqual({ draft, brand }, before);
});

test("unknown included costs keep the total partial while excluded and unnamed rows do not add charges", () => {
  const draft = proposal();
  draft.estimate = [
    { id: "known", name: "Питание", quantity: 80, price: 1000, included: true },
    {
      id: "unknown-price",
      name: "Трансфер",
      quantity: 1,
      price: null,
      included: true,
    },
    {
      id: "unknown-quantity",
      name: "Дополнительное обслуживание",
      quantity: null,
      price: 5000,
      included: true,
    },
    {
      id: "excluded",
      name: "Не включённая опция",
      quantity: 1,
      price: 90000,
      included: false,
    },
    { id: "unnamed", name: "   ", quantity: 1, price: 70000, included: true },
  ];
  assert.deepEqual(total(draft), { amount: 80000, partial: true, count: 3 });
  assert.deepEqual(publicationIssues(draft), []);
});

test("a genuinely free included item differs from an unknown price or an empty estimate", () => {
  const draft = proposal();
  draft.estimate = [
    {
      id: "free",
      name: "Включённая консультация",
      quantity: 1,
      price: 0,
      included: true,
    },
  ];
  assert.deepEqual(total(draft), { amount: 0, partial: false, count: 1 });
  assert.deepEqual(publicationIssues(draft), []);

  draft.estimate[0].price = null;
  assert.deepEqual(total(draft), { amount: 0, partial: true, count: 1 });
  draft.estimate = [];
  assert.deepEqual(total(draft), { amount: 0, partial: true, count: 0 });
});

test("publication rejects nonpositive, nonfinite and malformed quantities", async (t) => {
  for (const quantity of [
    0,
    -1,
    NaN,
    Infinity,
    -Infinity,
    "",
    "   ",
    "not a quantity",
    true,
  ]) {
    await t.test(`quantity ${String(quantity)}`, () => {
      const draft = proposal();
      draft.estimate[0].quantity = quantity;
      assert.ok(
        publicationIssues(draft).some((issue) => issue.includes("количество")),
      );
      assert.throws(() => publish(draft, agency()));
      assert.equal(draft.releases.length, 0);
    });
  }
});

test("publication rejects negative, nonfinite and malformed prices instead of treating them as free", async (t) => {
  for (const price of [
    -1,
    NaN,
    Infinity,
    -Infinity,
    "",
    "   ",
    "not a price",
    true,
    false,
  ]) {
    await t.test(`price ${String(price)}`, () => {
      const draft = proposal();
      draft.estimate[0].price = price;
      assert.ok(
        publicationIssues(draft).some((issue) => issue.includes("цену")),
      );
      assert.throws(() => publish(draft, agency()));
      assert.equal(draft.releases.length, 0);
    });
  }
});

test("a title alone or blank placeholder rows cannot be published as a completed proposal", () => {
  const draft = createProposal();
  assert.throws(() => publish(draft, agency()));
  draft.title = "Пока только название";
  draft.intro = "   ";
  draft.program = [{ id: "empty", title: " ", time: "", description: "" }];
  draft.estimate = [
    { id: "empty", name: " ", quantity: 1, price: 1000, included: true },
  ];
  assert.throws(() => publish(draft, agency()));
  assert.equal(draft.releases.length, 0);

  draft.intro = "Предварительная концепция без выбранной даты и площадки.";
  assert.doesNotThrow(() => publish(draft, agency()));
});

test("normal initial state is empty and opt-in demo uses explicitly synthetic contact and venue data", () => {
  const empty = initialState();
  assert.equal(empty.agency, null);
  assert.deepEqual(empty.proposals, []);
  assert.deepEqual(empty.requests, []);
  assert.deepEqual(empty.team, []);

  const demo = initialState(true);
  assert.ok(demo.proposals.length > 0);
  for (const contact of [demo.agency, ...demo.team]) {
    assert.match(contact.email, /@example\.test$/);
  }
  assert.match(demo.agency.phone, /\(000\)/);
  const published = demo.proposals.find((value) => value.releases.length);
  assert.ok(published);
  assert.match(
    published.venue.description,
    /учебная.*не модель реальной площадки/,
  );
  assert.match(published.releases[0].document.brand.email, /@example\.test$/);

  demo.proposals[0].program[0].title = "Локальная тестовая правка";
  const anotherDemo = initialState(true);
  assert.notEqual(
    anotherDemo.proposals[0].program[0].title,
    "Локальная тестовая правка",
  );
});
