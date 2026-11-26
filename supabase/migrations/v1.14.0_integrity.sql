-- Operational controls. Apply after v1.13.0_finance_po.sql and v1.13.0_chat_leave.sql.
begin;
create table if not exists jxc_number_series(kind text,month text,last_no bigint not null,primary key(kind,month));
alter table jxc_number_series enable row level security;
revoke all on jxc_number_series from public,anon,authenticated;
create or replace function jxc_approval_limit() returns numeric language sql stable as $$
select coalesce((select (d->>'expLimit')::numeric from jxc_docs where k='settings' and id='app'),2000) $$;
create or replace function jxc_doc_limit(doc jsonb) returns numeric language sql stable as $$
select coalesce((doc->>'approvalLimit')::numeric,2000) $$;
create or replace function jxc_reserved(p_pid text,p_wh text,p_exclude text default '') returns numeric language sql stable as $$
select coalesce(sum(greatest(0,(i->>'qty')::numeric-coalesce((select sum(-(m.d->>'qty')::numeric) from jxc_docs m where m.k='moves' and m.d->>'type'='so_out' and m.d->>'ref'=s.id and m.d->>'pid'=p_pid),0))),0)
from jxc_docs s cross join lateral jsonb_array_elements(s.d->'items') i
where s.k='so' and s.id<>p_exclude and s.d->>'status'='approved' and s.d->>'wh'=p_wh and i->>'pid'=p_pid $$;
create unique index if not exists jxc_server_document_number_unique on jxc_docs(k,(d->>'no')) where d->>'serverCreated'='true' and d ? 'no';
create or replace function jxc_keep_server_times(incoming jsonb,stored jsonb) returns jsonb language plpgsql immutable as $$
declare key text;r jsonb:=incoming;begin
for key in select unnest(array['pt','vt','bt','st','ot','gt','ft','rt','receivedAt','verifiedAt']) loop
 if stored ? key then r:=jsonb_set(r,array[key],stored->key);else r:=r-key;end if;
end loop;
for key in select unnest(array['fin','gmok','approval','op','gm','pd','closed']) loop
 if jsonb_typeof(stored->key)='object' and jsonb_typeof(r->key)='object' and stored->key ? 't' then r:=jsonb_set(r,array[key,'t'],stored->key->'t');end if;
end loop;return r;end $$;
create or replace function jxc_integrity_metadata() returns trigger language plpgsql as $$
declare n bigint;v_month text:=to_char(now() at time zone 'UTC','YYYYMM');prefix text;conf jsonb;role text;
begin
 select d into conf from jxc_docs where k='settings' and id='app';
 select u.role into role from jxc_users u where u.id=new.by_user;
 if new.k='partners' then
  if new.d ? 'creditLimit' and ((new.d->>'creditLimit')::numeric<0 or (new.d->>'creditLimit')::numeric::text in ('NaN','Infinity','-Infinity')) then raise exception 'Invalid customer credit limit';end if;
  if new.d ? 'paymentDays' and ((new.d->>'paymentDays')::numeric<0 or (new.d->>'paymentDays')::numeric<>trunc((new.d->>'paymentDays')::numeric) or (new.d->>'paymentDays')::numeric::text in ('NaN','Infinity','-Infinity')) then raise exception 'Invalid customer payment term';end if;
 end if;

 if new.k='settings' then
  if coalesce((new.d->>'expLimit')::numeric,2000)<0 or coalesce((new.d->>'expLimit')::numeric,2000)::text in ('NaN','Infinity','-Infinity') then raise exception 'Invalid approval limit';end if;
  if tg_op='UPDATE' and new.d->>'base' is distinct from old.d->>'base' and exists(select 1 from jxc_docs where k in ('so','po','fin','moves')) then raise exception 'Base currency is locked after transactions; use document FX';end if;
  if new.d->>'vatRegistered'='true' then raise exception 'VAT registration is not verified. Keep unregistered until registration is confirmed';end if;
  new.d:=new.d||'{"vatRegistered":false}'::jsonb;
 end if;
 prefix:=case new.k when 'so' then 'SO' when 'po' then 'PO' when 'grn' then 'GR' when 'sr' then 'SR' when 'pr' then 'PR' when 'counts' then 'ST' when 'fin' then 'FIN' when 'refund' then 'RF' when 'exp' then 'EX' when 'transfer' then 'TR' when 'writeoff' then 'WO' when 'invoice' then 'INV' when 'allocation' then 'AL' when 'qc' then 'QC' when 'stockreq' then 'IS' when 'lcadj' then 'LC' when 'quote' then 'QT' when 'opening_balance' then 'OB' else null end;
 if prefix is not null then
  if tg_op='INSERT' then
   insert into jxc_number_series(kind,month,last_no) values(new.k,v_month,1) on conflict(kind,month) do update set last_no=jxc_number_series.last_no+1 returning last_no into n;
   new.d:=new.d||jsonb_build_object('no',prefix||v_month||'-'||lpad(n::text,greatest(6,length(n::text)),'0'),'t',floor(extract(epoch from now())*1000)::bigint,'currency',coalesce(conf->>'base','GHS'),'serverCreated',true);
   if new.k='fin' and new.d->>'type'='pay' then new.d:=new.d||'{"invoicePolicy":"three-way"}'::jsonb;end if;
   if new.k in ('fin','exp','refund') then new.d:=new.d||jsonb_build_object('approvalLimit',jxc_approval_limit());end if;
  else
   new.d:=new.d||jsonb_build_object('no',old.d->'no','t',old.d->'t','currency',coalesce(old.d->>'currency',coalesce(conf->>'base','GHS')));
   if old.d ? 'invoicePolicy' then new.d:=new.d||jsonb_build_object('invoicePolicy',old.d->'invoicePolicy');else new.d:=new.d-'invoicePolicy';end if;
   if old.d ? 'approvalLimit' then new.d:=new.d||jsonb_build_object('approvalLimit',old.d->'approvalLimit');end if;
  end if;
 end if;
 if tg_op='INSERT' or new.d->>'status' is distinct from old.d->>'status' then
  if new.k in ('fin','refund') and new.d->>'status'='paid' then new.d:=new.d||jsonb_build_object('pt',floor(extract(epoch from now())*1000)::bigint);end if;
  if new.k='fin' and new.d->>'status'='verified' then new.d:=new.d||jsonb_build_object('vt',floor(extract(epoch from now())*1000)::bigint);end if;
  if new.k='exp' and new.d->>'status'='booked' then new.d:=new.d||jsonb_build_object('bt',floor(extract(epoch from now())*1000)::bigint);end if;
  if new.k='exp' and new.d->>'status'='paid' and jsonb_typeof(new.d->'pd')='object' then new.d:=jsonb_set(new.d,'{pd,t}',to_jsonb(floor(extract(epoch from now())*1000)::bigint));end if;
  if new.k='so' and new.d->>'status' in ('approved','shipped','done') and (new.d ? 'st') then new.d:=new.d||jsonb_build_object('st',floor(extract(epoch from now())*1000)::bigint);end if;
 end if;
 return new;
