import test from "node:test";
import assert from "node:assert/strict";
import {
  createDatabase,
  actor,
  admin,
  actors,
  createAgency,
  documentFixture,
} from "./harness.ts";
test("PostgreSQL tenant and mutation boundary", async (t) => {
  const db = await createDatabase();
  try {
    const a = await createAgency(db, actors.alice, "Агентство А");
    const b = await createAgency(db, actors.bob, "Агентство Б");
    await createAgency(db, actors.manager, "Агентство В");
    await actor(db, actors.alice);
    const p = (
      await db.query<{ id: string; revision: number; agency_id: string }>(
        "select * from public.create_proposal($1,$2,$3)",
        [a, "Пример", documentFixture],
      )
    ).rows[0];
    await t.test(
      "direct RPC rejects whitespace-only names and normalizes like HTTP",
      async () => {
        await actor(db, actors.newcomer);
        for (const name of [
          " \t\n\r",
          "\u00a0",
          "\u2003",
          "\u202f",
          "\u3000",
          "\ufeff",
        ]) {
          await assert.rejects(
            db.query("select public.create_agency($1)", [name]),
            { code: "22023" },
          );
        }
        await actor(db, actors.alice);
        const created = await db.query<{ title: string }>(
          "select * from public.create_proposal($1,$2,$3)",
          [a, "\u00a0\tНазвание\n\ufeff", documentFixture],
        );
        assert.equal(created.rows[0].title, "Название");
      },
    );
    await t.test(
      "owner creation is derived from Auth subject and not externally controlled",
      async () => {
        await actor(db, actors.alice);
        const own = await db.query("select * from public.agencies");
        assert.equal(own.rows.length, 1);
        assert.equal((own.rows[0] as { id: string }).id, a);
        await assert.rejects(
          db.query("select public.create_agency($1)", ["Дубликат"]),
          { code: "EC409" },
        );
      },
    );
    await t.test(
      "other agency cannot list, fetch, create or update target proposal",
      async () => {
        await actor(db, actors.bob);
        assert.equal(
          (await db.query("select * from public.proposals where id=$1", [p.id]))
            .rows.length,
          0,
        );
        await assert.rejects(
          db.query("select * from public.create_proposal($1,$2,$3)", [
            a,
            "Чужое",
            documentFixture,
          ]),
          { code: "P0002" },
        );
        await assert.rejects(
          db.query("select * from public.save_proposal_draft($1,$2,$3,$4)", [
            p.id,
            0,
            "Подмена",
            documentFixture,
          ]),
          { code: "P0002" },
        );
      },
    );
    await t.test(
      "ordinary callers cannot bypass checked writes or self-promote",
      async () => {
        await actor(db, actors.alice);
        await assert.rejects(
          db.query("update public.proposals set title=$1 where id=$2", [
            "Без редакции",
            p.id,
          ]),
          { code: "42501" },
        );
        await assert.rejects(
          db.query("update public.proposals set agency_id=$1 where id=$2", [
            b,
            p.id,
          ]),
          { code: "42501" },
        );
        await assert.rejects(
          db.query(
            "insert into public.memberships(agency_id,principal_id,role) values($1,gen_random_uuid(),'owner')",
            [b],
          ),
          { code: "42501" },
        );
        await assert.rejects(
          db.query("update public.memberships set role='owner'"),
          { code: "42501" },
        );
        await assert.rejects(
          db.query("select * from app_private.auth_identities"),
          { code: "42501" },
        );
      },
    );
    await t.test(
      "draft save is atomic and rejects a stale revision",
      async () => {
        await actor(db, actors.alice);
        const first = (
          await db.query<{ revision: number; title: string }>(
            "select * from public.save_proposal_draft($1,$2,$3,$4)",
            [p.id, 0, "Новая редакция", documentFixture],
          )
        ).rows[0];
        assert.equal(first.revision, 1);
        await assert.rejects(
          db.query("select * from public.save_proposal_draft($1,$2,$3,$4)", [
            p.id,
            0,
            "Старая вкладка",
            documentFixture,
          ]),
          { code: "EC409" },
        );
        const current = (
          await db.query<{ title: string }>(
            "select title from public.proposals where id=$1",
            [p.id],
          )
        ).rows[0];
        assert.equal(current.title, "Новая редакция");
      },
    );
    await t.test(
      "malformed nested documents are rejected even through direct RPC",
      async () => {
        await actor(db, actors.alice);
        for (const doc of [
          { schemaVersion: 1, blocks: {} },
          {
            schemaVersion: 1,
            blocks: [{ ...documentFixture.blocks[0], role: "owner" }],
          },
          {
            schemaVersion: 1,
            blocks: [documentFixture.blocks[0], documentFixture.blocks[0]],
          },
        ])
          await assert.rejects(
            db.query("select * from public.save_proposal_draft($1,$2,$3,$4)", [
              p.id,
              1,
              "Некорректно",
              doc,
            ]),
            { code: "22023" },
          );
        assert.equal(
          (
            await db.query<{ revision: number }>(
              "select revision from public.proposals where id=$1",
              [p.id],
            )
          ).rows[0].revision,
          1,
        );
      },
    );
    await t.test(
      "a manager can work inside granted agency but cannot change membership",
      async () => {
        await admin(db);
        const principal = (
          await db.query<{ principal_id: string }>(
            "select principal_id from app_private.auth_identities where subject_id=$1",
            [actors.manager],
          )
        ).rows[0].principal_id;
        await db.query(
          "insert into public.memberships(agency_id,principal_id,role) values($1,$2,'manager')",
          [a, principal],
        );
        await actor(db, actors.manager);
        assert.equal(
          (await db.query("select * from public.proposals where id=$1", [p.id]))
            .rows.length,
          1,
        );
        const saved = (
          await db.query<{ revision: number }>(
            "select * from public.save_proposal_draft($1,$2,$3,$4)",
            [p.id, 1, "От менеджера", documentFixture],
          )
        ).rows[0];
        assert.equal(saved.revision, 2);
        await assert.rejects(
          db.query(
            "update public.memberships set role='owner' where principal_id=$1",
            [principal],
          ),
          { code: "42501" },
        );
        await admin(db);
        await db.query(
          "update public.memberships set active=false where agency_id=$1 and principal_id=$2",
          [a, principal],
        );
        await actor(db, actors.manager);
        assert.equal(
          (await db.query("select * from public.proposals where id=$1", [p.id]))
            .rows.length,
          0,
        );
        await assert.rejects(
          db.query("select * from public.save_proposal_draft($1,$2,$3,$4)", [
            p.id,
            2,
            "После отзыва",
            documentFixture,
          ]),
          { code: "P0002" },
        );
      },
    );
    await t.test(
      "anonymous role and missing Auth subject have no mutation route",
      async () => {
        await actor(db, null, "anon");
        await assert.rejects(db.query("select * from public.proposals"), {
          code: "42501",
        });
        await assert.rejects(
          db.query("select public.create_agency($1)", ["Без входа"]),
          { code: "42501" },
        );
        await actor(db, null);
        assert.equal(
          (await db.query("select * from public.agencies")).rows.length,
          0,
        );
        await assert.rejects(
          db.query("select public.create_agency($1)", ["Без субъекта"]),
          { code: "42501" },
        );
      },
    );
    await t.test(
      "inactive principal cannot revive itself by bootstrapping again",
      async () => {
        await admin(db);
        await db.query(
          "update app_private.principals set active=false where id=(select principal_id from app_private.auth_identities where subject_id=$1)",
          [actors.bob],
        );
        await actor(db, actors.bob);
        assert.equal(
          (await db.query("select * from public.agencies")).rows.length,
          0,
        );
        await assert.rejects(
          db.query("select public.create_agency($1)", [
            "Попытка повторного входа",
          ]),
          { code: "42501" },
        );
      },
    );
    await t.test(
      "failed first membership rolls back agency and new identity together",
      async () => {
        await admin(db);
        const before = (
          await db.query(
            "select (select count(*) from public.agencies) a,(select count(*) from app_private.principals) p,(select count(*) from app_private.auth_identities) i",
          )
        ).rows[0];
        await db.exec(
          "create function app_private.test_membership_failure() returns trigger language plpgsql as $$ begin raise exception 'synthetic failure';end $$;create trigger test_failure before insert on public.memberships for each row execute function app_private.test_membership_failure();",
        );
        await actor(db, actors.newcomer);
        await assert.rejects(
          db.query("select public.create_agency($1)", ["Откат"]),
          { code: "P0001" },
        );
        await admin(db);
        await db.exec(
          "drop trigger test_failure on public.memberships;drop function app_private.test_membership_failure();",
        );
        assert.deepEqual(
          (
            await db.query(
              "select (select count(*) from public.agencies) a,(select count(*) from app_private.principals) p,(select count(*) from app_private.auth_identities) i",
            )
          ).rows[0],
          before,
        );
      },
    );
    await t.test(
      "exposed tables have RLS and exposed functions have no definer privileges",
      async () => {
        await admin(db);
        const tables = await db.query<{
          relname: string;
          relrowsecurity: boolean;
        }>(
          "select relname,relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'",
        );
        assert.equal(tables.rows.length, 3);
        assert.ok(tables.rows.every((t) => t.relrowsecurity));
        assert.equal(
          (
            await db.query<{ count: number }>(
              "select count(*)::integer count from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and prosecdef",
            )
          ).rows[0].count,
          0,
        );
      },
    );
  } finally {
    await db.close();
  }
});
