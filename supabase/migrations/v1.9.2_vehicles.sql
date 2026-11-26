begin;
do $$ begin
 if to_regprocedure('jxc_flow_ok_v192_base(jxc_users,text,jsonb,boolean,jsonb)') is null then
  alter function jxc_flow_ok(jxc_users,text,jsonb,boolean,jsonb) rename to jxc_flow_ok_v192_base;
  alter function jxc_can_write(text,text,jsonb) rename to jxc_can_write_v192_base;
  alter function jxc_doc_visible(jxc_users,text,jsonb) rename to jxc_doc_visible_v192_base;
 end if;
end $$;
create or replace function jxc_can_write(p_role text,p_k text,p_d jsonb) returns boolean language sql immutable as $$
 select case when p_k='vehicle' then p_role in ('chair','gm','ops','buyer','clerk','keeper') else jxc_can_write_v192_base(p_role,p_k,p_d) end
$$;
create or replace function jxc_doc_visible(me jxc_users,k text,pdoc jsonb) returns boolean language sql stable as $$
 select case when k='vehicle' then me.role in ('chair','gm','ops','buyer','clerk','keeper','acct') else jxc_doc_visible_v192_base(me,k,pdoc) end
$$;
create or replace function jxc_flow_ok(p_me jxc_users,p_k text,p_d jsonb,p_has boolean,p_od jsonb) returns boolean language plpgsql stable as $$
declare field text;
begin
 if p_k<>'vehicle' then return jxc_flow_ok_v192_base(p_me,p_k,p_d,p_has,p_od);end if;
 if p_me.role not in ('chair','gm','ops','buyer','clerk','keeper') or p_d->>'by'<>p_me.id or p_d->>'status'<>'saved' then return false;end if;
 if p_has and (p_od-array['u','_q']) is distinct from (p_d-array['u','_q']) then return false;end if;
 foreach field in array array['model','vin','motor','configuration','color','date','vehicleCode','photo'] loop
  if nullif(btrim(p_d->>field),'') is null or length(p_d->>field)>(case when field='photo' then 1800000 else 500 end) then return false;end if;
 end loop;
 if p_d->>'vin' !~ '^[A-Z0-9]{17}$' or p_d->>'motor' !~ '^[A-Z0-9-]{3,64}$' or p_d->>'vehicleCode' !~ '^[A-Z0-9-]{3,64}$' or p_d->>'date' !~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}$' or p_d->>'reviewedBy'<>p_me.id then return false;end if;
 perform (p_d->>'date')::date;
 return true;
end $$;
create unique index if not exists jxc_vehicle_vin_unique on jxc_docs((d->>'vin')) where k='vehicle' and d->>'status'='saved';
create or replace function jxc_vehicle_intake_guard() returns trigger language plpgsql as $$
declare vehicle jsonb;item jsonb;vid text:=new.d->>'vehicleId';
begin
 if tg_op='UPDATE' and old.d->>'vehicleId' is not null and old.d->>'vehicleId' is distinct from vid then raise exception 'Vehicle intake link cannot change';end if;
 if vid is null then return new;end if;
 select d into vehicle from jxc_docs where k='vehicle' and id=vid;
 if vehicle is null or vehicle->>'status'<>'saved' then raise exception 'Reviewed vehicle archive required';end if;
 if jsonb_array_length(new.d->'items')<>1 then raise exception 'One vehicle per intake document';end if;
 item:=new.d->'items'->0;
 if (item->>'qty')::numeric<>1 or item->>'batch'<>vehicle->>'vin' then raise exception 'Vehicle quantity or batch does not match archive';end if;
 if nullif(vehicle->>'productId','') is not null and item->>'pid'<>vehicle->>'productId' then raise exception 'Vehicle product does not match archive';end if;
 if exists(select 1 from jxc_docs where k in ('grn','stockreq') and id<>new.id and d->>'vehicleId'=vid and d->>'status'<>'rejected') then raise exception 'Vehicle already has an intake request';end if;
 return new;
end $$;
drop trigger if exists jxc_vehicle_intake_guard_trigger on jxc_docs;
create trigger jxc_vehicle_intake_guard_trigger before insert or update on jxc_docs for each row when (new.k in ('grn','stockreq')) execute function jxc_vehicle_intake_guard();
commit;
select 'vehicle_archive_ready' status;