end $$;
drop trigger if exists jxc_00_metadata on jxc_docs;
create trigger jxc_00_metadata before insert or update on jxc_docs for each row execute function jxc_integrity_metadata();
do $$ begin
 if to_regprocedure('jxc_flow_ok_v114_base(jxc_users,text,jsonb,boolean,jsonb)') is null then
  alter function jxc_flow_ok(jxc_users,text,jsonb,boolean,jsonb) rename to jxc_flow_ok_v114_base;
  alter function jxc_can_write(text,text,jsonb) rename to jxc_can_write_v114_base;
  alter function jxc_doc_visible(jxc_users,text,jsonb) rename to jxc_doc_visible_v114_base;
 end if;
end $$;
create or replace function jxc_can_write(r text,k text,d jsonb) returns boolean language sql immutable as $$
select case when k='moves' and d->>'type' in ('writeoff','qc_out','qc_in') then r in ('chair','keeper') when k in ('writeoff','qc') then r in ('chair','keeper','ops','gm')
when k='counts' then r in ('chair','keeper','acct','ops','gm')
when k='fin' and d->>'type'='rcv' then r in ('chair','cashier','acct')
when k='so' and r='cashier' then false
else jxc_can_write_v114_base(r,k,d) end $$;
create or replace function jxc_doc_visible(me jxc_users,k text,pdoc jsonb) returns boolean language sql stable as $$
select case when k in ('writeoff','qc') then me.role in ('chair','gm','ops','acct','keeper','clerk') else jxc_doc_visible_v114_base(me,k,pdoc) end $$;
create or replace function jxc_flow_ok(p_me jxc_users,p_k text,p_d jsonb,p_has boolean,p_od jsonb) returns boolean language plpgsql stable as $$
declare r text:=p_me.role;ns text:=p_d->>'status';os text:=p_od->>'status';a jsonb;b jsonb;
begin
if p_k='moves' and p_d->>'type' in ('writeoff','qc_out','qc_in') then return not p_has and r in ('chair','keeper');end if;
-- Server-owned metadata is canonicalized by jxc_push and immutable to clients.
if p_k='fin' and p_d->>'type'='rcv' then
 if not p_has then return r in ('chair','cashier') and ns='recorded' and p_d->>'by'=p_me.id and (p_d->>'amount')::numeric>0 and (p_d->>'amount')::numeric::text not in ('NaN','Infinity','-Infinity') and p_d->>'vby' is null and ((coalesce(p_d->>'refKind','so')='so' and exists(select 1 from jxc_docs where k='so' and id=p_d->>'ref')) or (p_d->>'refKind'='po' and exists(select 1 from jxc_docs where k='po' and id=p_d->>'ref')) or (p_d->>'refKind'='customer' and exists(select 1 from jxc_docs where k='partners' and id=p_d->>'ref')));end if;
 if p_od->>'by'=p_me.id then return false;end if;
 return r in ('chair','acct') and os='recorded' and ns='verified' and p_d->>'vby'=p_me.id
 and (p_d-array['status','vby','vt','u','_q'])=(p_od-array['status','vby','vt','u','_q']);
