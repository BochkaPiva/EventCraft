-- M1: a simple ordered program joins text and estimate blocks.
-- Existing document format, checked writes and access policies stay in place.
create or replace function app_private.valid_document(d jsonb) returns boolean language plpgsql immutable security invoker set search_path='' as $$
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
  elsif b->>'type'='program' then
   if not coalesce(jsonb_typeof(b->'items')='array' and b-array['id','type','heading','items','visible']='{}'::jsonb,false) then return false; end if;
   if jsonb_array_length(b->'items')>200 then return false; end if;
   line_ids:='{}';
   for l in select value from jsonb_array_elements(b->'items') loop
    if not coalesce(jsonb_typeof(l)='object' and l?&array['id','time','title','description'] and jsonb_typeof(l->'title')='string' and char_length(l->>'title')<=200 and jsonb_typeof(l->'description')='string' and char_length(l->>'description')<=2000 and l-array['id','time','title','description']='{}'::jsonb,false) then return false; end if;
    if not coalesce(lower(l->>'id')~'^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',false) or lower(l->>'id')=any(line_ids) then return false; end if;
    line_ids:=array_append(line_ids,lower(l->>'id'));
    if not coalesce(l->'time'='null'::jsonb or (jsonb_typeof(l->'time')='string' and l->>'time'~'^([01][0-9]|2[0-3]):[0-5][0-9]$'),false) then return false; end if;
   end loop;
  else return false;
  end if;
 end loop;
 return true;
end $$;

revoke execute on function app_private.valid_document(jsonb) from public, anon, authenticated;

