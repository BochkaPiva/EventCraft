import test from "node:test";
import assert from "node:assert/strict";
import { draftDocumentSchema } from "../../packages/core/src/index.ts";
import {
  createDatabase,
  createAgency,
  actor,
  admin,
  actors,
  documentFixture,
} from "./harness.ts";

const row = {
  id: "20000000-0000-4000-8000-000000000001",
  time: null as string | null,
  title: "Конференция",
  description: "Учебная программа",
};
const document = {
  schemaVersion: 1,
  blocks: [
    {
      id: "10000000-0000-4000-8000-000000000001",
      type: "program",
      heading: "Программа",
      visible: true,
      items: [row],
    },
  ],
};

test("program documents retain checked writes, validation and tenant boundaries", async (t) => {
  const db = await createDatabase();
  try {
    const agency = await createAgency(db, actors.alice, "Пример А");
    await createAgency(db, actors.bob, "Пример Б");
    await actor(db, actors.alice);
    const created = (
      await db.query<{ id: string; document: unknown }>(
        "select * from public.create_proposal($1,$2,$3,gen_random_uuid())",
        [agency, "Программа", document],
      )
    ).rows[0];
    assert.deepEqual(created.document, document);
    await t.test(
      "save keeps ordered program items and rejects stale revisions",
      async () => {
        const updated = {
          ...document,
          blocks: [
            {
              ...document.blocks[0],
              items: [
                { ...row, time: "17:00" },
                {
                  ...row,
                  id: "20000000-0000-4000-8000-000000000002",
                  time: "10:00",
                },
              ],
            },
          ],
        };
        const saved = (
          await db.query<{ document: unknown; revision: number }>(
            "select * from public.save_proposal_draft($1,$2,$3,$4)",
            [created.id, 0, "Уточнение", updated],
          )
        ).rows[0];
        assert.deepEqual(saved.document, updated);
        assert.equal(saved.revision, 1);
        await assert.rejects(
          db.query("select * from public.save_proposal_draft($1,$2,$3,$4)", [
            created.id,
            0,
            "Старая вкладка",
            document,
          ]),
          { code: "EC409" },
        );
      },
    );
    await t.test(
      "direct RPC and core agree on invalid program inputs",
      async () => {
        const invalidRows = [
          { ...row, time: "24:00" },
          { ...row, time: "10:60" },
          { ...row, time: "" },
          { ...row, time: 100 },
          { ...row, title: null },
          { ...row, description: null },
          { ...row, title: "x".repeat(201) },
          { ...row, description: "x".repeat(2001) },
          { ...row, id: "bad" },
          { ...row, arbitrary: "field" },
          { id: row.id, time: null, title: row.title },
        ];
        const cases: unknown[] = invalidRows.map((item) => ({
          ...document,
          blocks: [{ ...document.blocks[0], items: [item] }],
        }));
        cases.push({
          ...document,
          blocks: [{ ...document.blocks[0], items: [row, row] }],
        });
        cases.push({
          ...document,
          blocks: [{ ...document.blocks[0], items: {} }],
        });
        cases.push({
          ...document,
          blocks: [{ ...document.blocks[0], items: Array(201).fill(row) }],
        });
        for (const invalid of cases) {
          assert.equal(draftDocumentSchema.safeParse(invalid).success, false);
          await assert.rejects(
            db.query("select * from public.save_proposal_draft($1,$2,$3,$4)", [
              created.id,
              1,
              "Неверно",
              invalid,
            ]),
            { code: "22023" },
          );
        }
        assert.equal(
          (
            await db.query<{ revision: number }>(
              "select revision from public.proposals where id=$1",
              [created.id],
            )
          ).rows[0].revision,
          1,
        );
      },
    );
    await t.test(
      "another agency cannot read or replace the program",
      async () => {
        await actor(db, actors.bob);
        assert.equal(
          (
            await db.query("select * from public.proposals where id=$1", [
              created.id,
            ])
          ).rows.length,
          0,
        );
        await assert.rejects(
          db.query("select * from public.save_proposal_draft($1,$2,$3,$4)", [
            created.id,
            1,
            "Подмена",
            document,
          ]),
          { code: "P0002" },
        );
      },
    );
    await t.test(
      "old documents remain supported and validation gains no public execution",
      async () => {
        await actor(db, actors.alice);
        await assert.doesNotReject(
          db.query(
            "select * from public.create_proposal($1,$2,$3,gen_random_uuid())",
            [agency, "Текст", documentFixture],
          ),
        );
        await admin(db);
        const acl = (
          await db.query<{
            anon: boolean;
            authenticated: boolean;
            definer: boolean;
          }>(
            "select has_function_privilege('anon','app_private.valid_document(jsonb)','execute') as anon, has_function_privilege('authenticated','app_private.valid_document(jsonb)','execute') as authenticated, prosecdef as definer from pg_proc where oid='app_private.valid_document(jsonb)'::regprocedure",
          )
        ).rows[0];
        assert.deepEqual(acl, {
          anon: false,
          authenticated: false,
          definer: false,
        });
      },
    );
  } finally {
    await db.close();
  }
});
