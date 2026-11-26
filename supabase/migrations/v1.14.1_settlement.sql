begin;
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
commit;
