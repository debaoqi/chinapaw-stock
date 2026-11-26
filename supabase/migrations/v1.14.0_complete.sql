-- Huabao v1.14.0 complete upgrade. No business document deletion.
begin;
-- v1.14.0_backup.sql
-- Private, one-time pre-upgrade snapshot. No account/password copies and no business row edits.

create schema if not exists jxc_backup_20261126_v114;
create table if not exists jxc_backup_20261126_v114.docs as table public.jxc_docs;
create table if not exists jxc_backup_20261126_v114.functions as
select p.oid::regprocedure::text as signature,pg_get_functiondef(p.oid) as definition
from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'jxc_%' and p.prokind='f';
alter table jxc_backup_20261126_v114.docs enable row level security;
alter table jxc_backup_20261126_v114.functions enable row level security;
revoke all on schema jxc_backup_20261126_v114 from public,anon,authenticated;
revoke all on all tables in schema jxc_backup_20261126_v114 from public,anon,authenticated;

-- v1.13.0_finance_po.sql
-- 财务修正第二批：采购单锁定 + 入库后补录采购费用（lcadj）
-- 前提：已执行到 v1.12.0。可重复执行。不修改库存成本引擎（jxc_guard_stock），不改动已有单据。

-- ---------- 1. 采购单锁定 ----------
-- 采购单离开草稿后，一旦有未驳回的入库单或未作废的付款申请：
--   商品、数量、单价、附加费用、供应商、入库仓库都不能再改（入库数量 recv 由入库流程更新，除外）；
--   也不能取消。入库后发生的费用改走“补录采购费用”（lcadj）。
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
 if new.d->>'status'='cancel' and old.d->>'status'<>'cancel' then
  raise exception '采购单已有入库或付款申请，不能取消 / Purchase order with receipts or payment requests cannot be cancelled';
 end if;
 return new;
end $$;
drop trigger if exists jxc_po_lock_trigger on jxc_docs;
create trigger jxc_po_lock_trigger before update on jxc_docs for each row when (new.k='po') execute function jxc_po_lock();

-- ---------- 2. 补录采购费用 lcadj ----------
-- 会计提交（pending）→ 运营经理 / 总经理 / 董事长批准或驳回（不能审自己提交的）。
-- 批准后计入该采购单应付，利润报表作为当期采购费用。内容提交后不能修改。
do $$ begin
 if to_regprocedure('jxc_flow_ok_v113_finance_base(jxc_users,text,jsonb,boolean,jsonb)') is null then
  alter function jxc_flow_ok(jxc_users,text,jsonb,boolean,jsonb) rename to jxc_flow_ok_v113_finance_base;
  alter function jxc_can_write(text,text,jsonb) rename to jxc_can_write_v113_finance_base;
  alter function jxc_doc_visible(jxc_users,text,jsonb) rename to jxc_doc_visible_v113_finance_base;
 end if;
end $$;
create or replace function jxc_can_write(r text,k text,d jsonb) returns boolean language sql immutable as $$
 select case when k='lcadj' then r in ('chair','gm','ops','acct') else jxc_can_write_v113_finance_base(r,k,d) end
$$;
create or replace function jxc_doc_visible(me jxc_users,k text,pdoc jsonb) returns boolean language sql stable as $$
 select case when k='lcadj' then me.role in ('chair','gm','ops','acct','cashier','buyer','clerk') else jxc_doc_visible_v113_finance_base(me,k,pdoc) end
$$;
create or replace function jxc_flow_ok(p_me jxc_users,p_k text,p_d jsonb,p_has boolean,p_od jsonb) returns boolean language plpgsql stable as $$
declare r text:=p_me.role; ns text:=coalesce(p_d->>'status',''); os text:=p_od->>'status'; amt numeric;
begin
 if p_k<>'lcadj' then return jxc_flow_ok_v113_finance_base(p_me,p_k,p_d,p_has,p_od); end if;
 if not p_has then
  begin amt:=(p_d->>'amt')::numeric; exception when others then return false; end;
  return r in ('chair','acct') and ns='pending' and p_d->>'by'=p_me.id
   and amt>0 and amt::text not in ('NaN','Infinity','-Infinity')
   and coalesce(p_d->>'k','other') in ('freight','clear','other')
   and p_d->'approval' is null
   and exists(select 1 from jxc_docs p where p.k='po' and p.id=p_d->>'po' and p.d->>'status' in ('ordered','received','done'));
 end if;
 if (p_d-array['status','approval','u','_q']) is distinct from (p_od-array['status','approval','u','_q']) then return false; end if;
 return os='pending' and ns in ('approved','rejected') and r in ('chair','gm','ops') and p_od->>'by'<>p_me.id
   and p_d->'approval'->>'by'=p_me.id;
end $$;
grant execute on function jxc_can_write(text,text,jsonb),jxc_doc_visible(jxc_users,text,jsonb),jxc_flow_ok(jxc_users,text,jsonb,boolean,jsonb) to anon,authenticated;

select 'finance_po_lock_ready' status;

-- v1.13.0_finance_arap.sql
-- 财务修正第三批：客户退款单（refund）
-- 前提：已执行到 v1.12.0（建议先执行 v1.13.0_finance_po.sql）。可重复执行。不改动已有单据。
-- 流程与采购付款一致：会计申请 → 运营经理审批 →（金额 > 2000）总经理审批 → 出纳付款；会计可撤回未批准的申请。
-- 退款金额不能超过该销售单的“可退金额”= 已核对收款 − 该单应收（被驳回 / 取消 / 草稿的单应收为 0，已扣退货）− 其他未作废、未驳回的退款。

