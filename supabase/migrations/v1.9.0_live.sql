-- Additive upgrade. No production passwords are embedded or reset by this migration.
begin;
create schema if not exists jxc_backup_20261125_v190;
create table if not exists jxc_backup_20261125_v190.docs as table jxc_docs;
create table if not exists jxc_backup_20261125_v190.users as table jxc_users;
alter table jxc_backup_20261125_v190.docs enable row level security;
alter table jxc_backup_20261125_v190.users enable row level security;
revoke all on schema jxc_backup_20261125_v190 from public,anon,authenticated;

do $$ begin
 if to_regprocedure('jxc_flow_ok_v180(jxc_users,text,jsonb,boolean,jsonb)') is null then
  alter function jxc_flow_ok(jxc_users,text,jsonb,boolean,jsonb) rename to jxc_flow_ok_v180;
  alter function jxc_can_write(text,text,jsonb) rename to jxc_can_write_v180;
 end if;
end $$;

create or replace function jxc_can_write(p_role text,p_k text,p_d jsonb) returns boolean
language sql immutable as $$ select case
 when p_k in ('account','reconcile','period','opening_balance') then false
 when p_k in ('read','leave','receipt') then true
 when p_k='partners' and p_role='acct' then true
 when p_k='products' and p_role in ('ops','acct') then true
 when p_k in ('stockreq','transfer','serial','quote','adjust','opening_balance') then p_role in ('chair','gm','ops','acct','keeper','buyer','sales','field')
 when p_k in ('account','reconcile','period') then p_role in ('chair','acct','cashier','gm')
 when p_k='moves' and p_d->>'type' in ('tr_out','tr_in') then p_role in ('chair','keeper')
 else jxc_can_write_v180(p_role,p_k,p_d) end $$;

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
   and (p_d->>'days')::numeric*2=trunc((p_d->>'days')::numeric*2) and (p_d->>'endDate')::date>=(p_d->>'startDate')::date; end if;
  if (p_d-array['status','approval','reject','u','_q']) is distinct from (p_od-array['status','approval','reject','u','_q']) then return false; end if;
  return os='submitted' and ns in ('approved','rejected') and p_od->>'by'<>p_me.id
    and (r='chair' or ((p_od->>'days')::numeric<=2 and r='ops') or ((p_od->>'days')::numeric>2 and r='gm'));
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