end if;
if p_k='so' and p_has and os='submitted' and ns in ('approved','credit_gm','rejected') and r not in ('chair','acct') then return false;end if;
if p_k='counts' then
 if not p_has then return false;end if; -- Counting starts through the server snapshot RPC.
 if os='counting' then
  if r not in ('chair','keeper') or p_od->>'by'<>p_me.id or ns not in ('pending','rejected') then return false;end if;
  if (p_d-array['items','status','note','u','_q']) is distinct from (p_od-array['items','status','note','u','_q']) then return false;end if;
  return ns='rejected' or (jsonb_array_length(p_d->'items')>0 and not exists(select 1 from jsonb_array_elements(p_d->'items') i where (i->>'real')::numeric<0 or (i->>'real')::numeric::text in ('NaN','Infinity','-Infinity') or not exists(select 1 from jsonb_array_elements(p_od->'items') o where o->>'pid'=i->>'pid' and o->'sys'=i->'sys')) and (select count(*) from jsonb_array_elements(p_d->'items'))=(select count(distinct i->>'pid') from jsonb_array_elements(p_d->'items') i));
 end if;
 if not coalesce((p_od->>'integritySnapshot')::boolean,false) then return ns='rejected' and r in ('chair','acct','ops','gm');end if;
 if (p_d-array['status','fv','ft','rv','rt','rr','u','_q']) is distinct from (p_od-array['status','fv','ft','rv','rt','rr','u','_q']) then return false;end if;
 if os='pending' then return r in ('chair','acct') and p_od->>'by'<>p_me.id and ns in ('fin_ok','rejected') and (ns='rejected' or p_d->>'fv'=p_me.id);end if;
 return os='fin_ok' and r in ('chair','ops','gm') and p_od->>'by'<>p_me.id and p_od->>'fv'<>p_me.id and ns in ('approved','rejected') and p_d->>'rv'=p_me.id;
end if;
if p_k in ('writeoff','qc') then
 if not p_has then return r in ('chair','keeper') and p_d->>'by'=p_me.id and ns='pending' and length(coalesce(p_d->>'reason',''))>=2 and jsonb_array_length(p_d->'items')>0 and not exists(select 1 from jsonb_array_elements(p_d->'items') i where coalesce((i->>'qty')::numeric,0)<=0 or (i->>'qty')::numeric::text in ('NaN','Infinity','-Infinity'));end if;
 if (p_d-array['status','approval','doneBy','u','_q']) is distinct from (p_od-array['status','approval','doneBy','u','_q']) then return false;end if;
 if os='pending' then return r in ('chair','ops','gm') and p_od->>'by'<>p_me.id and ns in ('approved','rejected') and p_d->'approval'->>'by'=p_me.id;end if;
 return os='approved' and ns='done' and r in ('chair','keeper') and p_d->>'doneBy'=p_me.id;
