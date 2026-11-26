begin;
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
