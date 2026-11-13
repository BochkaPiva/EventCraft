import test from "node:test";
import assert from "node:assert/strict";
import {
  createDatabase,
  createAgency,
  actor,
  admin,
  actors,
  documentFixture,
} from "./harness.ts";

test("mutation audit is private, minimal and transactional", async (t) => {
  const db = await createDatabase();
  try {
    const agency = await createAgency(db, actors.alice, "PRIVATE AGENCY");
    const other = await createAgency(db, actors.bob, "PRIVATE OTHER");
    const key = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    await actor(db, actors.alice);
    const args = [agency, "PRIVATE TITLE", documentFixture, key];
    const proposal = (
      await db.query<{ id: string }>(
        "select * from public.create_proposal($1,$2,$3,$4)",
        args,
      )
    ).rows[0];

    await t.test(
      "events derive actor, agency, resource and revision without content; retries do not duplicate creation",
      async () => {
        await db.query(
          "select * from public.create_proposal($1,$2,$3,$4)",
          args,
        );
        await db.query("select * from public.save_proposal_draft($1,0,$2,$3)", [
          proposal.id,
          "PRIVATE CHANGE",
          documentFixture,
        ]);
        await admin(db);
        const events = (
          await db.query<{
            action: string;
            actor_id: string;
            resource_id: string;
            revision: number | null;
            agency_id: string;
            outcome: string;
            occurred_at: Date;
          }>(
            "select * from app_private.audit_events where agency_id=$1 order by occurred_at,id",
            [agency],
          )
        ).rows;
        assert.deepEqual(
          events.map((event) => [
            event.action,
            event.resource_id,
            event.revision,
          ]),
          [
            ["agency.created", agency, null],
            ["proposal.created", proposal.id, 0],
            ["proposal.saved", proposal.id, 1],
          ],
        );
        const owner = (
          await db.query<{ principal_id: string }>(
            "select principal_id from app_private.auth_identities where subject_id=$1",
            [actors.alice],
          )
        ).rows[0].principal_id;
        assert.ok(
          events.every(
            (event) =>
              event.actor_id === owner &&
              event.agency_id === agency &&
              event.outcome === "succeeded" &&
              event.occurred_at,
          ),
        );
        const columns = (
          await db.query<{ column_name: string }>(
            "select column_name from information_schema.columns where table_schema='app_private' and table_name='audit_events' order by ordinal_position",
          )
        ).rows.map((row) => row.column_name);
        assert.deepEqual(columns, [
          "id",
          "agency_id",
          "actor_id",
          "action",
          "resource_id",
          "revision",
          "outcome",
          "occurred_at",
        ]);
        assert.equal(JSON.stringify(events).includes("PRIVATE"), false);
      },
    );

    await t.test(
      "a manager save records the acting manager, not the proposal creator",
      async () => {
        await admin(db);
        const manager = (
          await db.query<{ principal_id: string }>(
            "select principal_id from app_private.auth_identities where subject_id=$1",
            [actors.bob],
          )
        ).rows[0].principal_id;
        await db.query(
          "insert into public.memberships(agency_id,principal_id,role) values($1,$2,'manager')",
          [agency, manager],
        );
        await actor(db, actors.bob);
        await db.query("select * from public.save_proposal_draft($1,1,$2,$3)", [
          proposal.id,
          "PRIVATE MANAGER",
          documentFixture,
        ]);
        await admin(db);
        const event = (
          await db.query<{ actor_id: string; agency_id: string }>(
            "select * from app_private.audit_events where resource_id=$1 and revision=2",
            [proposal.id],
          )
        ).rows[0];
        assert.equal(event.actor_id, manager);
        assert.equal(event.agency_id, agency);
      },
    );

    await t.test(
      "owners, managers, other agencies and anonymous callers cannot read, forge, alter or clear audit records",
      async () => {
        for (const [subject, role] of [
          [actors.alice, "authenticated"],
          [actors.bob, "authenticated"],
          [actors.newcomer, "authenticated"],
          [null, "anon"],
        ] as const) {
          await actor(db, subject, role);
          for (const sql of [
            "select * from app_private.audit_events",
            "insert into app_private.audit_events(agency_id,actor_id,action,resource_id) values(gen_random_uuid(),gen_random_uuid(),'agency.created',gen_random_uuid())",
            "update app_private.audit_events set outcome='succeeded'",
            "delete from app_private.audit_events",
            "truncate app_private.audit_events",
            "select app_private.audit_workspace_mutation()",
          ])
            await assert.rejects(db.exec(sql), { code: "42501" });
        }
        await admin(db);
        const security = (
          await db.query<{ rls: boolean; definer: boolean; config: string[] }>(
            "select c.relrowsecurity rls,p.prosecdef definer,p.proconfig config from pg_class c join pg_namespace n on n.oid=c.relnamespace cross join pg_proc p where n.nspname='app_private' and c.relname='audit_events' and p.oid='app_private.audit_workspace_mutation()'::regprocedure",
          )
        ).rows[0];
        assert.equal(security.rls, true);
        assert.equal(security.definer, false);
        assert.ok(security.config.includes('search_path=""'));
      },
    );

    await t.test(
      "stale, invalid and unauthorized writes produce no success event",
      async () => {
        await admin(db);
        const before = (
          await db.query("select count(*) from app_private.audit_events")
        ).rows;
        await actor(db, actors.alice);
        await assert.rejects(
          db.query("select * from public.save_proposal_draft($1,0,$2,$3)", [
            proposal.id,
            "stale",
            documentFixture,
          ]),
          { code: "EC409" },
        );
        await assert.rejects(
          db.query("select * from public.save_proposal_draft($1,2,$2,$3)", [
            proposal.id,
            "invalid",
            { schemaVersion: 99 },
          ]),
          { code: "22023" },
        );
        await actor(db, actors.newcomer);
        await assert.rejects(
          db.query("select * from public.save_proposal_draft($1,2,$2,$3)", [
            proposal.id,
            "denied",
            documentFixture,
          ]),
          { code: "P0002" },
        );
        await admin(db);
        assert.deepEqual(
          (await db.query("select count(*) from app_private.audit_events"))
            .rows,
          before,
        );
      },
    );

    await t.test(
      "audit insertion failure rolls back the proposal write and new agency identity",
      async () => {
        await admin(db);
        const counts = async () =>
          (
            await db.query(
              "select (select count(*) from app_private.audit_events) events,(select count(*) from public.agencies) agencies,(select count(*) from app_private.principals) principals,(select count(*) from app_private.auth_identities) identities",
            )
          ).rows;
        const before = await counts();
        await db.exec(
          "create function app_private.test_audit_failure() returns trigger language plpgsql as $$ begin raise exception 'synthetic failure'; end $$; create trigger test_audit_failure before insert on app_private.audit_events for each row execute function app_private.test_audit_failure();",
        );
        try {
          await actor(db, actors.alice);
          await assert.rejects(
            db.query("select * from public.save_proposal_draft($1,2,$2,$3)", [
              proposal.id,
              "must roll back",
              documentFixture,
            ]),
            { code: "P0001" },
          );
          await assert.rejects(
            db.query(
              "select * from public.create_proposal($1,$2,$3,gen_random_uuid())",
              [agency, "must roll back", documentFixture],
            ),
            { code: "P0001" },
          );
          await actor(db, actors.newcomer);
          await assert.rejects(
            db.query("select public.create_agency('must roll back')"),
            { code: "P0001" },
          );
        } finally {
          await admin(db);
          await db.exec(
            "drop trigger test_audit_failure on app_private.audit_events; drop function app_private.test_audit_failure();",
          );
        }
        assert.deepEqual(await counts(), before);
        const saved = (
          await db.query<{ revision: number; title: string }>(
            "select revision,title from public.proposals where id=$1",
            [proposal.id],
          )
        ).rows[0];
        assert.equal(saved.revision, 2);
        assert.equal(saved.title, "PRIVATE MANAGER");
        assert.equal(
          (
            await db.query(
              "select * from public.proposals where title='must roll back'",
            )
          ).rows.length,
          0,
        );
        assert.notEqual(agency, other);
      },
    );

    await t.test(
      "a later membership failure rolls back the already inserted agency audit event",
      async () => {
        await admin(db);
        const before = (
          await db.query("select count(*) from app_private.audit_events")
        ).rows;
        await db.exec(
          "create function app_private.test_membership_audit_rollback() returns trigger language plpgsql as $$ begin raise exception 'synthetic failure'; end $$; create trigger test_membership_audit_rollback before insert on public.memberships for each row execute function app_private.test_membership_audit_rollback();",
        );
        try {
          await actor(db, actors.newcomer);
          await assert.rejects(
            db.query("select public.create_agency('rolled back with audit')"),
            { code: "P0001" },
          );
        } finally {
          await admin(db);
          await db.exec(
            "drop trigger test_membership_audit_rollback on public.memberships; drop function app_private.test_membership_audit_rollback();",
          );
        }
        assert.deepEqual(
          (await db.query("select count(*) from app_private.audit_events"))
            .rows,
          before,
        );
        assert.equal(
          (
            await db.query(
              "select * from public.agencies where name='rolled back with audit'",
            )
          ).rows.length,
          0,
        );
      },
    );
  } finally {
    await db.close();
  }
});