end if;
-- Existing flow functions retain their exact transition checks, with per-document thresholds.
return jxc_flow_ok_v114_base(p_me,p_k,p_d,p_has,p_od);
end $$;
create or replace function jxc_flow_ok_v180(p_me jxc_users, p_k text, p_d jsonb, p_has boolean, p_od jsonb) returns boolean
language plpgsql stable as $$
declare r text := p_me.role; ns text := coalesce(p_d->>'status',''); os text := p_od->>'status';
begin
  if p_k='msg' then return not p_has or p_od->>'by'=p_me.id; end if;                       -- 只有发送人能撤回
  if p_k='chat' then return not p_has or jsonb_typeof(p_od->'mem')<>'array' or (p_od->'mem') ? p_me.id; end if;
  if p_k='att' then return not p_has and r<>'chair' and nullif(trim(p_d->>'photo'),'') is not null and p_d->>'type' in ('in','out','visit'); end if;                                               -- 打卡记录不能修改
  -- Receipt payload cannot change during approval. Legacy completed receipts remain read-only.
  if p_k='grn' then
    if not p_has then return r in ('buyer','clerk','keeper','gm') and ns='submitted'
      and nullif(trim(p_d->>'batch'),'') is not null and jsonb_array_length(p_d->'items')>0
      and not exists(select 1 from jsonb_array_elements(p_d->'items') i where coalesce((i->>'qty')::numeric,0)<=0 or nullif(trim(i->>'batch'),'') is null); end if;
    if (p_d - array['status','fin','check','received','reject','u','_q']) is distinct from (p_od - array['status','fin','check','received','reject','u','_q']) then return false; end if;
    if r='acct' then return os='submitted' and ns in ('fin_ok','rejected'); end if;
    if r='clerk' then return os='fin_ok' and ns in ('ready','rejected') and p_d->'fin'=p_od->'fin'; end if;
    if r='keeper' then return os='ready' and ns='done' and p_d->'fin'=p_od->'fin' and p_d->'check'=p_od->'check'; end if;
    return false;
  end if;
  -- Stock movements must reference a document released for this exact step.
  if p_k='moves' and p_d->>'type'='so_out' then
    return r in ('keeper','gm') and exists(select 1 from jxc_docs d where d.k='so' and d.id=p_d->>'ref' and d.d->>'status'='approved');
  end if;
  if p_k='moves' and p_d->>'type'='po_in' then
    return r='keeper' and exists(select 1 from jxc_docs d where d.k='grn' and d.id=p_d->>'ref' and d.d->>'status'='ready');
  end if;
  if p_k='po' and r='keeper' then return p_has and os='ordered' and ns in ('ordered','received'); end if;
  -- Every expense and every payment must pass operations; above 2000 also requires GM.
  if p_k='exp' then
    if not p_has then return ns='submitted' and coalesce((p_d->>'amt')::numeric,0)>0 and p_d->'op' is null and p_d->'gm' is null; end if;
    if (p_d - array['status','op','gm','bk','bt','pd','rj','seen','u','_q']) is distinct from (p_od - array['status','op','gm','bk','bt','pd','rj','seen','u','_q']) then return false; end if;
    if p_od->>'by'=p_me.id and ((os='submitted' and ns='void') or (os='rejected' and ns='rejected')) then return true; end if;
    if r='ops' then return os='submitted' and (ns='rejected' or (p_d->'op'->>'by'=p_me.id and ns=case when (p_od->>'amt')::numeric>jxc_doc_limit(p_od) then 'gm_pending' else 'approved' end)); end if;
    if p_d->'op' is distinct from p_od->'op' then return false; end if;
    if r='gm' then return os='gm_pending' and p_od->'op'->>'by' is not null and (ns='rejected' or (ns='approved' and p_d->'gm'->>'by'=p_me.id)); end if;
    if p_d->'gm' is distinct from p_od->'gm' then return false; end if;
    if p_od->'op'->>'by' is null or ((p_od->>'amt')::numeric>jxc_doc_limit(p_od) and p_od->'gm'->>'by' is null) then return false; end if;
    if r='acct' then return os='approved' and ns in ('booked','rejected'); end if;
    if r='cashier' then return os='booked' and ns='paid'; end if;
    return false;
  end if;
  if p_k='fin' and p_d->>'type'='pay' then
    if not p_has then return r in ('acct','gm') and ns='req' and coalesce((p_d->>'amount')::numeric,0)>0 and p_d->>'oby' is null and p_d->>'gby' is null; end if;
    if r in ('acct','gm') and ns='req' and os in ('req','rejected') then return coalesce((p_d->>'amount')::numeric,0)>0 and p_d->>'oby' is null and p_d->>'gby' is null; end if;
    if (p_d - array['status','oby','ot','onote','gby','gt','gnote','pby','pt','pref','method','u','_q']) is distinct from (p_od - array['status','oby','ot','onote','gby','gt','gnote','pby','pt','pref','method','u','_q']) then return false; end if;
    if r in ('gm','ops') and os='approved' and ns='req' then return p_d->>'oby' is null and p_d->>'gby' is null; end if;
    if r='ops' then return os='req' and (ns='rejected' or (p_d->>'oby'=p_me.id and ns=case when (p_od->>'amount')::numeric>jxc_doc_limit(p_od) then 'gm_pending' else 'approved' end)); end if;
    if p_d->>'oby' is distinct from p_od->>'oby' then return false; end if;
    if r='gm' then return os='gm_pending' and p_od->>'oby' is not null and (ns='rejected' or (ns='approved' and p_d->>'gby'=p_me.id)); end if;
    if p_d->>'gby' is distinct from p_od->>'gby' then return false; end if;
    if r='acct' then return ns='void' and os in ('req','rejected'); end if;
    if r='cashier' then return os='approved' and ns='paid' and p_od->>'oby' is not null and ((p_od->>'amount')::numeric<=jxc_doc_limit(p_od) or p_od->>'gby' is not null); end if;
    return false;
  end if;
  if r in ('chair','gm') then return true; end if;
  if p_k='so' then                -- 销售：业务员提交 → 财务（现款确认收款 / 赊账初审）→ 总经理（赊账）→ 仓库出库
    if r in ('sales','field') then return (ns in ('draft','submitted') and coalesce(os,'draft') in ('draft','submitted','rejected')) or (ns='done' and os='shipped') or (ns='cancel' and coalesce(os,'draft') in ('draft','rejected')); end if;
    if r in ('acct','cashier') then return os='submitted' and (ns='rejected' or (ns='approved' and coalesce(p_d->>'pay','cash')<>'credit') or (ns='credit_gm' and p_d->>'pay'='credit')); end if;
    if r='keeper' then return (os='approved' and ns='shipped') or (os='shipped' and ns='done'); end if;
    return false;
  end if;
  if p_k='counts' then            -- 盘点：库管 → 财务复核 → 运营经理 / 总经理终审
    if r='keeper' then return ns='pending' and coalesce(os,'pending') in ('pending','rejected'); end if;
    if r='acct' then return os='pending' and ns in ('fin_ok','rejected'); end if;
    if r='ops' then return os='fin_ok' and ns in ('approved','rejected'); end if;
    return false;
  end if;
  if p_k='exp' then               -- 费用：提交 →（特殊）总经理 / 运营经理审批 → 会计入账 → 出纳付款
    if not p_has then return ns='submitted'; end if;
    if p_od->>'by'=p_me.id and ((os='submitted' and ns='void') or (os='rejected' and ns='rejected')) then return true; end if;
    if r='ops' then return os='submitted' and ns in ('approved','rejected'); end if;
    if r='acct' then return (os='approved' or (os='submitted' and not coalesce((p_od->>'special')::boolean,false))) and ns in ('booked','rejected'); end if;
    if r='cashier' then return os='booked' and ns='paid'; end if;
    return false;
  end if;
  return true;