create or replace function jxc_push(p_token text, p_ops jsonb) returns jsonb
language plpgsql security definer set search_path=public, extensions as $$
declare v_me jxc_users; op jsonb; v_k text; v_id text; v_d jsonb; v_u bigint; n_ok int:=0; rej jsonb:='[]'::jsonb; v_old bigint; v_has boolean; v_plan jsonb; v_ost text; v_od jsonb;
begin
  v_me := jxc_me_row(p_token);
  -- Serialize business commits so simultaneous warehouse confirmations cannot post stock twice.
  perform pg_advisory_xact_lock(hashtext('jxc_push_business'));
  for op in select * from jsonb_array_elements(p_ops) loop
    v_k := op->>'k'; v_id := op->>'id'; v_d := (op->'d')-'paidVerified'; v_u := coalesce((v_d->>'u')::bigint,0);
    if v_k is null or v_id is null or v_d is null or not (jxc_can_write(v_me.role,v_k,v_d) or (coalesce(v_me.is_admin,false) and v_k in ('products','partners','wh','settings'))) then
      rej := rej || jsonb_build_array(v_id); continue;
    end if;
    if v_k='settings' and v_id<>'app' then rej := rej || jsonb_build_array(v_id); continue; end if;
    if v_k='settings' then   -- VIP 与门店数量只能由平台修改：公司提交的设置保留云端已有的 plan
      v_plan := null;
      select t.d->'plan' into v_plan from jxc_docs t where t.k='settings' and t.id=v_id;
      v_d := (v_d - 'plan') || jsonb_build_object('plan',coalesce(v_plan,'{"limit":1}'::jsonb));
    end if;
    v_has := null;
    v_od := null;
    select true, t.u, t.d->>'status', t.d into v_has, v_old, v_ost, v_od from jxc_docs t where t.k=v_k and t.id=v_id;
    if not coalesce(v_has,false) and v_k in ('msg','exp','att','leave','stockreq','transfer','receipt','opening_balance','quote') then v_d := jsonb_set(v_d,'{by}',to_jsonb(v_me.id)); end if;   -- 发送人 / 申请人以登录账号为准
    -- Retry after a lost HTTP response must not repeat postings or fail an already committed operation.
    if coalesce(v_has,false) and (v_od-array['u','_q','postedAt'])=(v_d-array['u','_q','postedAt']) then n_ok:=n_ok+1;continue;end if;
    if coalesce(v_has,false) and v_k='moves' then
      if (v_od-array['u','_q','uc','costFixed','costStatus','costAmount','postedAt','revenue'])=(v_d-array['u','_q','uc','costFixed','costStatus','costAmount','postedAt','revenue']) then n_ok:=n_ok+1;continue;end if;
      raise exception 'Stock ledger is immutable';
    end if;
    if not coalesce(jxc_flow_ok(v_me,v_k,v_d,coalesce(v_has,false),v_od),false) then rej := rej || jsonb_build_array(v_id); continue; end if;
    if coalesce(v_has,false) then
      if v_k='moves' then n_ok:=n_ok+1; continue; end if;            -- 库存流水只增不改
      if v_old > v_u then raise exception 'Version conflict; sync and retry'; end if;           -- 保留较新的
      update jxc_docs t set d=v_d, u=v_u, by_user=v_me.id, seq=nextval('jxc_seq'), updated_at=now() where t.k=v_k and t.id=v_id;
    else
      insert into jxc_docs(k,id,d,u,by_user) values(v_k,v_id,v_d,v_u,v_me.id);
    end if;
    insert into jxc_audit(user_id,action,k,doc_id,detail) values(v_me.id,'put',v_k,v_id,jsonb_build_object('status',v_d->>'status','no',v_d->>'no'));
    n_ok := n_ok+1;
  end loop;
  if jsonb_array_length(rej)>0 then raise exception '审批状态已变化或没有权限，请同步后重试 / Approval changed or permission denied: %',rej; end if;
  return jsonb_build_object('ok',n_ok,'rejected',rej);
end $$;