create or replace function jxc_so_refundable(p_so text,p_except text default null) returns numeric
language plpgsql stable security definer set search_path=public,extensions as $$
declare s jsonb; total numeric:=0; got numeric:=0; rf numeric:=0;
begin
 select d into s from jxc_docs where k='so' and id=p_so;
 if s is null then return 0; end if;
 if coalesce(s->>'status','draft') not in ('rejected','cancel','draft') then
  select coalesce(sum((i->>'qty')::numeric*(i->>'price')::numeric - coalesce((i->>'ret')::numeric,0)*(i->>'price')::numeric),0) into total from jsonb_array_elements(s->'items') i;
  if s->'frt'->>'payer'='cus' then total:=total+coalesce((s->'frt'->>'amt')::numeric,0); end if;
 end if;
 select coalesce(sum((d->>'amount')::numeric),0) into got from jxc_docs where k='fin' and d->>'type'='rcv' and d->>'ref'=p_so and d->>'status'='verified';
 select coalesce(sum((d->>'amount')::numeric),0) into rf from jxc_docs where k='refund' and d->>'so'=p_so and coalesce(d->>'status','') not in ('void','rejected') and id is distinct from p_except;
 return got-total-rf;
end $$;
revoke execute on function jxc_so_refundable(text,text) from public,anon,authenticated;

do $$ begin
 if to_regprocedure('jxc_flow_ok_v113_arap_base(jxc_users,text,jsonb,boolean,jsonb)') is null then
  alter function jxc_flow_ok(jxc_users,text,jsonb,boolean,jsonb) rename to jxc_flow_ok_v113_arap_base;
  alter function jxc_can_write(text,text,jsonb) rename to jxc_can_write_v113_arap_base;
  alter function jxc_doc_visible(jxc_users,text,jsonb) rename to jxc_doc_visible_v113_arap_base;
 end if;
end $$;
create or replace function jxc_can_write(r text,k text,d jsonb) returns boolean language sql immutable as $$
 select case when k='refund' then r in ('chair','gm','ops','acct','cashier') else jxc_can_write_v113_arap_base(r,k,d) end
$$;
create or replace function jxc_doc_visible(me jxc_users,k text,pdoc jsonb) returns boolean language sql stable as $$
 select case when k='refund' then me.role in ('chair','gm','ops','acct','cashier') else jxc_doc_visible_v113_arap_base(me,k,pdoc) end
$$;
create or replace function jxc_flow_ok(p_me jxc_users,p_k text,p_d jsonb,p_has boolean,p_od jsonb) returns boolean language plpgsql stable as $$
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
 big:=(p_od->>'amount')::numeric>2000;
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
grant execute on function jxc_can_write(text,text,jsonb),jxc_doc_visible(jxc_users,text,jsonb),jxc_flow_ok(jxc_users,text,jsonb,boolean,jsonb) to anon,authenticated;

select 'finance_refund_ready' status;

-- v1.13.0_chat_leave.sql
-- All active staff may view leave availability/status; reasons, comments and attachments stay private.

create or replace function jxc_leave_public_summary(p_token text) returns jsonb
language plpgsql security definer set search_path=public,extensions as $$
declare who jxc_users;result jsonb;begin
who:=jxc_me_row(p_token);
select coalesce(jsonb_agg(jsonb_build_object('id',id,'by',d->>'by','days',d->'days','startDate',d->>'startDate','endDate',d->>'endDate','session',d->>'session','status',d->>'status','t',d->'t') order by pending desc,updated_at desc),'[]'::jsonb) into result
from (select id,d,updated_at,(d->>'status'='submitted') pending from jxc_docs where k='leave' and (d->>'status'='submitted' or updated_at>now()-interval '90 days') order by (d->>'status'='submitted') desc,updated_at desc limit 200) visible;
return result;end $$;
revoke all on function jxc_leave_public_summary(text) from public;
grant execute on function jxc_leave_public_summary(text) to anon,authenticated,service_role;

select 'public_leave_summary_ready' status;

-- v1.14.0_language_off.sql
-- User canceled OpenAI and Azure language integration. No paid provider is enabled.

update jxc_language_settings set enabled=false where id;
do $$begin if to_regclass('public.jxc_azure_settings') is not null then execute 'update jxc_azure_settings set enabled=false where id';end if;end $$;

-- v1.14.0_integrity.sql
-- Operational controls. Apply after v1.13.0_finance_po.sql and v1.13.0_chat_leave.sql.

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

-- v1.14.1_settlement.sql