end $$;
create or replace function jxc_push(p_token text, p_ops jsonb) returns jsonb
language plpgsql security definer set search_path=public, extensions as $$
declare v_me jxc_users; op jsonb; v_k text; v_id text; v_d jsonb; v_u bigint; n_ok int:=0; rej jsonb:='[]'::jsonb; v_old bigint; v_has boolean; v_plan jsonb; v_ost text; v_od jsonb; v_errors text:='';
begin
  v_me := jxc_me_row(p_token);
  -- Serialize business commits so simultaneous warehouse confirmations cannot post stock twice.
  perform pg_advisory_xact_lock(hashtext('jxc_push_business'));
  for op in select * from jsonb_array_elements(p_ops) loop
    v_k := op->>'k'; v_id := op->>'id'; v_d := (op->'d')-'paidVerified'; v_d:=jsonb_set(v_d,'{id}',to_jsonb(v_id)); v_u := coalesce((v_d->>'u')::bigint,0);
    begin
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
    if not coalesce(v_has,false) and v_k in ('msg','exp','att','leave','stockreq','transfer','receipt','opening_balance','quote','fin','so','po','counts','writeoff','qc','invoice','allocation','refund','lcadj') then v_d := jsonb_set(v_d,'{by}',to_jsonb(v_me.id)); end if;   -- 发送人 / 申请人以登录账号为准
    if v_k in ('so','po','grn','sr','pr','counts','fin','refund','exp','transfer','writeoff','qc','stockreq','lcadj','quote','opening_balance','invoice','allocation') then
     if coalesce(v_has,false) then
      v_d := (v_d-array['no','t','currency','serverCreated','approvalLimit','invoicePolicy','cashAmountBase','fxLoss','settlementFx','nativeAmount']) || (v_od-array(select jsonb_object_keys(v_od) except select unnest(array['no','t','currency','serverCreated','approvalLimit','invoicePolicy','cashAmountBase','fxLoss','settlementFx','nativeAmount'])));
     else
      v_d := v_d-array['serverCreated','approvalLimit','invoicePolicy','cashAmountBase','fxLoss','settlementFx','nativeAmount'];
     end if;
    end if;
    if coalesce(v_has,false) and v_d->>'status' is not distinct from v_od->>'status' then v_d:=jxc_keep_server_times(v_d,v_od);end if;
    -- Retry after a lost HTTP response must not repeat postings or fail an already committed operation.
    if coalesce(v_has,false) and (v_od-array['u','_q','postedAt'])=(v_d-array['u','_q','postedAt']) then n_ok:=n_ok+1;continue;end if;
    if coalesce(v_has,false) and v_k='moves' then
      if (v_od-array['t','u','_q','uc','costFixed','costStatus','costAmount','postedAt','revenue'])=(v_d-array['t','u','_q','uc','costFixed','costStatus','costAmount','postedAt','revenue']) then n_ok:=n_ok+1;continue;end if;
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
    select d into v_d from jxc_docs where k=v_k and id=v_id;
    insert into jxc_audit(user_id,action,k,doc_id,detail) values(v_me.id,'put',v_k,v_id,jsonb_build_object('status',v_d->>'status','no',v_d->>'no'));
    n_ok := n_ok+1;
    exception when others then
      rej:=rej||jsonb_build_array(v_id);v_errors:=left(v_errors||' '||SQLERRM,800);
    end;
  end loop;
  if jsonb_array_length(rej)>0 then raise exception '审批状态已变化或没有权限，请同步后重试 / Approval changed or permission denied: % %',v_errors,rej; end if;
  return jsonb_build_object('ok',n_ok,'rejected',rej);
end $$;

create or replace function jxc_po_lock() returns trigger
language plpgsql security definer set search_path=public,extensions as $$
declare locked boolean;
begin
 if tg_op<>'UPDATE' or coalesce(old.d->>'status','draft')='draft' then return new; end if;
 locked:=exists(select 1 from jxc_docs g where g.k='grn' and g.d->>'po'=new.id and coalesce(g.d->>'status','done')<>'rejected')
      or exists(select 1 from jxc_docs f where f.k='fin' and f.d->>'type'='pay' and f.d->>'ref'=new.id and coalesce(f.d->>'status','')<>'void');
 if not locked then return new; end if;
 if (select coalesce(jsonb_agg(i-'recv' order by n),'[]'::jsonb) from jsonb_array_elements(new.d->'items') with ordinality x(i,n))
    is distinct from (select coalesce(jsonb_agg(i-'recv' order by n),'[]'::jsonb) from jsonb_array_elements(old.d->'items') with ordinality x(i,n))
  or coalesce(new.d->'fees','[]'::jsonb) is distinct from coalesce(old.d->'fees','[]'::jsonb)
  or new.d->'sup' is distinct from old.d->'sup' or new.d->'wh' is distinct from old.d->'wh' then
  raise exception '采购单已入库或已申请付款，不能再修改商品、单价或附加费用；入库后的费用请用“补录采购费用” / Purchase order is locked after receipt or payment request; use a cost addition';
 end if;
 if new.d->>'status'='cancel' and old.d->>'status'<>'cancel' and exists(select 1 from jxc_docs g where g.k='grn' and g.d->>'po'=new.id and coalesce(g.d->>'status','')<>'rejected') then
  raise exception '采购单已有入库或付款申请，不能取消 / Purchase order with receipts or payment requests cannot be cancelled';
 end if;
 return new;
