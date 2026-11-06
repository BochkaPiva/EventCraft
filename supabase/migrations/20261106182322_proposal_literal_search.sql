-- Literal text search: PostgREST wildcard aliases never alter user-entered text.
create function public.search_proposals(agency_id uuid,search_query text)
returns setof public.proposals language plpgsql stable security invoker set search_path='' as $$
begin
 if search_query is null or char_length(search_query)>180 then
  raise exception using errcode='22023',message='Invalid search';
 end if;
 return query select p.* from public.proposals p
  where p.agency_id=search_proposals.agency_id
  and strpos(lower(p.title),lower(search_query))>0;
end $$;
revoke execute on function public.search_proposals(uuid,text) from public,anon,authenticated;
grant execute on function public.search_proposals(uuid,text) to authenticated;
