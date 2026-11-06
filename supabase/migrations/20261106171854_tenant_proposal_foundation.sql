-- M0: caller-scoped reads; writes only through authenticated, checked operations.
create schema if not exists app_private;
revoke all on schema app_private from public;
grant usage on schema app_private to authenticated;
revoke create on schema public from public, anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema app_private revoke execute on functions from public;

-- Match ECMAScript String.trim so direct RPC and HTTP accept the same names.
create function app_private.trim_text(value text) returns text language sql immutable security invoker set search_path='' as $$
 select btrim(value,U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF')
$$;

create table app_private.principals (
 id uuid primary key default gen_random_uuid(), active boolean not null default true,
 created_at timestamptz not null default now()
);
create table app_private.auth_identities (
 provider text not null, subject_id uuid not null,
 principal_id uuid not null references app_private.principals(id),
 primary key(provider,subject_id), unique(provider,principal_id)
);
alter table app_private.principals enable row level security;
alter table app_private.auth_identities enable row level security;

create table public.agencies (
 id uuid primary key default gen_random_uuid(), name text not null check(char_length(app_private.trim_text(name)) between 1 and 100),
 created_by uuid not null unique references app_private.principals(id),
 created_at timestamptz not null default now()
);
create table public.memberships (
 agency_id uuid not null references public.agencies(id),
 principal_id uuid not null references app_private.principals(id),
 role text not null check(role in ('owner','manager')), active boolean not null default true,
 created_at timestamptz not null default now(), primary key(agency_id,principal_id)
);
create index memberships_principal_idx on public.memberships(principal_id,agency_id);

-- Provider adapter. Domain entities never use auth.users as their primary key/FK.
create function app_private.external_subject_id() returns uuid language sql stable security invoker set search_path='' as $$ select auth.uid() $$;
create function app_private.current_actor_id() returns uuid language sql stable security definer set search_path='' as $$
 select i.principal_id from app_private.auth_identities i join app_private.principals p on p.id=i.principal_id
 where (select app_private.external_subject_id()) is not null and i.provider='supabase'
 and i.subject_id=(select app_private.external_subject_id()) and p.active
$$;
create function app_private.has_agency_role(target_agency uuid, allowed_roles text[]) returns boolean language sql stable security definer set search_path='' as $$
 select (select app_private.external_subject_id()) is not null and exists (
  select 1 from public.memberships m where m.agency_id=target_agency
  and m.principal_id=(select app_private.current_actor_id()) and m.active and m.role=any(allowed_roles)
 )
$$;

create function app_private.valid_scaled_number(v jsonb,maximum numeric,allow_zero boolean) returns boolean language plpgsql immutable set search_path='' as $$
declare n numeric;
begin
 if v='null'::jsonb then return true; end if;
 if jsonb_typeof(v) is distinct from 'number' then return false; end if;
 n:=v::text::numeric;
 return n=trunc(n) and n<=maximum and case when allow_zero then n>=0 else n>0 end;
exception when others then return false;
end $$;
create function app_private.valid_document(d jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare b jsonb; l jsonb; ids text[]:='{}'; line_ids text[]; block_id text;
begin
 if not coalesce(jsonb_typeof(d)='object' and d->'schemaVersion'='1'::jsonb and jsonb_typeof(d->'blocks')='array' and d-array['schemaVersion','blocks']='{}'::jsonb,false) then return false; end if;
 if octet_length(d::text)>524288 or jsonb_array_length(d->'blocks')>64 then return false; end if;
 for b in select value from jsonb_array_elements(d->'blocks') loop
  if not coalesce(jsonb_typeof(b)='object' and b?&array['id','type','heading','visible'] and jsonb_typeof(b->'heading')='string' and char_length(b->>'heading')<=160 and jsonb_typeof(b->'visible')='boolean',false) then return false; end if;
  block_id:=lower(b->>'id');
  if not coalesce(block_id~'^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',false) or block_id=any(ids) then return false; end if;
  ids:=array_append(ids,block_id);
  if b->>'type'='text' then
   if not coalesce(jsonb_typeof(b->'body')='string' and char_length(b->>'body')<=20000 and b-array['id','type','heading','body','visible']='{}'::jsonb,false) then return false; end if;
  elsif b->>'type'='estimate' then
   if not coalesce(jsonb_typeof(b->'lines')='array' and b-array['id','type','heading','lines','visible']='{}'::jsonb,false) then return false; end if;
   if jsonb_array_length(b->'lines')>200 then return false; end if;
   line_ids:='{}';
   for l in select value from jsonb_array_elements(b->'lines') loop
    if not coalesce(jsonb_typeof(l)='object' and l?&array['id','description','quantityThousandths','unitPriceMinor','included'] and jsonb_typeof(l->'description')='string' and char_length(l->>'description')<=300 and jsonb_typeof(l->'included')='boolean' and l-array['id','description','quantityThousandths','unitPriceMinor','included','unitCostMinor','internalNote']='{}'::jsonb,false) then return false; end if;
    if not coalesce(lower(l->>'id')~'^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',false) or lower(l->>'id')=any(line_ids) then return false; end if;
    line_ids:=array_append(line_ids,lower(l->>'id'));
    if not app_private.valid_scaled_number(l->'quantityThousandths',100000000,false) or not app_private.valid_scaled_number(l->'unitPriceMinor',1000000000000,true) then return false; end if;
    if l?'unitCostMinor' and not app_private.valid_scaled_number(l->'unitCostMinor',1000000000000,true) then return false; end if;
    if l?'internalNote' and not coalesce(jsonb_typeof(l->'internalNote')='string' and char_length(l->>'internalNote')<=2000,false) then return false; end if;
   end loop;
  else return false;
  end if;
 end loop;
 return true;
end $$;

create table public.proposals (
 id uuid primary key default gen_random_uuid(), agency_id uuid not null references public.agencies(id),
 created_by uuid not null references app_private.principals(id),
 title text not null default '' check(char_length(title)<=180),
 document jsonb not null default '{"schemaVersion":1,"blocks":[]}'::jsonb check(app_private.valid_document(document)),
 revision integer not null default 0 check(revision>=0),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(agency_id,id)
);
create index proposals_agency_updated_idx on public.proposals(agency_id,updated_at desc,id);
create index proposals_creator_idx on public.proposals(created_by);

alter table public.agencies enable row level security;
alter table public.memberships enable row level security;
alter table public.proposals enable row level security;
create policy agencies_member_read on public.agencies for select to authenticated using ((select app_private.has_agency_role(id,array['owner','manager'])));
create policy memberships_member_read on public.memberships for select to authenticated using ((select app_private.has_agency_role(agency_id,array['owner','manager'])));
create policy proposals_member_read on public.proposals for select to authenticated using ((select app_private.has_agency_role(agency_id,array['owner','manager'])));

-- Narrow privileged operations: actor is always derived from the verified subject,
-- membership is checked inside the operation, and functions are not in an exposed schema.
create function app_private.create_agency(agency_name text) returns uuid language plpgsql security definer set search_path='' as $$
declare subject uuid:=app_private.external_subject_id(); actor uuid; agency uuid;
begin
 if subject is null then raise exception using errcode='42501',message='Authentication required'; end if;
 agency_name:=app_private.trim_text(agency_name);
 if agency_name is null or char_length(agency_name) not between 1 and 100 then raise exception using errcode='22023',message='Invalid agency name'; end if;
 perform pg_advisory_xact_lock(hashtextextended('eventcraft.agency:'||subject::text,0));
 select i.principal_id into actor from app_private.auth_identities i where i.provider='supabase' and i.subject_id=subject;
 if actor is null then
  insert into app_private.principals default values returning id into actor;
  insert into app_private.auth_identities(provider,subject_id,principal_id) values('supabase',subject,actor);
 elsif not exists(select 1 from app_private.principals p where p.id=actor and p.active) then
  raise exception using errcode='42501',message='Inactive principal';
 end if;
 if exists(select 1 from public.agencies a where a.created_by=actor) then raise exception using errcode='EC409',message='Agency already created'; end if;
 insert into public.agencies(name,created_by) values(agency_name,actor) returning id into agency;
 insert into public.memberships(agency_id,principal_id,role) values(agency,actor,'owner');
 return agency;
end $$;
create function app_private.create_proposal(agency_id uuid,proposal_title text,proposal_document jsonb) returns setof public.proposals language plpgsql security definer set search_path='' as $$
begin
 if app_private.external_subject_id() is null then raise exception using errcode='42501',message='Authentication required'; end if;
 if not app_private.has_agency_role(agency_id,array['owner','manager']) then raise exception using errcode='P0002',message='Not found'; end if;
 proposal_title:=app_private.trim_text(proposal_title);
 if proposal_title is null or char_length(proposal_title)>180 or not coalesce(app_private.valid_document(proposal_document),false) then raise exception using errcode='22023',message='Invalid proposal'; end if;
 return query insert into public.proposals(agency_id,created_by,title,document) values(agency_id,app_private.current_actor_id(),proposal_title,proposal_document) returning *;
end $$;
create function app_private.save_proposal_draft(proposal_id uuid,expected_revision integer,new_title text,new_document jsonb) returns setof public.proposals language plpgsql security definer set search_path='' as $$
declare target public.proposals;
begin
 if app_private.external_subject_id() is null then raise exception using errcode='42501',message='Authentication required'; end if;
 select * into target from public.proposals p where p.id=proposal_id and app_private.has_agency_role(p.agency_id,array['owner','manager']) for update;
 if target.id is null or not app_private.has_agency_role(target.agency_id,array['owner','manager']) then raise exception using errcode='P0002',message='Not found'; end if;
 if expected_revision is distinct from target.revision then raise exception using errcode='EC409',message='Draft revision conflict'; end if;
 new_title:=app_private.trim_text(new_title);
 if new_title is null or char_length(new_title)>180 or not coalesce(app_private.valid_document(new_document),false) then raise exception using errcode='22023',message='Invalid proposal'; end if;
 return query update public.proposals p set title=new_title,document=new_document,revision=p.revision+1,updated_at=clock_timestamp() where p.id=proposal_id returning p.*;
end $$;

create function public.create_agency(agency_name text) returns uuid language sql security invoker set search_path='' as $$ select app_private.create_agency(agency_name) $$;
create function public.create_proposal(agency_id uuid,proposal_title text,proposal_document jsonb) returns setof public.proposals language sql security invoker set search_path='' as $$ select * from app_private.create_proposal(agency_id,proposal_title,proposal_document) $$;
create function public.save_proposal_draft(proposal_id uuid,expected_revision integer,new_title text,new_document jsonb) returns setof public.proposals language sql security invoker set search_path='' as $$ select * from app_private.save_proposal_draft(proposal_id,expected_revision,new_title,new_document) $$;

revoke all on public.agencies,public.memberships,public.proposals from public,anon,authenticated;
grant select on public.agencies,public.memberships,public.proposals to authenticated;
revoke all on app_private.principals,app_private.auth_identities from public,anon,authenticated;
revoke execute on all functions in schema app_private from public,anon,authenticated;
grant execute on function app_private.external_subject_id(),app_private.current_actor_id(),app_private.has_agency_role(uuid,text[]) to authenticated;
grant execute on function app_private.create_agency(text),app_private.create_proposal(uuid,text,jsonb),app_private.save_proposal_draft(uuid,integer,text,jsonb) to authenticated;
revoke execute on function public.create_agency(text),public.create_proposal(uuid,text,jsonb),public.save_proposal_draft(uuid,integer,text,jsonb) from public,anon,authenticated;
grant execute on function public.create_agency(text),public.create_proposal(uuid,text,jsonb),public.save_proposal_draft(uuid,integer,text,jsonb) to authenticated;