-- Server guard applies even if a modified client bypasses every browser check.
create or replace function jxc_guard_stock() returns trigger language plpgsql as $$
declare m jsonb:=new.d; src jsonb; it jsonb; q numeric; allowed numeric; done numeric; avail numeric; v numeric; cq numeric; cv numeric; cost numeric; typ text; batch text; pid text; wh text; orig_ref text; orig_type text; unknown_cost boolean:=false;
begin
 if new.k<>'moves' then return new; end if;
 if tg_op='UPDATE' then raise exception 'Stock ledger is immutable'; end if;
 perform pg_advisory_xact_lock(hashtext('jxc_push_business'));
 q:=(m->>'qty')::numeric;typ:=m->>'type';pid:=m->>'pid';wh:=m->>'wh';batch:=coalesce(m->>'batch','');
 if q=0 or q::text in ('NaN','Infinity','-Infinity') or pid is null or wh is null then raise exception 'Invalid stock movement'; end if;
 if exists(select 1 from jxc_docs where k='period' and d->>'status'='closed' and d->>'month'=to_char(to_timestamp(coalesce((m->>'t')::bigint,0)/1000.0),'YYYY-MM')) then raise exception 'Accounting period is closed'; end if;
 if typ='so_out' then
  select d into src from jxc_docs where k='so' and id=m->>'ref';
  if src->>'status'<>'approved' or src->>'wh'<>wh or q>=0 then raise exception 'Sales order is not released for this warehouse'; end if;
 elsif typ='po_in' then
  select d into src from jxc_docs where k='grn' and id=m->>'ref';
  if src->>'status'<>'ready' or src->>'wh'<>wh or q<=0 then raise exception 'Receipt is not approved'; end if;
 elsif typ in ('so_ret','po_ret') then
  select d into src from jxc_docs where k=case typ when 'so_ret' then 'sr' else 'pr' end and id=m->>'ref';
  if src->>'status'<>'pending' or src->>'wh'<>wh or (typ='so_ret' and q<=0) or (typ='po_ret' and q>=0) then raise exception 'Return is not released'; end if;
  orig_ref:=case typ when 'so_ret' then src->>'so' else src->>'grn' end;
  orig_type:=case typ when 'so_ret' then 'so_out' else 'po_in' end;
  select coalesce(sum(abs((d->>'qty')::numeric)),0) into v from jxc_docs where k='moves' and d->>'ref'=orig_ref and d->>'type'=orig_type and d->>'pid'=pid and coalesce(d->>'batch','')=batch;
  select coalesce(sum(abs((m1.d->>'qty')::numeric)),0) into done from jxc_docs m1 join jxc_docs r on r.k=case typ when 'so_ret' then 'sr' else 'pr' end and r.id=m1.d->>'ref'
   where m1.k='moves' and m1.d->>'type'=typ and m1.d->>'pid'=pid and coalesce(m1.d->>'batch','')=batch and coalesce(r.d->>'so',r.d->>'grn')=orig_ref;
  if done+abs(q)>v+0.000001 then raise exception 'Return exceeds original batch quantity'; end if;
 elsif typ in ('tr_out','tr_in') then
  select d into src from jxc_docs where k='transfer' and id=m->>'ref';
  if (typ='tr_out' and (src->>'status'<>'approved' or src->>'fromWh'<>wh or q>=0)) or (typ='tr_in' and (src->>'status'<>'transit' or src->>'toWh'<>wh or q<=0)) then raise exception 'Invalid transfer step or warehouse'; end if;
 elsif typ='init' then
  select d into src from jxc_docs where k='stockreq' and id=m->>'ref';
  if src->>'status'<>'approved' or src->>'wh'<>wh or q<=0 then raise exception 'Opening inventory requires approval'; end if;
 elsif typ='adj' then
  select d into src from jxc_docs where k='counts' and id=m->>'ref';
  if src->>'status'<>'fin_ok' or src->>'wh'<>wh then raise exception 'Count is not approved'; end if;
 else raise exception 'Unsupported stock movement type'; end if;
 if src is null then raise exception 'Source document not found'; end if;
 if typ='adj' then
  select sum((x->>'real')::numeric-(x->>'sys')::numeric) into allowed from jsonb_array_elements(src->'items') x where x->>'pid'=pid;
  if sign(q)<>sign(allowed) then raise exception 'Count direction mismatch'; end if;
 else
  select sum((x->>'qty')::numeric) into allowed from jsonb_array_elements(src->'items') x where x->>'pid'=pid and (typ<>'po_in' or coalesce(x->>'batch',src->>'batch','')=batch);
 end if;
 select coalesce(sum(abs((d->>'qty')::numeric)),0) into done from jxc_docs where k='moves' and d->>'type'=typ and d->>'ref'=m->>'ref' and d->>'pid'=pid and (typ<>'po_in' or coalesce(d->>'batch','')=batch);
 if allowed is null or done+abs(q)>abs(allowed)+0.000001 then raise exception 'Quantity exceeds approved document'; end if;
 unknown_cost:=exists(select 1 from jxc_docs where k='moves' and d->>'pid'=pid and d->>'wh'=wh and d->>'uc' is null);
 select coalesce(sum((d->>'qty')::numeric),0),coalesce(sum((d->>'qty')::numeric*coalesce((d->>'uc')::numeric,0)),0) into cq,cv from jxc_docs where k='moves' and d->>'pid'=pid and d->>'wh'=wh;
 select coalesce(sum((d->>'qty')::numeric),0) into avail from jxc_docs where k='moves' and d->>'pid'=pid and d->>'wh'=wh and coalesce(d->>'batch','')=batch;
 if q<0 and avail+q< -0.000001 then raise exception 'Insufficient stock in this batch'; end if;
 cost:=case when cq>0 then cv/cq else 0 end;
 if typ='tr_in' then
  select sum(abs((d->>'qty')::numeric)*(d->>'uc')::numeric)/nullif(sum(abs((d->>'qty')::numeric)),0) into cost from jxc_docs where k='moves' and d->>'ref'=m->>'ref' and d->>'type'='tr_out' and d->>'pid'=pid and coalesce(d->>'batch','')=batch;
  if not exists(select 1 from jxc_docs where k='moves' and d->>'ref'=m->>'ref' and d->>'type'='tr_out' and d->>'pid'=pid and coalesce(d->>'batch','')=batch) then raise exception 'Transfer dispatch not found'; end if;unknown_cost:=cost is null;
 elsif typ in ('so_ret','po_ret') then
  select sum(abs((d->>'qty')::numeric)*coalesce((d->>'uc')::numeric,0))/nullif(sum(abs((d->>'qty')::numeric)),0) into cost from jxc_docs where k='moves' and d->>'ref'=orig_ref and d->>'type'=orig_type and d->>'pid'=pid and coalesce(d->>'batch','')=batch;
 elsif typ='po_in' then
  unknown_cost:=false;
  select x into it from jxc_docs p cross join lateral jsonb_array_elements(p.d->'items') x where p.k='po' and p.id=src->>'po' and x->>'pid'=pid limit 1;
  select coalesce(sum((x->>'qty')::numeric*(x->>'price')::numeric),0) into v from jxc_docs p cross join lateral jsonb_array_elements(p.d->'items') x where p.k='po' and p.id=src->>'po';
  cost:=coalesce((it->>'price')::numeric,0)*(1+coalesce((select sum((f->>'amt')::numeric) from jxc_docs p cross join lateral jsonb_array_elements(p.d->'fees') f where p.k='po' and p.id=src->>'po'),0)/nullif(v,0));
 elsif typ='init' then
  unknown_cost:=false;
  select coalesce((x->>'uc')::numeric,0) into cost from jsonb_array_elements(src->'items') x where x->>'pid'=pid limit 1;
 end if;
 if unknown_cost then cost:=null;end if;
 if not unknown_cost and (cost is null or cost<0 or cost::text in ('NaN','Infinity','-Infinity') ) then raise exception 'Invalid inventory cost'; end if;
 new.d:=m||jsonb_build_object('uc',round(cost,8),'costFixed',not unknown_cost,'costStatus',case when unknown_cost then 'pending' else 'posted' end,'costAmount',round(abs(q)*cost,2),'postedAt',floor(extract(epoch from now())*1000)::bigint);
 if not unknown_cost and typ='so_out' and (select d->>'costMethod' from jxc_docs where k='settings' and id='app')='fifo' then
  cost:=jxc_fifo_cost(pid,wh,abs(q));new.d:=new.d||jsonb_build_object('uc',round(cost,8),'costAmount',round(abs(q)*cost,2));
 end if;
 if typ='so_out' then
  select x into it from jsonb_array_elements(src->'items') x where x->>'pid'=pid limit 1;
  new.d:=new.d||jsonb_build_object('revenue',round(abs(q)*(it->>'price')::numeric,2));
 elsif typ='so_ret' then
  select x into it from jxc_docs s cross join lateral jsonb_array_elements(s.d->'items') x where s.k='so' and s.id=orig_ref and x->>'pid'=pid limit 1;
  new.d:=new.d||jsonb_build_object('revenue',round(abs(q)*(it->>'price')::numeric,2));
 end if;
 return new;
