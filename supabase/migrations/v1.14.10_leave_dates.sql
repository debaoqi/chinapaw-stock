begin;
do $$ begin
 if to_regprocedure('jxc_flow_ok_v1149_base(jxc_users,text,jsonb,boolean,jsonb)') is null then
  alter function jxc_flow_ok(jxc_users,text,jsonb,boolean,jsonb) rename to jxc_flow_ok_v1149_base;
 end if;
end $$;
create or replace function jxc_flow_ok(p_me jxc_users,p_k text,p_d jsonb,p_has boolean,p_od jsonb) returns boolean language plpgsql stable as $$
declare applicant_role text;days numeric;span integer;
begin
 if p_k<>'leave' then return jxc_flow_ok_v1149_base(p_me,p_k,p_d,p_has,p_od);end if;
 if not p_has then
  if p_me.role='chair' or p_d->>'by' is distinct from p_me.id or p_d->>'status' is distinct from 'submitted' then return false;end if;
  days:=(p_d->>'days')::numeric;span:=(p_d->>'endDate')::date-(p_d->>'startDate')::date+1;
  return coalesce(days>=1 and days=trunc(days) and days=span and span>0 and not (p_d ? 'session'),false);
 end if;
 if (p_d-array['status','approval','reject','u','_q']) is distinct from (p_od-array['status','approval','reject','u','_q']) then return false;end if;
 if p_od->>'status' is distinct from 'submitted' or coalesce(p_d->>'status' not in ('approved','rejected'),true) or p_od->>'by'=p_me.id then return false;end if;
 if p_d->'approval'->>'by' is distinct from p_me.id or (p_d->>'status'='rejected' and length(trim(coalesce(p_d->>'reject','')))<2) then return false;end if;
 select role into applicant_role from jxc_users where id=p_od->>'by';
 if applicant_role='gm' then return p_me.role='chair';end if;
 if p_me.role='chair' then return true;end if;
 if applicant_role='ops' then return p_me.role='gm';end if;
 return coalesce(case when (p_od->>'days')::numeric<=2 then p_me.role='ops' else p_me.role='gm' end,false);
exception when invalid_text_representation or datetime_field_overflow then return false;
end $$;
create or replace function jxc_queue_operational_push() returns trigger
language plpgsql security definer set search_path=public,extensions as $$
declare roles text[]:=array[]::text[];targets text[];st text:=new.d->>'status';applicant text;
begin
 if tg_op='UPDATE' and st is not distinct from old.d->>'status' then return new;end if;
 if new.k='leave' then
  if st='submitted' then roles:=case when exists(select 1 from jxc_users where id=new.d->>'by' and role='gm') then array['chair'] when (new.d->>'days')::numeric<=2 and not exists(select 1 from jxc_users where id=new.d->>'by' and role='ops') then array['ops'] else array['gm'] end;
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
select 'leave_dates_ready' status;
