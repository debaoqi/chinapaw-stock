-- 财务修正第二批：采购单锁定 + 入库后补录采购费用（lcadj）
-- 前提：已执行到 v1.12.0。可重复执行。不修改库存成本引擎（jxc_guard_stock），不改动已有单据。
begin;

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
commit;
select 'finance_po_lock_ready' status;
