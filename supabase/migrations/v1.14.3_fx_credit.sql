begin;
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
commit;