end $$;
drop trigger if exists jxc_stock_guard on jxc_docs;
create trigger jxc_stock_guard before insert or update on jxc_docs for each row when (new.k='moves') execute function jxc_guard_stock();

update jxc_docs set d=d||'{"workStart":8.5,"workEnd":17,"base":"GHS"}'::jsonb,seq=nextval('jxc_seq') where k='settings' and id='app';
commit;

begin;
create or replace function jxc_document_totals() returns trigger language plpgsql as $$
declare i jsonb; shipped numeric; returned numeric; src jsonb; typ text;
begin
 if new.k='so' and new.d->>'status' in ('approved','shipped','done') then
  for i in select * from jsonb_array_elements(new.d->'items') loop
   select coalesce(sum(-(d->>'qty')::numeric),0) into shipped from jxc_docs where k='moves' and d->>'type'='so_out' and d->>'ref'=new.id and d->>'pid'=i->>'pid';
   if coalesce((i->>'shipped')::numeric,0)<>shipped then raise exception 'Shipped counter must equal server ledger'; end if;
   if new.d->>'status' in ('shipped','done') and shipped<>(i->>'qty')::numeric then raise exception 'Order has unshipped quantities'; end if;
   select coalesce(sum((m.d->>'qty')::numeric),0) into returned from jxc_docs m join jxc_docs r on r.k='sr' and r.id=m.d->>'ref' where m.k='moves' and m.d->>'type'='so_ret' and m.d->>'pid'=i->>'pid' and r.d->>'so'=new.id;
   if coalesce((i->>'ret')::numeric,0)<>returned then raise exception 'Return counter must equal server ledger'; end if;
  end loop;
  if tg_op='UPDATE' and old.d->>'status'='shipped' and new.d->>'status'='done' and not exists(select 1 from jxc_docs where k='receipt' and d->>'so'=new.id) then raise exception 'Photo and customer signature required before completion'; end if;
 elsif new.k='grn' and new.d->>'status'='done' then
  for i in select * from jsonb_array_elements(new.d->'items') loop
   select coalesce(sum((d->>'qty')::numeric),0) into shipped from jxc_docs where k='moves' and d->>'type'='po_in' and d->>'ref'=new.id and d->>'pid'=i->>'pid' and coalesce(d->>'batch','')=coalesce(i->>'batch',new.d->>'batch','');
   if shipped<>(i->>'qty')::numeric then raise exception 'Receipt quantities must equal stock postings'; end if;
   select coalesce(sum(-(m.d->>'qty')::numeric),0) into returned from jxc_docs m join jxc_docs r on r.k='pr' and r.id=m.d->>'ref' where m.k='moves' and m.d->>'type'='po_ret' and m.d->>'pid'=i->>'pid' and r.d->>'grn'=new.id;
   if coalesce((i->>'ret')::numeric,0)<>returned then raise exception 'Purchase return counter mismatch'; end if;
  end loop;
 end if;
 return new;