end $$;
create or replace function jxc_guard_stock() returns trigger language plpgsql as $$
declare m jsonb:=new.d; src jsonb; it jsonb; q numeric; allowed numeric; done numeric; avail numeric; v numeric; cq numeric; cv numeric; cost numeric; typ text; batch text; pid text; wh text; orig_ref text; orig_type text; unknown_cost boolean:=false;
begin
 if new.k<>'moves' then return new; end if;
 if tg_op='UPDATE' then raise exception 'Stock ledger is immutable'; end if;
 perform pg_advisory_xact_lock(hashtext('jxc_push_business'));
 m:=m||jsonb_build_object('t',floor(extract(epoch from now())*1000)::bigint);
 q:=(m->>'qty')::numeric;typ:=m->>'type';pid:=m->>'pid';wh:=m->>'wh';batch:=coalesce(m->>'batch','');
 if q=0 or q::text in ('NaN','Infinity','-Infinity') or pid is null or wh is null then raise exception 'Invalid stock movement'; end if;
 if exists(select 1 from jxc_docs where k='period' and d->>'status'='closed' and d->>'month'=to_char(to_timestamp(coalesce((m->>'t')::bigint,0)/1000.0),'YYYY-MM')) then raise exception 'Accounting period is closed'; end if;
 if exists(select 1 from jxc_docs c where c.k='counts' and c.d->>'wh'=wh and c.d->>'status' in ('counting','pending','fin_ok') and coalesce((c.d->>'integritySnapshot')::boolean,false) and not (typ='adj' and c.id=m->>'ref')) then raise exception 'Warehouse frozen for stock count';end if;
 if typ in ('writeoff','qc_out','qc_in') then
  select d into src from jxc_docs where k=case when typ='writeoff' then 'writeoff' else 'qc' end and id=m->>'ref';
  if src is null or src->>'status'<>'approved' or src->>'wh'<>wh or (typ in ('writeoff','qc_out') and q>=0) or (typ='qc_in' and q<=0) then raise exception 'Invalid quality/write-off posting';end if;
 elsif typ='so_out' then
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
  select sum((x->>'qty')::numeric) into allowed from jsonb_array_elements(src->'items') x where x->>'pid'=pid and (typ<>'po_in' or coalesce(x->>'batch',src->>'batch','')=batch) and (typ not in ('qc_out','qc_in') and not (typ='writeoff' and src->>'quality'='hold') or coalesce(x->>'batch','')=batch);
 end if;
 select coalesce(sum(abs((d->>'qty')::numeric)),0) into done from jxc_docs where k='moves' and d->>'type'=typ and d->>'ref'=m->>'ref' and d->>'pid'=pid and (typ<>'po_in' or coalesce(d->>'batch','')=batch);
 if allowed is null or done+abs(q)>abs(allowed)+0.000001 then raise exception 'Quantity exceeds approved document'; end if;
 unknown_cost:=exists(select 1 from jxc_docs where k='moves' and d->>'pid'=pid and d->>'wh'=wh and d->>'uc' is null);
 select coalesce(sum((d->>'qty')::numeric),0),coalesce(sum((d->>'qty')::numeric*coalesce((d->>'uc')::numeric,0)),0) into cq,cv from jxc_docs where k='moves' and d->>'pid'=pid and d->>'wh'=wh;
 select coalesce(sum((d->>'qty')::numeric),0) into avail from jxc_docs where k='moves' and d->>'pid'=pid and d->>'wh'=wh and coalesce(d->>'batch','')=batch and coalesce(d->>'quality','good')=case when typ='qc_out' or (typ='writeoff' and src->>'quality'='hold') then 'hold' else 'good' end;
 if q<0 and avail+q< -0.000001 then raise exception 'Insufficient stock in this batch'; end if;
 if q<0 and typ<>'qc_out' and not (typ='writeoff' and src->>'quality'='hold') and (select coalesce(sum((d->>'qty')::numeric),0) from jxc_docs where k='moves' and d->>'pid'=pid and d->>'wh'=wh and coalesce(d->>'quality','good')='good')+q<jxc_reserved(pid,wh,case when typ='so_out' then m->>'ref' else '' end)-0.000001 then raise exception 'Stock is reserved by approved sales';end if;

 cost:=case when cq>0 then cv/cq else 0 end;
 if typ='qc_in' then
  select sum(-(d->>'qty')::numeric),sum(-(d->>'qty')::numeric*(d->>'uc')::numeric) into v,cost from jxc_docs where k='moves' and d->>'type'='qc_out' and d->>'ref'=m->>'ref' and d->>'pid'=pid and coalesce(d->>'batch','')=batch;
  if coalesce(v,0)<q then raise exception 'Quarantine release exceeds held dispatch';end if;cost:=cost/nullif(v,0);
 elsif typ='tr_in' then
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
 m:=m||jsonb_build_object('t',floor(extract(epoch from now())*1000)::bigint,'quality',case when typ in ('so_ret','qc_out') or (typ='writeoff' and src->>'quality'='hold') then 'hold' else 'good' end);
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