create or replace function jxc_order_paid(p_so text) returns numeric language sql stable as $$
select coalesce((select sum((d->>'amount')::numeric) from jxc_docs where k='fin' and d->>'type'='rcv' and coalesce(d->>'refKind','so')='so' and d->>'ref'=p_so and d->>'status'='verified'),0)
+coalesce((select sum((d->>'amount')::numeric) from jxc_docs where k='allocation' and d->>'target'=p_so),0)
-coalesce((select sum((d->>'amount')::numeric) from jxc_docs where k='allocation' and d->>'sourceKind'='so' and d->>'source'=p_so),0)
-coalesce((select sum((d->>'amount')::numeric) from jxc_docs where k='refund' and d->>'so'=p_so and d->>'status'='paid'),0) $$;
create or replace function jxc_customer_balance(p_cus text,p_include_pending boolean default true) returns numeric language sql stable as $$
select coalesce((select sum((d->>'amount')::numeric) from jxc_docs where k='fin' and d->>'type'='rcv' and d->>'refKind'='customer' and d->>'ref'=p_cus and d->>'status'='verified'),0)
-coalesce((select sum((d->>'amount')::numeric) from jxc_docs where k='allocation' and d->>'sourceKind'='customer' and d->>'source'=p_cus),0)
-coalesce((select sum((d->>'amount')::numeric) from jxc_docs where k='refund' and d->>'refKind'='customer' and d->>'cus'=p_cus and (d->>'status'='paid' or (p_include_pending and d->>'status' not in ('rejected','void')))),0) $$;
create or replace function jxc_so_refundable(p_so text,p_except text default null) returns numeric language plpgsql stable security definer set search_path=public,extensions as $$
declare s jsonb;total numeric:=0;pending numeric:=0;begin
select d into s from jxc_docs where k='so' and id=p_so;if s is null then return 0;end if;
if coalesce(s->>'status','draft') not in ('rejected','cancel','draft') then
 select coalesce(sum(((i->>'qty')::numeric-coalesce((i->>'ret')::numeric,0))*(i->>'price')::numeric),0) into total from jsonb_array_elements(s->'items') i;
 if s->'frt'->>'payer'='cus' then total:=total+coalesce((s->'frt'->>'amt')::numeric,0);end if;
end if;
select coalesce(sum((d->>'amount')::numeric),0) into pending from jxc_docs where k='refund' and d->>'so'=p_so and d->>'status' not in ('void','rejected','paid') and id is distinct from p_except;
return greatest(0,jxc_order_paid(p_so)-total-pending);end $$;
do $$ begin
if to_regprocedure('jxc_flow_ok_v1141_base(jxc_users,text,jsonb,boolean,jsonb)') is null then
 alter function jxc_flow_ok(jxc_users,text,jsonb,boolean,jsonb) rename to jxc_flow_ok_v1141_base;
 alter function jxc_can_write(text,text,jsonb) rename to jxc_can_write_v1141_base;
 alter function jxc_doc_visible(jxc_users,text,jsonb) rename to jxc_doc_visible_v1141_base;
end if;end $$;
create or replace function jxc_can_write(r text,k text,d jsonb) returns boolean language sql immutable as $$select case when k='allocation' then r in ('chair','acct') else jxc_can_write_v1141_base(r,k,d) end $$;
create or replace function jxc_doc_visible(me jxc_users,k text,pdoc jsonb) returns boolean language sql stable as $$select case when k='allocation' then me.role in ('chair','gm','ops','acct','cashier') else jxc_doc_visible_v1141_base(me,k,pdoc) end $$;
create or replace function jxc_flow_ok(p_me jxc_users,p_k text,p_d jsonb,p_has boolean,p_od jsonb) returns boolean language plpgsql stable as $$
declare r text:=p_me.role;amt numeric;target jsonb;source jsonb;open numeric;ns text:=p_d->>'status';os text:=p_od->>'status';big boolean;a jsonb;b jsonb;
begin
if p_k='allocation' then
 if p_has then return false;end if;
 amt:=(p_d->>'amount')::numeric;if r not in ('chair','acct') or amt<=0 or amt::text in ('NaN','Infinity','-Infinity') or p_d->>'by'<>p_me.id then return false;end if;
 select d into target from jxc_docs where k='so' and id=p_d->>'target';
 if target is null or target->>'cus' is distinct from p_d->>'cus' or target->>'status' not in ('submitted','credit_gm','approved','shipped','done') then return false;end if;
 select coalesce(sum(((i->>'qty')::numeric-coalesce((i->>'ret')::numeric,0))*(i->>'price')::numeric),0) into open from jsonb_array_elements(target->'items') i;
 if target->'frt'->>'payer'='cus' then open:=open+coalesce((target->'frt'->>'amt')::numeric,0);end if;
 if amt>open-jxc_order_paid(target->>'id')+0.005 then return false;end if;
 if p_d->>'sourceKind'='customer' then return p_d->>'source'=p_d->>'cus' and amt<=jxc_customer_balance(p_d->>'cus')+0.005;end if;
 select d into source from jxc_docs where k='so' and id=p_d->>'source';
 return p_d->>'sourceKind'='so' and source is not null and source->>'cus'=p_d->>'cus' and p_d->>'source'<>p_d->>'target' and amt<=jxc_so_refundable(p_d->>'source')+0.005;
end if;
if p_k='refund' and p_d->>'refKind'='customer' then
 amt:=(p_d->>'amount')::numeric;
 if not p_has then return r in ('chair','acct') and ns='req' and p_d->>'by'=p_me.id and amt>0 and amt::text not in ('NaN','Infinity','-Infinity') and amt<=jxc_customer_balance(p_d->>'cus')+0.005 and p_d->>'oby' is null and p_d->>'gby' is null and p_d->>'pby' is null and length(coalesce(p_d->>'reason',''))>=2;end if;
 if (p_d-array['status','oby','ot','onote','gby','gt','gnote','pby','pt','pref','method','u','_q']) is distinct from (p_od-array['status','oby','ot','onote','gby','gt','gnote','pby','pt','pref','method','u','_q']) then return false;end if;
 big:=(p_od->>'amount')::numeric>jxc_doc_limit(p_od);
 if ns='void' then return os in ('req','rejected') and p_od->>'by'=p_me.id and r in ('chair','acct');end if;
 if os='req' then return r in ('chair','ops') and p_od->>'by'<>p_me.id and (ns='rejected' or (p_d->>'oby'=p_me.id and ns=case when big then 'gm_pending' else 'approved' end));end if;
 if os='gm_pending' then return r in ('chair','gm') and p_od->>'by'<>p_me.id and p_od->>'oby' is not null and p_d->>'oby'=p_od->>'oby' and (ns='rejected' or ns='approved' and p_d->>'gby'=p_me.id);end if;
 return os='approved' and ns='paid' and r in ('chair','cashier') and p_od->>'oby' is not null and (not big or p_od->>'gby' is not null) and p_d->>'pby'=p_me.id and length(coalesce(p_d->>'pref',''))>=2;