end $$;
drop trigger if exists jxc_document_totals_trigger on jxc_docs;
create trigger jxc_document_totals_trigger before insert or update on jxc_docs for each row when (new.k in ('so','grn')) execute function jxc_document_totals();
create or replace function jxc_master_guard() returns trigger language plpgsql as $$
declare r text; olddoc jsonb:='{}';
begin
 select role into r from jxc_users where id=new.by_user;
 if tg_op='UPDATE' then olddoc:=old.d; end if;
 if new.k='partners' and (new.d->'creditLimit' is distinct from olddoc->'creditLimit' or new.d->'paymentDays' is distinct from olddoc->'paymentDays') and r not in ('chair','gm','acct') then raise exception 'Only management or accounting can change credit terms'; end if;
 if new.k='products' and (new.d->'prices' is distinct from olddoc->'prices' or new.d->'minPrice' is distinct from olddoc->'minPrice') and r not in ('chair','gm','ops','acct') then raise exception 'Price-list authorization required'; end if;
 if new.k='settings' and new.d->'costMethod' is distinct from olddoc->'costMethod' and exists(select 1 from jxc_docs where k='moves' and (d->>'costFixed')::boolean) then raise exception 'Cost method is locked after new ledger posting; use a controlled conversion'; end if;
 return new;