create or replace function jxc_integrity_document() returns trigger language plpgsql as $$
declare i jsonb;q numeric;available numeric;days integer;conf jsonb;
begin
perform pg_advisory_xact_lock(hashtext('jxc_push_business'));
if new.k='counts' and new.d->>'status'='approved' then
 for i in select * from jsonb_array_elements(new.d->'items') loop
  select coalesce(sum((d->>'qty')::numeric),0) into q from jxc_docs where k='moves' and d->>'type'='adj' and d->>'ref'=new.id and d->>'pid'=i->>'pid';
  if abs(q-((i->>'real')::numeric-(i->>'sys')::numeric))>0.000001 then raise exception 'Count adjustments are incomplete';end if;
 end loop;
end if;
if new.k in ('qc','writeoff') and new.d->>'status'='done' then
 for i in select * from jsonb_array_elements(new.d->'items') loop
  select coalesce(sum(-(d->>'qty')::numeric),0) into q from jxc_docs where k='moves' and d->>'type'=case when new.k='qc' then 'qc_out' else 'writeoff' end and d->>'ref'=new.id and d->>'pid'=i->>'pid';
  if abs(q-(i->>'qty')::numeric)>0.000001 then raise exception 'Quality/write-off postings incomplete';end if;
  if new.k='qc' and abs(q-(select coalesce(sum((d->>'qty')::numeric),0) from jxc_docs where k='moves' and d->>'type'='qc_in' and d->>'ref'=new.id and d->>'pid'=i->>'pid'))>0.000001 then raise exception 'Quality release postings incomplete';end if;
 end loop;
end if;
if new.k in ('so','po') and new.d->>'status' not in ('draft','rejected','cancel') then
 if jsonb_array_length(new.d->'items')<1 or exists(select 1 from jsonb_array_elements(new.d->'items') x where x->>'qty' is null or x->>'price' is null or (x->>'qty')::numeric<=0 or (x->>'price')::numeric<0 or (x->>'qty')::numeric::text in ('NaN','Infinity','-Infinity') or (x->>'price')::numeric::text in ('NaN','Infinity','-Infinity')) then raise exception 'Invalid order quantities or prices';end if;

 if (select count(*) from jsonb_array_elements(new.d->'items'))<>(select count(distinct x->>'pid') from jsonb_array_elements(new.d->'items') x) then raise exception 'Merge duplicate product lines before submitting';end if;
end if;
if new.k='so' and new.d->>'status'='cancel' and exists(select 1 from jxc_docs where k='moves' and d->>'type'='so_out' and d->>'ref'=new.id) then raise exception 'Shipped orders require a return, not cancellation';end if;
if new.k='po' then
 for i in select * from jsonb_array_elements(new.d->'items') loop
  select coalesce(sum((m.d->>'qty')::numeric),0) into q from jxc_docs m join jxc_docs g on g.k='grn' and g.id=m.d->>'ref' where m.k='moves' and m.d->>'type'='po_in' and g.d->>'po'=new.id and m.d->>'pid'=i->>'pid';
  if coalesce((i->>'recv')::numeric,0)<>q then raise exception 'Purchase received counter must equal stock ledger';end if;
 end loop;
 if new.d->>'status'='done' and exists(select 1 from jxc_docs where k='grn' and d->>'po'=new.id and d->>'status' in ('submitted','fin_ok','ready')) then raise exception 'Receipt review must finish before closing purchase order';end if;
end if;
if new.k='so' and new.d->>'status'='approved' then
 for i in select * from jsonb_array_elements(new.d->'items') loop
  select coalesce(sum((d->>'qty')::numeric),0) into available from jxc_docs where k='moves' and d->>'pid'=i->>'pid' and d->>'wh'=new.d->>'wh' and coalesce(d->>'quality','good')='good';
  select coalesce(sum(-(d->>'qty')::numeric),0) into q from jxc_docs where k='moves' and d->>'type'='so_out' and d->>'ref'=new.id and d->>'pid'=i->>'pid';
  if (i->>'qty')::numeric-q+jxc_reserved(i->>'pid',new.d->>'wh',new.id)>available+0.000001 then raise exception 'Insufficient available stock to reserve order';end if;
 end loop;
end if;
if new.k='so' and new.d->>'pay'='credit' and new.d->>'status' in ('submitted','credit_gm','approved') then
 select d into conf from jxc_docs where k='partners' and id=new.d->>'cus';
 if conf->>'creditLimit' is null or (conf->>'creditLimit')::numeric<=0 or conf->>'paymentDays' is null then raise exception 'Configure customer credit limit and payment term before credit sale';end if;
end if;
if new.k='so' and (tg_op='INSERT' or not coalesce(old.d ? 'dueDate',false)) and exists(select 1 from jxc_docs where k='moves' and d->>'type'='so_out' and d->>'ref'=new.id) then
 select coalesce((d->>'paymentDays')::integer,0) into days from jxc_docs where k='partners' and id=new.d->>'cus';
 new.d:=new.d||jsonb_build_object('dueDate',to_char((now() at time zone 'UTC')::date+coalesce(days,0),'YYYY-MM-DD'),'paymentDays',coalesce(days,0));
