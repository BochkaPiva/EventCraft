-- Successful mutations and their audit records commit or roll back together.
-- No proposal content, names, email, tokens, request headers or arbitrary JSON.
create table app_private.audit_events (
 id uuid primary key default gen_random_uuid(),
 agency_id uuid not null references public.agencies(id),
 actor_id uuid not null references app_private.principals(id),
 action text not null check(action in ('agency.created','proposal.created','proposal.saved')),
 resource_id uuid not null,
 revision integer,
 outcome text not null default 'succeeded' check(outcome='succeeded'),
 occurred_at timestamptz not null default clock_timestamp(),
 check (
  (action='agency.created' and resource_id=agency_id and revision is null)
  or (action in ('proposal.created','proposal.saved') and revision is not null and revision>=0)
 )
);
create index audit_events_agency_time_idx on app_private.audit_events(agency_id,occurred_at,id);
create index audit_events_actor_idx on app_private.audit_events(actor_id);
alter table app_private.audit_events enable row level security;
revoke all on app_private.audit_events from public,anon,authenticated;

-- Invoked inside the existing checked SECURITY DEFINER writes, without adding
-- another privileged entry point. Ordinary callers still cannot write tables.
create function app_private.audit_workspace_mutation() returns trigger
language plpgsql security invoker set search_path='' as $$
declare actor uuid:=app_private.current_actor_id();
begin
 if actor is null then
  raise exception using errcode='42501',message='Active actor required for audited mutation';
 end if;
 if tg_table_schema='public' and tg_table_name='agencies' and tg_op='INSERT' then
  insert into app_private.audit_events(agency_id,actor_id,action,resource_id)
  values(new.id,actor,'agency.created',new.id);
 elsif tg_table_schema='public' and tg_table_name='proposals' and tg_op in ('INSERT','UPDATE') then
  insert into app_private.audit_events(agency_id,actor_id,action,resource_id,revision)
  values(new.agency_id,actor,case when tg_op='INSERT' then 'proposal.created' else 'proposal.saved' end,new.id,new.revision);
 else
  raise exception using errcode='22023',message='Unsupported audit trigger';
 end if;
 return new;
end $$;
revoke execute on function app_private.audit_workspace_mutation() from public,anon,authenticated;
create trigger agencies_audit_insert after insert on public.agencies
 for each row execute function app_private.audit_workspace_mutation();
create trigger proposals_audit_write after insert or update on public.proposals
 for each row execute function app_private.audit_workspace_mutation();
