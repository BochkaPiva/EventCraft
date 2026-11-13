-- Creation retries use a caller-scoped key and never overwrite an existing draft.
create table app_private.proposal_creations (
 agency_id uuid not null references public.agencies(id),
 actor_id uuid not null references app_private.principals(id),
 creation_key uuid not null,
 proposal_id uuid not null,
 request_hash bytea not null,
 created_at timestamptz not null default now(),
 primary key(agency_id,actor_id,creation_key),
 foreign key(agency_id,proposal_id) references public.proposals(agency_id,id)
);
create index proposal_creations_actor_idx on app_private.proposal_creations(actor_id);
create index proposal_creations_proposal_idx on app_private.proposal_creations(agency_id,proposal_id);
alter table app_private.proposal_creations enable row level security;
revoke all on app_private.proposal_creations from public,anon,authenticated;

drop function public.create_proposal(uuid,text,jsonb);
drop function app_private.create_proposal(uuid,text,jsonb);

create function app_private.create_proposal(agency_id uuid,proposal_title text,proposal_document jsonb,creation_key uuid)
returns setof public.proposals language plpgsql security definer set search_path='' as $$
declare actor uuid:=app_private.current_actor_id(); previous app_private.proposal_creations; created public.proposals; fingerprint bytea;
begin
 if actor is null or not app_private.has_agency_role(agency_id,array['owner','manager']) then
  raise exception using errcode='P0002',message='Not found';
 end if;
 proposal_title:=app_private.trim_text(proposal_title);
 if creation_key is null or proposal_title is null or char_length(proposal_title)>180 or not coalesce(app_private.valid_document(proposal_document),false) then
  raise exception using errcode='22023',message='Invalid proposal';
 end if;
 fingerprint:=sha256(convert_to(jsonb_build_object('title',proposal_title,'document',proposal_document)::text,'UTF8'));
 perform pg_advisory_xact_lock(hashtextextended('eventcraft.proposal:'||agency_id::text||':'||actor::text||':'||creation_key::text,0));
 select r.* into previous from app_private.proposal_creations r
  where r.agency_id=create_proposal.agency_id and r.actor_id=actor and r.creation_key=create_proposal.creation_key;
 if previous.proposal_id is not null then
  if previous.request_hash<>fingerprint then raise exception using errcode='EC422',message='Creation key reused for different input'; end if;
  return query select p.* from public.proposals p where p.id=previous.proposal_id;
  return;
 end if;
 insert into public.proposals(agency_id,created_by,title,document)
  values(agency_id,actor,proposal_title,proposal_document) returning * into created;
 insert into app_private.proposal_creations(agency_id,actor_id,creation_key,proposal_id,request_hash)
  values(agency_id,actor,creation_key,created.id,fingerprint);
 return next created;
end $$;
create function public.create_proposal(agency_id uuid,proposal_title text,proposal_document jsonb,creation_key uuid)
returns setof public.proposals language sql security invoker set search_path='' as $$
 select * from app_private.create_proposal(agency_id,proposal_title,proposal_document,creation_key)
$$;
revoke execute on function app_private.create_proposal(uuid,text,jsonb,uuid),public.create_proposal(uuid,text,jsonb,uuid) from public,anon,authenticated;
grant execute on function app_private.create_proposal(uuid,text,jsonb,uuid),public.create_proposal(uuid,text,jsonb,uuid) to authenticated;
