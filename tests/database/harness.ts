import { PGlite } from "@electric-sql/pglite";
import { readdir, readFile } from "node:fs/promises";
import assert from "node:assert/strict";
export const actors = {
  alice: "11111111-1111-4111-8111-111111111111",
  bob: "22222222-2222-4222-8222-222222222222",
  manager: "33333333-3333-4333-8333-333333333333",
  newcomer: "44444444-4444-4444-8444-444444444444",
};
export async function createDatabase() {
  const db = new PGlite();
  await db.exec(`create role anon nologin;create role authenticated nologin;create schema auth;grant usage on schema auth to anon,authenticated;
-- Test fixture only: models a subject already verified by the external Auth gateway.
create function auth.uid() returns uuid language sql stable as $$ select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid $$;
grant execute on function auth.uid() to anon,authenticated;`);
  const dir = new URL("../../supabase/migrations/", import.meta.url);
  for (const name of (await readdir(dir))
    .filter((n) => n.endsWith(".sql"))
    .sort())
    await db.exec(await readFile(new URL(name, dir), "utf8"));
  return db;
}
export async function actor(
  db: PGlite,
  id: string | null,
  role = "authenticated",
) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claims',$1,false)", [
    JSON.stringify(id ? { sub: id, role } : { role }),
  ]);
  if (!["authenticated", "anon"].includes(role))
    throw Error("Unsupported test role");
  await db.exec(`set role ${role}`);
  assert.equal(
    (await db.query<{ current_user: string }>("select current_user")).rows[0]
      .current_user,
    role,
  );
}
export async function admin(db: PGlite) {
  await db.exec("reset role");
}
export async function createAgency(db: PGlite, subject: string, name: string) {
  await actor(db, subject);
  return (
    await db.query<{ id: string }>("select public.create_agency($1) as id", [
      name,
    ])
  ).rows[0].id;
}
export const documentFixture = {
  schemaVersion: 1,
  blocks: [
    {
      id: "55555555-5555-4555-8555-555555555555",
      type: "text",
      heading: "Идея",
      body: "Учебное событие",
      visible: true,
    },
  ],
};