elsif new.k='so' and tg_op='UPDATE' and old.d ? 'dueDate' then new.d:=new.d||jsonb_build_object('dueDate',old.d->'dueDate','paymentDays',old.d->'paymentDays');end if;
return new;
end $$;
drop trigger if exists jxc_integrity_document_trigger on jxc_docs;
create trigger jxc_integrity_document_trigger before insert or update on jxc_docs for each row when (new.k in ('so','po','counts','qc','writeoff')) execute function jxc_integrity_document();
create or replace function jxc_count_begin(p_token text,p_wh text) returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare who jxc_users;doc jsonb;did text;items jsonb;begin
who:=jxc_me_row(p_token);if who.role not in ('chair','keeper') or (who.role='keeper' and nullif(who.wh,'') is not null and who.wh<>p_wh) then raise exception 'Warehouse permission denied';end if;
perform pg_advisory_xact_lock(hashtext('jxc_push_business'));
if not exists(select 1 from jxc_docs where k='wh' and id=p_wh) then raise exception 'Warehouse not found';end if;
select d into doc from jxc_docs where k='counts' and d->>'wh'=p_wh and d->>'status' in ('counting','pending','fin_ok') and coalesce((d->>'integritySnapshot')::boolean,false) limit 1;
if found then if doc->>'by'=who.id and doc->>'status'='counting' then return doc;end if;raise exception 'Warehouse already has an active stock count';end if;
select coalesce(jsonb_agg(jsonb_build_object('pid',id,'sys',q,'real','') order by id),'[]'::jsonb) into items from (select p.id,coalesce(sum((m.d->>'qty')::numeric),0) q from jxc_docs p left join jxc_docs m on m.k='moves' and m.d->>'pid'=p.id and m.d->>'wh'=p_wh and coalesce(m.d->>'quality','good')='good' where p.k='products' group by p.id) x;
did:='COUNT_'||md5(random()::text||clock_timestamp()::text);doc:=jsonb_build_object('id',did,'by',who.id,'wh',p_wh,'status','counting','integritySnapshot',true,'items',items,'u',floor(extract(epoch from now())*1000)::bigint);
insert into jxc_docs(k,id,d,u,by_user) values('counts',did,doc,(doc->>'u')::bigint,who.id) returning d into doc;
insert into jxc_audit(user_id,action,k,doc_id,detail) values(who.id,'count_freeze','counts',did,jsonb_build_object('wh',p_wh));
return doc;end $$;
revoke all on function jxc_count_begin(text,text) from public;
grant execute on function jxc_count_begin(text,text) to anon,authenticated;
create or replace function jxc_flow_ok_v114_base(p_me jxc_users,p_k text,p_d jsonb,p_has boolean,p_od jsonb) returns boolean language plpgsql stable as $$
declare r text:=p_me.role; ns text:=coalesce(p_d->>'status',''); os text:=p_od->>'status'; amt numeric; big boolean;
begin
 if p_k<>'refund' then return jxc_flow_ok_v113_arap_base(p_me,p_k,p_d,p_has,p_od); end if;
 if not p_has then
  begin amt:=(p_d->>'amount')::numeric; exception when others then return false; end;
  return r in ('chair','acct') and ns='req' and p_d->>'by'=p_me.id
   and amt>0 and amt::text not in ('NaN','Infinity','-Infinity')
   and p_d->>'oby' is null and p_d->>'gby' is null and p_d->>'pby' is null
   and length(coalesce(p_d->>'reason',''))>=2
   and p_d->>'cus' is not distinct from (select d->>'cus' from jxc_docs where k='so' and id=p_d->>'so')
   and amt<=jxc_so_refundable(p_d->>'so',p_d->>'id')+0.005;
 end if;
 if (p_d-array['status','oby','ot','onote','gby','gt','gnote','pby','pt','pref','method','u','_q'])
    is distinct from (p_od-array['status','oby','ot','onote','gby','gt','gnote','pby','pt','pref','method','u','_q']) then return false; end if;
 big:=(p_od->>'amount')::numeric>jxc_doc_limit(p_od);
 -- 会计撤回自己未批准的申请
 if ns='void' then return os in ('req','rejected') and p_od->>'by'=p_me.id and r in ('chair','acct'); end if;
 -- 运营经理（或董事长）初审；不能审批自己提交的
 if os='req' and r in ('chair','ops') and p_od->>'by'<>p_me.id then
  return ns='rejected' or (p_d->>'oby'=p_me.id and ns=case when big then 'gm_pending' else 'approved' end);
 end if;
 -- 总经理（或董事长）复审
 if os='gm_pending' and r in ('chair','gm') and p_od->>'by'<>p_me.id then
  return p_d->>'oby' is not distinct from p_od->>'oby' and (ns='rejected' or (ns='approved' and p_d->>'gby'=p_me.id));
 end if;
 -- 出纳付款：审批链完整、填写凭证号
 if os='approved' and ns='paid' and r in ('chair','cashier') then
  return p_od->>'oby' is not null and (not big or p_od->>'gby' is not null) and p_d->>'pby'=p_me.id
   and length(coalesce(p_d->>'pref',''))>=2 and p_d->>'oby' is not distinct from p_od->>'oby' and p_d->>'gby' is not distinct from p_od->>'gby';
 end if;
 return false;
end $$;
revoke all on function jxc_reserved(text,text,text) from public,anon,authenticated;
commit;