end $$;
drop trigger if exists jxc_master_guard_trigger on jxc_docs;
create trigger jxc_master_guard_trigger before insert or update on jxc_docs for each row when (new.k in ('partners','products','settings')) execute function jxc_master_guard();

create or replace function jxc_doc_visible(me jxc_users,k text,pdoc jsonb) returns boolean language plpgsql stable as $$
begin
 if k in ('msg','chat') then return pdoc->'mem' is null or pdoc->'mem'='null'::jsonb or pdoc->'mem' ? me.id; end if;
 if me.role='chair' then return true; end if;
 if k='read' then return exists(select 1 from jxc_docs c where c.k='chat' and c.id=pdoc->>'ch' and (c.d->'mem' is null or c.d->'mem'='null'::jsonb or c.d->'mem' ? me.id)) or pdoc->>'ch'='C_all'; end if;
 if k in ('att','leave') then return pdoc->>'by'=me.id or me.role in ('gm','ops') or (me.role='sales' and exists(select 1 from jxc_users u where u.id=pdoc->>'by' and u.role in ('sales','field'))); end if;
 if k='exp' then return pdoc->>'by'=me.id or me.role in ('gm','ops','acct','cashier'); end if;
 if k='stockreq' then return me.role in ('gm','ops','acct','buyer','keeper','clerk') or pdoc->>'by'=me.id; end if;
 if k in ('fin','account','reconcile','period','opening_balance') then return me.role in ('gm','ops','acct','cashier'); end if;
 if k in ('po','grn','pr') then return me.role in ('gm','ops','acct','cashier','buyer','clerk','keeper') and (me.wh is null or me.wh='' or pdoc->>'wh'=me.wh or me.role in ('gm','ops','acct','cashier')); end if;
 if k in ('so','sr','receipt','quote') then return me.role in ('gm','ops','acct','cashier','keeper','clerk') or (me.role in ('sales','field') and pdoc->>'by'=me.id); end if;
 return true;
end $$;

create or replace function jxc_pull(p_token text,p_since bigint) returns jsonb
language plpgsql security definer set search_path=public,extensions as $$
declare me jxc_users; rows jsonb; maxseq bigint;
begin
 me:=jxc_me_row(p_token);
 select coalesce(jsonb_agg(jsonb_build_object('k',x.k,'d',case
  when x.k='so' then x.d||jsonb_build_object('paidVerified',coalesce((select sum((f.d->>'amount')::numeric) from jxc_docs f where f.k='fin' and f.d->>'ref'=x.d->>'id' and f.d->>'type'='rcv' and f.d->>'status'='verified'),0))
  when me.role in ('sales','field','keeper','clerk','cashier') and x.k='products' then x.d-array['cost']
  when me.role in ('sales','field','keeper','clerk','cashier') and x.k='moves' then x.d-array['uc','costAmount','revenue']
  else x.d end) order by x.seq) filter(where jxc_doc_visible(me,x.k,x.d)),'[]'),coalesce(max(x.seq),p_since)
 into rows,maxseq from (select k,d,seq from jxc_docs where seq>p_since order by seq limit 2000) x;
 return jsonb_build_object('seq',maxseq,'rows',rows,'users',(select coalesce(jsonb_agg(jxc_user_json(u)),'[]') from jxc_users u));