end if;
-- Preserve legacy release checks while including allocations in the verified total.
if p_k='so' and p_has and ns='approved' and coalesce(p_od->>'pay','cash')<>'credit' then
 select coalesce(sum((i->>'qty')::numeric*(i->>'price')::numeric),0) into open from jsonb_array_elements(p_od->'items') i;
 if p_od->'frt'->>'payer'='cus' then open:=open+coalesce((p_od->'frt'->>'amt')::numeric,0);end if;
 if jxc_order_paid(p_d->>'id')+0.005<open then return false;end if;
 -- Delegate all unchanged states/fields; the inner legacy cash sum can only be smaller.
 a:=jsonb_set(p_d,'{pay}','"credit"');b:=jsonb_set(p_od,'{pay}','"credit"');
 if os='submitted' and p_me.role in ('chair','acct') then
  return (p_d-array['status','fin','u','_q'])=(p_od-array['status','fin','u','_q']) and p_d->'fin'->>'by'=p_me.id;
 end if;
 return jxc_flow_ok_v1141_base(p_me,p_k,a,p_has,b);
end if;
return jxc_flow_ok_v1141_base(p_me,p_k,p_d,p_has,p_od);
end $$;
-- Helpers contain financial data; callable only inside security-definer RPCs/triggers.
revoke all on function jxc_order_paid(text),jxc_customer_balance(text,boolean) from public,anon,authenticated;
create or replace function jxc_pull(p_token text,p_since bigint) returns jsonb
language plpgsql security definer set search_path=public,extensions as $$
declare me jxc_users; rows jsonb; maxseq bigint;
begin
 me:=jxc_me_row(p_token);
 select coalesce(jsonb_agg(jsonb_build_object('k',x.k,'d',case
  when x.k='so' then x.d||jsonb_build_object('paidVerified',jxc_order_paid(x.d->>'id'))
  when me.role in ('sales','field','keeper','clerk','cashier') and x.k='products' then x.d-array['cost']
  when me.role in ('sales','field','keeper','clerk','cashier') and x.k='moves' then x.d-array['uc','costAmount','revenue']
  else x.d end) order by x.seq) filter(where jxc_doc_visible(me,x.k,x.d)),'[]'),coalesce(max(x.seq),p_since)
 into rows,maxseq from (select k,d,seq from jxc_docs where seq>p_since order by seq limit 2000) x;
 -- Hidden financial rows still refresh visible order payment summaries for sales staff.
 rows:=rows||coalesce((select jsonb_agg(jsonb_build_object('k','so','d',s.d||jsonb_build_object('paidVerified',jxc_order_paid(s.id)))) from jxc_docs s where s.k='so' and jxc_doc_visible(me,s.k,s.d)
 and not exists(select 1 from jsonb_array_elements(rows) r where r->>'k'='so' and r->'d'->>'id'=s.id)
 and exists(select 1 from jxc_docs f where f.seq>p_since and f.seq<=maxseq and ((f.k='fin' and f.d->>'type'='rcv' and coalesce(f.d->>'refKind','so')='so' and f.d->>'ref'=s.id) or (f.k='refund' and f.d->>'so'=s.id) or (f.k='allocation' and (f.d->>'target'=s.id or f.d->>'sourceKind'='so' and f.d->>'source'=s.id))))),'[]'::jsonb);
 return jsonb_build_object('seq',maxseq,'rows',rows,'users',(select coalesce(jsonb_agg(jxc_user_json(u)),'[]') from jxc_users u));
end $$;

-- v1.14.2_invoices.sql

do $$ begin
if to_regprocedure('jxc_flow_ok_v1142_base(jxc_users,text,jsonb,boolean,jsonb)') is null then
 alter function jxc_flow_ok(jxc_users,text,jsonb,boolean,jsonb) rename to jxc_flow_ok_v1142_base;
 alter function jxc_can_write(text,text,jsonb) rename to jxc_can_write_v1142_base;
 alter function jxc_doc_visible(jxc_users,text,jsonb) rename to jxc_doc_visible_v1142_base;
