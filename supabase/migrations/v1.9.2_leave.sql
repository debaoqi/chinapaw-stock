begin;
create or replace function jxc_flow_ok(p_me jxc_users,p_k text,p_d jsonb,p_has boolean,p_od jsonb) returns boolean
language plpgsql stable as $$
declare r text:=p_me.role; ns text:=p_d->>'status'; os text:=p_od->>'status'; total numeric; paid numeric; c jsonb;
begin
 p_d:=p_d-'paidVerified';p_od:=p_od-'paidVerified';
 if p_k='exp' and (p_d->>'amt')::numeric::text in ('NaN','Infinity','-Infinity') then return false;end if;
 if p_k='fin' and (p_d->>'amount')::numeric::text in ('NaN','Infinity','-Infinity') then return false;end if;
 if p_k='products' and r in ('ops','acct') then return p_has and (p_d-array['prices','minPrice','u','_q'])=(p_od-array['prices','minPrice','u','_q']); end if;
 if p_k='read' then
  select d into c from jxc_docs where k='chat' and id=p_d->>'ch';
  return p_d->>'userId'=p_me.id and (not p_has or p_od->>'userId'=p_me.id)
   and ((p_d->>'ch'='C_all') or (c is not null and (c->'mem'='null'::jsonb or c->'mem' is null or c->'mem' ? p_me.id)));
 end if;
 if p_k='leave' then
  if not p_has then return p_d->>'by'=p_me.id and ns='submitted' and (p_d->>'days')::numeric>=0.5
   and (p_d->>'days')::numeric*2=trunc((p_d->>'days')::numeric*2) and (p_d->>'endDate')::date-(p_d->>'startDate')::date+1=ceil((p_d->>'days')::numeric) and coalesce(p_d->>'session','am') in ('am','pm') and length(coalesce(p_d->>'reason',''))>=2; end if;
  if (p_d-array['status','approval','reject','u','_q']) is distinct from (p_od-array['status','approval','reject','u','_q']) then return false; end if;
  return os='submitted' and ns in ('approved','rejected') and p_od->>'by'<>p_me.id
    and (r='chair' or ((p_od->>'days')::numeric<=2 and r='ops' and not exists(select 1 from jxc_users where id=p_od->>'by' and role='ops')) or (r='gm' and ((p_od->>'days')::numeric>2 or exists(select 1 from jxc_users where id=p_od->>'by' and role='ops'))));
 end if;
 if p_k='receipt' then
  select d into c from jxc_docs where k='so' and id=p_d->>'so';
  return not p_has and r in ('chair','gm','sales','field','keeper') and c->>'status' in ('shipped','done')
   and (r in ('chair','gm','keeper') or c->>'by'=p_me.id) and nullif(p_d->>'photo','') is not null
   and p_d->>'signature' like 'data:image/png;base64,%' and length(p_d->>'signature')>200 and nullif(trim(p_d->>'customerName'),'') is not null;
 end if;
 if p_k in ('stockreq','transfer','adjust') then
  if not p_has then return ns='pending' and p_d->>'by'=p_me.id and jsonb_array_length(p_d->'items')>0 and not exists(select 1 from jsonb_array_elements(p_d->'items') i where (i->>'qty')::numeric<=0 or (i->>'qty')::numeric::text in ('NaN','Infinity','-Infinity') or nullif(i->>'pid','') is null); end if;
  if (p_d-array['status','approval','receivedBy','u','_q']) is distinct from (p_od-array['status','approval','receivedBy','u','_q']) then return false; end if;
  if ns='rejected' then return os='pending' and r in ('chair','ops'); end if;
  if os='pending' and ns='approved' then return r in ('chair','ops') and p_od->>'by'<>p_me.id; end if;
  if p_k='transfer' then return r in ('chair','keeper') and ((os='approved' and ns='transit') or (os='transit' and ns='done')); end if;
  return r in ('chair','keeper') and os='approved' and ns='done';
 end if;
 if p_k='opening_balance' then
  if not p_has then return r in ('chair','acct') and ns='pending' and p_d->>'by'=p_me.id and (p_d->>'amount')::numeric>0 and p_d->>'kind' in ('ar','ap','cash'); end if;
  if (p_d-array['status','approval','u','_q'])<>(p_od-array['status','approval','u','_q']) then return false; end if;
  return (os='pending' and ns='approved' and r in ('chair','ops') and p_od->>'by'<>p_me.id) or (os='approved' and ns='posted' and r in ('chair','acct'));
 end if;
 if p_k='account' then return r in ('chair','acct') and (not p_has or p_od->>'kind'=p_d->>'kind'); end if;
 if p_k='period' then return r in ('chair','acct') and ns='closed' and (not p_has); end if;
 if p_k='reconcile' then return r in ('chair','acct','cashier') and not p_has; end if;
 if p_k='quote' then
  if p_d->>'type'='discount' then
   if not p_has then return r in ('sales','field','chair','gm') and ns='pending' and p_d->>'by'=p_me.id; end if;
   return r in ('chair','gm','ops') and p_od->>'by'<>p_me.id and os='pending' and ns in ('approved','rejected') and (p_d-array['status','approval','u','_q'])=(p_od-array['status','approval','u','_q']);
  end if;
  return r in ('chair','gm','sales','field') and (not p_has or p_od->>'by'=p_me.id or r in ('chair','gm'));
 end if;
 if p_k='serial' then return r in ('chair','keeper') and not p_has; end if;
 -- Chairman can perform every operating role, but still follows each state transition.
 if r='chair' then
  if p_k='grn' then p_me.role:=case when not p_has then 'buyer' when os='submitted' then 'acct' when os='fin_ok' then 'clerk' else 'keeper' end;
  elsif p_k='exp' then p_me.role:=case os when 'submitted' then 'ops' when 'gm_pending' then 'gm' when 'approved' then 'acct' when 'booked' then 'cashier' else 'sales' end;
  elsif p_k='fin' and p_d->>'type'='pay' then p_me.role:=case when not p_has then 'acct' when os='req' then 'ops' when os='gm_pending' then 'gm' when os='approved' then 'cashier' else 'acct' end;
  elsif p_k='moves' then p_me.role:='keeper'; end if;
 end if;
 if p_k='so' and p_has then
  if (p_d-array['status','fin','gmok','rj','rjBy','items','st','u','_q']) is distinct from (p_od-array['status','fin','gmok','rj','rjBy','items','st','u','_q']) then
   if os not in ('draft','rejected') then return false; end if;
  end if;
  if os not in ('draft','rejected') and (select jsonb_agg(i-array['shipped','ret']) from jsonb_array_elements(p_d->'items') i)
      is distinct from (select jsonb_agg(i-array['shipped','ret']) from jsonb_array_elements(p_od->'items') i) then return false; end if;
  if r in ('sales','field') and p_od->>'by'<>p_me.id then return false; end if;
  if ns='approved' and coalesce(p_od->>'pay','cash')<>'credit' then
   select coalesce(sum((i->>'qty')::numeric*(i->>'price')::numeric),0) into total from jsonb_array_elements(p_od->'items') i;
   if p_od->'frt'->>'payer'='cus' then total:=total+coalesce((p_od->'frt'->>'amt')::numeric,0); end if;
   select coalesce(sum((d->>'amount')::numeric),0) into paid from jxc_docs where k='fin' and d->>'ref'=p_d->>'id' and d->>'type'='rcv' and d->>'status'='verified';
   if paid+0.005<total then return false; end if;
  end if;
  -- Return counters are computed by the warehouse together with an approved return.
  if r in ('chair','keeper') and os='approved' and ns='approved' then return (p_d-array['items','st','u','_q'])=(p_od-array['items','st','u','_q']); end if;
  if r in ('chair','keeper') and os in ('shipped','done') and ns=os then
   return (p_d-array['items','u','_q'])=(p_od-array['items','u','_q']);
  end if;
 end if;
 if p_k='grn' and p_has and r in ('chair','keeper') and os='done' and ns='done' then
  return (p_d-array['items','u','_q'])=(p_od-array['items','u','_q'])
   and (select jsonb_agg(i-'ret') from jsonb_array_elements(p_d->'items') i)=(select jsonb_agg(i-'ret') from jsonb_array_elements(p_od->'items') i);
 end if;
 return jxc_flow_ok_v180(p_me,p_k,p_d,p_has,p_od);
