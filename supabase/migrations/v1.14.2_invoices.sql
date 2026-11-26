begin;
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
commit;
