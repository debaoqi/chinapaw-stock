-- 财务修正第三批：客户退款单（refund）
-- 前提：已执行到 v1.12.0（建议先执行 v1.13.0_finance_po.sql）。可重复执行。不改动已有单据。
-- 流程与采购付款一致：会计申请 → 运营经理审批 →（金额 > 2000）总经理审批 → 出纳付款；会计可撤回未批准的申请。
-- 退款金额不能超过该销售单的“可退金额”= 已核对收款 − 该单应收（被驳回 / 取消 / 草稿的单应收为 0，已扣退货）− 其他未作废、未驳回的退款。
begin;

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
commit;
select 'finance_refund_ready' status;