end $$;
create or replace function jxc_queue_operational_push() returns trigger
language plpgsql security definer set search_path=public,extensions as $$
declare roles text[]:=array[]::text[];targets text[];st text:=new.d->>'status';applicant text;
begin
 if tg_op='UPDATE' and st is not distinct from old.d->>'status' then return new;end if;
 if new.k='leave' then
  if st='submitted' then roles:=case when (new.d->>'days')::numeric<=2 and not exists(select 1 from jxc_users where id=new.d->>'by' and role='ops') then array['ops'] else array['gm'] end;
  else applicant:=new.d->>'by';end if;
 elsif new.k in ('stockreq','transfer') then
  roles:=case st when 'pending' then array['ops'] when 'approved' then array['keeper'] when 'transit' then array['keeper'] else array[]::text[] end;
  if st in ('done','rejected') then applicant:=new.d->>'by';end if;
 elsif new.k='receipt' then
  select d->>'by' into applicant from public.jxc_docs where k='so' and id=new.d->>'so';
 end if;
 select array_agg(id) into targets from public.jxc_users where active and id is distinct from new.by_user and (role=any(roles) or id=applicant);
 if coalesce(array_length(targets,1),0)>0 then
  insert into public.jxc_push_events(event_key,recipients,body) values(new.k||':'||new.id||':'||new.seq,targets,'您有新的审批或业务状态提醒，请打开华宝进销存查看') on conflict(event_key) do nothing;
 end if;
 return new;
end $$;
commit;
select 'leave_sync_ready' status;