end if;end $$;
create or replace function jxc_can_write(r text,k text,d jsonb) returns boolean language sql immutable as $$select case when k='invoice' then r in ('chair','acct','ops','gm') else jxc_can_write_v1142_base(r,k,d) end $$;
create or replace function jxc_doc_visible(me jxc_users,k text,pdoc jsonb) returns boolean language sql stable as $$select case when k='invoice' then me.role in ('chair','gm','ops','acct','cashier','buyer','clerk') else jxc_doc_visible_v1142_base(me,k,pdoc) end $$;
create or replace function jxc_flow_ok(p_me jxc_users,p_k text,p_d jsonb,p_has boolean,p_od jsonb) returns boolean language plpgsql stable as $$
declare r text:=p_me.role;ns text:=p_d->>'status';os text:=p_od->>'status';begin
if p_k='invoice' then
 if not p_has then return r in ('chair','acct') and ns='pending' and p_d->>'by'=p_me.id and p_d->>'kind'='purchase' and length(trim(coalesce(p_d->>'invoiceNo','')))>=2 and jsonb_array_length(p_d->'items')>0 and p_d->>'verifiedBy' is null and exists(select 1 from jxc_docs where k='po' and id=p_d->>'po' and d->>'sup'=p_d->>'sup');end if;
 return os='pending' and ns in ('matched','rejected') and r in ('chair','acct','ops','gm') and p_od->>'by'<>p_me.id and p_d->>'verifiedBy'=p_me.id and (p_d-array['status','verifiedBy','verifiedAt','rejectReason','u','_q'])=(p_od-array['status','verifiedBy','verifiedAt','rejectReason','u','_q']);
end if;
return jxc_flow_ok_v1142_base(p_me,p_k,p_d,p_has,p_od);end $$;
create unique index if not exists jxc_supplier_invoice_unique on jxc_docs((d->>'sup'),lower(trim(d->>'invoiceNo'))) where k='invoice' and d->>'kind'='purchase' and d->>'status' not in ('void','rejected');
create or replace function jxc_invoice_guard() returns trigger language plpgsql as $$
declare po jsonb;v_line jsonb;qty numeric;price numeric;received numeric;used numeric;allowed numeric;actual numeric;paid numeric;pending numeric;begin
perform pg_advisory_xact_lock(hashtext('jxc_push_business'));
if new.k='invoice' then
 select d into po from jxc_docs where k='po' and id=new.d->>'po';if po is null then raise exception 'Purchase order not found';end if;
 if (select count(*) from jsonb_array_elements(new.d->'items'))<>(select count(distinct x->>'pid') from jsonb_array_elements(new.d->'items') x) then raise exception 'Duplicate invoice product lines';end if;
 actual:=0;
 for v_line in select * from jsonb_array_elements(new.d->'items') loop
  qty:=(v_line->>'qty')::numeric;price:=(v_line->>'price')::numeric;
  if qty is null or price is null or qty<=0 or price<0 or qty::text in ('NaN','Infinity','-Infinity') or price::text in ('NaN','Infinity','-Infinity') then raise exception 'Invalid invoice quantity or price';end if;
  if not exists(select 1 from jsonb_array_elements(po->'items') p where p->>'pid'=v_line->>'pid' and abs((p->>'price')::numeric-price)<0.000001) then raise exception 'Invoice unit price differs from purchase order';end if;
  actual:=actual+qty*price;
  if new.d->>'status'='matched' then
   select coalesce(sum((m.d->>'qty')::numeric),0) into received from jxc_docs m join jxc_docs g on g.k='grn' and g.id=m.d->>'ref' where m.k='moves' and m.d->>'type'='po_in' and m.d->>'pid'=v_line->>'pid' and g.d->>'po'=new.d->>'po';
   select received-coalesce(sum(-(m.d->>'qty')::numeric),0) into received from jxc_docs m join jxc_docs pr on pr.k='pr' and pr.id=m.d->>'ref' join jxc_docs g on g.k='grn' and g.id=pr.d->>'grn' where m.k='moves' and m.d->>'type'='po_ret' and m.d->>'pid'=v_line->>'pid' and g.d->>'po'=new.d->>'po';
   select coalesce(sum((x->>'qty')::numeric),0) into used from jxc_docs inv cross join lateral jsonb_array_elements(inv.d->'items') x where inv.k='invoice' and inv.id<>new.id and inv.d->>'po'=new.d->>'po' and inv.d->>'status'='matched' and x->>'pid'=v_line->>'pid';
   select sum((x->>'qty')::numeric) into allowed from jsonb_array_elements(po->'items') x where x->>'pid'=v_line->>'pid';
   if qty+used>least(received,allowed)+0.000001 then raise exception 'Three-way match failed: invoice exceeds net received or ordered quantity';end if;
  end if;
 end loop;
 qty:=coalesce((new.d->>'fees')::numeric,0);if qty<0 or qty::text in ('NaN','Infinity','-Infinity') then raise exception 'Invalid invoice fees';end if;
 select coalesce(sum((x->>'amt')::numeric),0) into allowed from jsonb_array_elements(po->'fees') x;allowed:=allowed+coalesce((select sum((d->>'amt')::numeric) from jxc_docs where k='lcadj' and d->>'po'=new.d->>'po' and d->>'status'='approved'),0);
 select coalesce(sum((d->>'fees')::numeric),0) into used from jxc_docs where k='invoice' and id<>new.id and d->>'po'=new.d->>'po' and d->>'status'='matched';
 if qty+used>allowed+0.005 then raise exception 'Invoice fees exceed purchase order';end if;
 new.d:=new.d||jsonb_build_object('total',round(actual+qty,2),'matchMethod','PO_RECEIPT_INVOICE','verifiedAt',case when new.d->>'status'='matched' then floor(extract(epoch from now())*1000)::bigint else null end);