end $$;
-- Credit and price constraints are checked when orders enter approval, not only by the editor.
create or replace function jxc_sales_policy() returns trigger language plpgsql as $$
declare customer jsonb; product jsonb; item jsonb; exposure numeric:=0; amount numeric:=0; limit_amt numeric; floor_price numeric; req jsonb;
begin
 if new.k<>'so' or new.d->>'status' not in ('submitted','credit_gm','approved') then return new; end if;
 if tg_op='UPDATE' and new.d->>'status'=old.d->>'status' then return new; end if;
 select d into customer from jxc_docs where k='partners' and id=new.d->>'cus';
 for item in select * from jsonb_array_elements(new.d->'items') loop
  if (item->>'qty')::numeric<=0 or (item->>'price')::numeric<0 or (item->>'qty')::numeric::text in ('NaN','Infinity','-Infinity') or (item->>'price')::numeric::text in ('NaN','Infinity','-Infinity') then raise exception 'Invalid sales quantity or price'; end if;
  select d into product from jxc_docs where k='products' and id=item->>'pid';
  if product is null then raise exception 'Product not found'; end if;
  floor_price:=coalesce((product->>'minPrice')::numeric,0);
  if (item->>'price')::numeric<floor_price then
   select d into req from jxc_docs where k='quote' and id=new.d->>'discountApproval' and d->>'type'='discount' and d->>'status'='approved';
   if req is null or req->>'so'<>new.id or req->'items'<>new.d->'items' then raise exception 'Below minimum price: matching discount approval required'; end if;
  end if;
  amount:=amount+(item->>'qty')::numeric*(item->>'price')::numeric;
 end loop;
 if new.d->>'pay'='credit' and customer->>'creditLimit' is not null then
  limit_amt:=(customer->>'creditLimit')::numeric;
  select coalesce(sum(greatest(0,(select coalesce(sum((i->>'qty')::numeric*(i->>'price')::numeric),0) from jsonb_array_elements(s.d->'items') i)
   -coalesce((select sum((f.d->>'amount')::numeric) from jxc_docs f where f.k='fin' and f.d->>'ref'=s.id and f.d->>'type'='rcv' and f.d->>'status'='verified'),0))),0)
   into exposure from jxc_docs s where s.k='so' and s.id<>new.id and s.d->>'cus'=new.d->>'cus' and s.d->>'status' in ('submitted','credit_gm','approved','shipped','done');
  if exposure+amount>limit_amt+0.005 then raise exception 'Customer credit limit exceeded'; end if;
 end if;
 return new;
end $$;
drop trigger if exists jxc_sales_policy_trigger on jxc_docs;
create trigger jxc_sales_policy_trigger before insert or update on jxc_docs for each row when (new.k='so') execute function jxc_sales_policy();

create or replace function jxc_fifo_cost(p_pid text,p_wh text,p_qty numeric) returns numeric language plpgsql stable as $$
declare m record; qs numeric[]:=array[]::numeric[]; cs numeric[]:=array[]::numeric[]; idx int:=1; n int:=0; need numeric; take numeric; total numeric:=0;
begin
 for m in select (d->>'qty')::numeric q,coalesce((d->>'uc')::numeric,0) c from jxc_docs where k='moves' and d->>'pid'=p_pid and d->>'wh'=p_wh order by seq loop
  if m.q>0 then n:=n+1;qs[n]:=m.q;cs[n]:=m.c;
  else need:=-m.q;while need>0 and idx<=n loop take:=least(need,qs[idx]);qs[idx]:=qs[idx]-take;need:=need-take;if qs[idx]=0 then idx:=idx+1;end if;end loop;end if;
 end loop;
 need:=p_qty;while need>0 and idx<=n loop take:=least(need,qs[idx]);total:=total+take*cs[idx];need:=need-take;idx:=idx+1;end loop;
 if need>0 then raise exception 'FIFO layers insufficient'; end if;return total/nullif(p_qty,0);
end $$;
revoke all on function jxc_fifo_cost(text,text,numeric) from public,anon,authenticated;


commit;