elsif new.k='fin' and new.d->>'type'='pay' and new.d->>'status' in ('req','gm_pending','approved','paid') then
 select d into po from jxc_docs where k='po' and id=new.d->>'ref';
 if po is null or po->>'status' in ('draft','cancel') then raise exception 'Cannot pay draft or cancelled purchase order';end if;
 select coalesce(sum((i->>'qty')::numeric*(i->>'price')::numeric),0) into allowed from jsonb_array_elements(po->'items') i;
 allowed:=allowed+coalesce((select sum((i->>'amt')::numeric) from jsonb_array_elements(po->'fees') i),0)+coalesce((select sum((d->>'amt')::numeric) from jxc_docs where k='lcadj' and d->>'po'=po->>'id' and d->>'status'='approved'),0);
 if po->>'status'='done' then select coalesce(sum((i->>'recv')::numeric*(i->>'price')::numeric),0)+coalesce((select sum((i->>'amt')::numeric) from jsonb_array_elements(po->'fees') i),0) into allowed from jsonb_array_elements(po->'items') i;end if;
 select coalesce(sum((d->>'amount')::numeric),0) into paid from jxc_docs where k='fin' and id<>new.id and d->>'type'='pay' and d->>'ref'=new.d->>'ref' and d->>'status' in ('req','gm_pending','approved','paid');
 paid:=paid-coalesce((select sum((d->>'amount')::numeric) from jxc_docs where k='fin' and d->>'type'='rcv' and d->>'refKind'='po' and d->>'ref'=new.d->>'ref' and d->>'status'='verified'),0);
 if paid+(new.d->>'amount')::numeric>allowed+0.005 then raise exception 'Payment exceeds purchase order balance';end if;
 if coalesce(new.d->>'purp','goods')<>'dep' and (new.d->>'invoicePolicy'='three-way' or (new.d->>'status'='paid' and (tg_op='INSERT' or old.d->>'status'<>'paid'))) then
  select coalesce(sum((d->>'total')::numeric),0) into actual from jxc_docs where k='invoice' and d->>'po'=new.d->>'ref' and d->>'status'='matched';
  actual:=least(actual,jxc_po_due(new.d->>'ref'));
  if paid+(new.d->>'amount')::numeric>actual+0.005 then raise exception 'Goods payment requires matched supplier invoice, receipt and purchase order';end if;
 end if;
end if;
return new;end $$;
drop trigger if exists jxc_invoice_guard_trigger on jxc_docs;
create trigger jxc_invoice_guard_trigger before insert or update on jxc_docs for each row when (new.k in ('invoice','fin')) execute function jxc_invoice_guard();

-- v1.14.3_fx_credit.sql

do $$ begin
if to_regprocedure('jxc_can_write_v1143_base(text,text,jsonb)') is null then
 alter function jxc_can_write(text,text,jsonb) rename to jxc_can_write_v1143_base;
 alter function jxc_doc_visible(jxc_users,text,jsonb) rename to jxc_doc_visible_v1143_base;
end if;end $$;
create or replace function jxc_can_write(r text,k text,d jsonb) returns boolean language sql immutable as $$select case when k in ('fxrate','credit_note') then false else jxc_can_write_v1143_base(r,k,d) end $$;
create or replace function jxc_doc_visible(me jxc_users,k text,pdoc jsonb) returns boolean language sql stable as $$select case when k='fxrate' then true when k='credit_note' then me.role in ('chair','gm','ops','acct','cashier','buyer','clerk') or (me.role in ('sales','field') and pdoc->>'kind'='sr' and exists(select 1 from jxc_docs s where s.k='so' and s.id=pdoc->>'source' and s.d->>'by'=me.id)) else jxc_doc_visible_v1143_base(me,k,pdoc) end $$;
create or replace function jxc_fx_rate(p_iso text,p_date date default current_date) returns jsonb language sql stable as $$
select d from jxc_docs where k='fxrate' and d->>'iso'=p_iso and d->>'base'=coalesce((select d->>'base' from jxc_docs where k='settings' and id='app'),'GHS') and (d->>'date')::date<=p_date order by d->>'date' desc limit 1 $$;
create or replace function jxc_fx_rate_set(p_token text,p_iso text,p_rate numeric,p_date date) returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare who jxc_users;base text;doc jsonb;did text;begin
who:=jxc_me_row(p_token);if who.role not in ('chair','gm','acct') or p_iso not in ('USD','CNY','GHS','EUR','GBP') or p_rate is null or p_rate<=0 or p_rate::text in ('NaN','Infinity','-Infinity') or p_date is null or p_date>(now() at time zone 'UTC')::date then raise exception 'Invalid FX rate or permission';end if;
perform pg_advisory_xact_lock(hashtext('jxc_push_business'));select coalesce(d->>'base','GHS') into base from jxc_docs where k='settings' and id='app';base:=coalesce(base,'GHS');if p_iso=base and p_rate<>1 then raise exception 'Base currency rate must be 1';end if;
did:=p_iso||'_'||base||'_'||p_date::text;doc:=jsonb_build_object('id',did,'iso',p_iso,'base',base,'rate',p_rate,'date',p_date,'by',who.id,'t',floor(extract(epoch from now())*1000)::bigint,'u',floor(extract(epoch from now())*1000)::bigint);
-- Published daily rates are immutable. A correction requires a new effective date.
if exists(select 1 from jxc_docs where k='fxrate' and id=did) then raise exception 'A rate for this date is already published';end if;
insert into jxc_docs(k,id,d,u,by_user) values('fxrate',did,doc,(doc->>'u')::bigint,who.id);
insert into jxc_audit(user_id,action,k,doc_id,detail) values(who.id,'publish_rate','fxrate',did,jsonb_build_object('iso',p_iso,'rate',p_rate,'date',p_date));return doc;end $$;
revoke all on function jxc_fx_rate_set(text,text,numeric,date) from public;
grant execute on function jxc_fx_rate_set(text,text,numeric,date) to anon,authenticated;
create or replace function jxc_fx_guard() returns trigger language plpgsql as $$
declare fx jsonb;doc jsonb;i jsonb;line jsonb;items jsonb:='[]';base text;rate numeric;native numeric;begin
base:=coalesce((select d->>'base' from jxc_docs where k='settings' and id='app'),'GHS');
if new.k='po' then
 if tg_op='UPDATE' and old.d->>'status'<>'draft' then
  if (new.d-array['items','fees','status','closed','u','_q','no','t','currency','serverCreated']) is distinct from (old.d-array['items','fees','status','closed','u','_q','no','t','currency','serverCreated']) then
   if new.d->'fx' is distinct from old.d->'fx' or new.d->'originalCurrency' is distinct from old.d->'originalCurrency' then raise exception 'Document FX snapshot is immutable';end if;
  end if;
  return new;
 end if;
 if coalesce(new.d->>'originalCurrency',base)<>base then
  fx:=jxc_fx_rate(new.d->>'originalCurrency');if fx is null then raise exception 'Publish a central FX rate before using a foreign currency';end if;rate:=(fx->>'rate')::numeric;
  for i in select * from jsonb_array_elements(new.d->'items') loop
   native:=(i->>'originalPrice')::numeric;if native is null or native<0 or native::text in ('NaN','Infinity','-Infinity') then raise exception 'Original currency unit price is required';end if;
   -- Client preview must agree; users review the rate before committing a document.
   if abs((i->>'price')::numeric-round(native*rate,8))>0.000001 then raise exception 'FX rate changed: reload and confirm converted prices';end if;
   items:=items||jsonb_build_array(i||jsonb_build_object('price',round(native*rate,8)));
  end loop;
  new.d:=new.d||jsonb_build_object('fx',jsonb_build_object('rateId',fx->>'id','rate',rate,'date',fx->>'date','base',base,'iso',new.d->>'originalCurrency'),'items',items);
 else new.d:=new.d-'fx';end if;
elsif new.k='fin' and ((new.d->>'type'='pay' and new.d->>'status'='paid') or (new.d->>'type'='rcv' and new.d->>'refKind'='po' and new.d->>'status'='verified')) then
 if tg_op='UPDATE' and old.d->>'status' in ('paid','verified') then new.d:=old.d;return new;end if;
 select d into doc from jxc_docs where k='po' and id=new.d->>'ref';
 if doc->'fx' is not null then
  fx:=jxc_fx_rate(doc->>'originalCurrency');if fx is null then raise exception 'Settlement FX rate is missing';end if;
  rate:=(fx->>'rate')::numeric;native:=round((new.d->>'amount')::numeric/(doc->'fx'->>'rate')::numeric,8);
  new.d:=new.d||jsonb_build_object('originalCurrency',doc->>'originalCurrency','nativeAmount',native,'settlementFx',fx,'cashAmountBase',round(native*rate,2),'fxLoss',round((native*rate-(new.d->>'amount')::numeric)*case when new.d->>'type'='rcv' then -1 else 1 end,2));
 else new.d:=new.d||jsonb_build_object('cashAmountBase',(new.d->>'amount')::numeric,'fxLoss',0);end if;
end if;
return new;end $$;
drop trigger if exists jxc_01_fx on jxc_docs;
create trigger jxc_01_fx before insert or update on jxc_docs for each row when (new.k in ('po','fin')) execute function jxc_fx_guard();
create or replace function jxc_return_credit_note() returns trigger language plpgsql security definer set search_path=public,extensions as $$
declare source jsonb;po jsonb;total numeric;did text;doc jsonb;line jsonb;posted numeric;begin
if new.k not in ('sr','pr') or new.d->>'status'<>'done' or (tg_op='UPDATE' and old.d->>'status'='done') then return new;end if;
for line in select jsonb_build_object('pid',i->>'pid','qty',sum((i->>'qty')::numeric)) from jsonb_array_elements(new.d->'items') i group by i->>'pid' loop
 select coalesce(sum(abs((d->>'qty')::numeric)),0) into posted from jxc_docs where k='moves' and d->>'ref'=new.id and d->>'pid'=line->>'pid' and d->>'type'=case when new.k='sr' then 'so_ret' else 'po_ret' end;
 if abs(posted-(line->>'qty')::numeric)>0.000001 then raise exception 'Return stock postings are incomplete';end if;
end loop;
if new.k='sr' then
 select d into source from jxc_docs where k='so' and id=new.d->>'so';
 select coalesce(sum((d->>'revenue')::numeric),0) into total from jxc_docs where k='moves' and d->>'type'='so_ret' and d->>'ref'=new.id;
else
 select d into source from jxc_docs where k='grn' and id=new.d->>'grn';select d into po from jxc_docs where k='po' and id=source->>'po';
 select coalesce(sum(-(m.d->>'qty')::numeric*(i->>'price')::numeric),0) into total from jxc_docs m cross join lateral jsonb_array_elements(po->'items') i where m.k='moves' and m.d->>'type'='po_ret' and m.d->>'ref'=new.id and m.d->>'pid'=i->>'pid';
end if;
if total<0 or not exists(select 1 from jxc_docs where k='moves' and d->>'ref'=new.id and d->>'type'=case when new.k='sr' then 'so_ret' else 'po_ret' end) then raise exception 'Return credit note requires completed stock postings';end if;
did:='CN_'||new.id;doc:=jsonb_build_object('id',did,'kind',new.k,'returnId',new.id,'source',case when new.k='sr' then new.d->>'so' else source->>'po' end,'amount',-total,'currency',coalesce(po->>'currency',source->>'currency','GHS'),'t',floor(extract(epoch from now())*1000)::bigint,'by',new.by_user,'status','posted','no','CN_'||coalesce(new.d->>'no',new.id));
insert into jxc_docs(k,id,d,u,by_user) values('credit_note',did,doc,(doc->>'t')::bigint,new.by_user);
if new.k='sr' then
 update jxc_docs so set d=jsonb_set(so.d,'{items}',(select jsonb_agg(i||jsonb_build_object('ret',coalesce((select sum((m.d->>'qty')::numeric) from jxc_docs m join jxc_docs r on r.k='sr' and r.id=m.d->>'ref' where m.k='moves' and m.d->>'type'='so_ret' and r.d->>'so'=so.id and m.d->>'pid'=i->>'pid'),0)) order by n) from jsonb_array_elements(so.d->'items') with ordinality a(i,n))),seq=nextval('jxc_seq'),updated_at=now(),by_user=new.by_user where so.k='so' and so.id=new.d->>'so';
end if;
insert into jxc_audit(user_id,action,k,doc_id,detail) values(new.by_user,'return_credit','credit_note',did,jsonb_build_object('return',new.id,'amount',-total));return new;end $$;
drop trigger if exists jxc_return_credit_note_trigger on jxc_docs;
create trigger jxc_return_credit_note_trigger after insert or update on jxc_docs for each row when (new.k in ('sr','pr')) execute function jxc_return_credit_note();
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
  select coalesce(sum(greatest(0,(select coalesce(sum(((i->>'qty')::numeric-coalesce((i->>'ret')::numeric,0))*(i->>'price')::numeric),0) from jsonb_array_elements(s.d->'items') i)
   -jxc_order_paid(s.id))),0)
   into exposure from jxc_docs s where s.k='so' and s.id<>new.id and s.d->>'cus'=new.d->>'cus' and s.d->>'status' in ('submitted','credit_gm','approved','shipped','done');
  if new.d->'frt'->>'payer'='cus' then amount:=amount+coalesce((new.d->'frt'->>'amt')::numeric,0);end if;
  if exposure+greatest(0,amount-jxc_order_paid(new.id))>limit_amt+0.005 then raise exception 'Customer credit limit exceeded'; end if;
 end if;
 return new;
end $$;

-- v1.14.4_payment_caps.sql

create or replace function jxc_po_due(p_po text) returns numeric language plpgsql stable as $$
declare po jsonb;goods numeric;received numeric;returns numeric;fees numeric;lc numeric;begin
select d into po from jxc_docs where k='po' and id=p_po;if po is null then return 0;end if;
select coalesce(sum((m.d->>'qty')::numeric*(i->>'price')::numeric),0) into goods from jxc_docs m join jxc_docs g on g.k='grn' and g.id=m.d->>'ref' cross join lateral jsonb_array_elements(po->'items') i where m.k='moves' and m.d->>'type'='po_in' and g.d->>'po'=p_po and m.d->>'pid'=i->>'pid';
select coalesce(sum(-(m.d->>'qty')::numeric*(i->>'price')::numeric),0) into returns from jxc_docs m join jxc_docs pr on pr.k='pr' and pr.id=m.d->>'ref' join jxc_docs g on g.k='grn' and g.id=pr.d->>'grn' cross join lateral jsonb_array_elements(po->'items') i where m.k='moves' and m.d->>'type'='po_ret' and g.d->>'po'=p_po and m.d->>'pid'=i->>'pid';
select coalesce(sum((i->>'amt')::numeric),0) into fees from jsonb_array_elements(po->'fees') i;
select coalesce(sum((d->>'amt')::numeric),0) into lc from jxc_docs where k='lcadj' and d->>'po'=p_po and d->>'status'='approved';
return greatest(0,goods-returns+case when goods>0 then fees else 0 end+lc);end $$;
create or replace function jxc_supplier_refund_guard() returns trigger language plpgsql as $$
declare paid numeric;received numeric;begin
if new.k<>'fin' or new.d->>'type'<>'rcv' or new.d->>'refKind'<>'po' or new.d->>'status'='void' then return new;end if;
perform pg_advisory_xact_lock(hashtext('jxc_push_business'));
select coalesce(sum((d->>'amount')::numeric),0) into paid from jxc_docs where k='fin' and d->>'type'='pay' and d->>'ref'=new.d->>'ref' and d->>'status'='paid';
select coalesce(sum((d->>'amount')::numeric),0) into received from jxc_docs where k='fin' and id<>new.id and d->>'type'='rcv' and d->>'refKind'='po' and d->>'ref'=new.d->>'ref' and d->>'status'<>'void';
if (new.d->>'amount')::numeric+received>paid-jxc_po_due(new.d->>'ref')+0.005 then raise exception 'Supplier refund exceeds recoverable advance or return balance';end if;
return new;end $$;
drop trigger if exists jxc_supplier_refund_guard_trigger on jxc_docs;
create trigger jxc_supplier_refund_guard_trigger before insert or update on jxc_docs for each row when (new.k='fin') execute function jxc_supplier_refund_guard();
revoke all on function jxc_po_due(text) from public,anon,authenticated;

commit;
