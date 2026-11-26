begin;
do $$ begin
 if to_regprocedure('jxc_flow_ok_v110_profile_base(jxc_users,text,jsonb,boolean,jsonb)') is null then
  alter function jxc_flow_ok(jxc_users,text,jsonb,boolean,jsonb) rename to jxc_flow_ok_v110_profile_base;
  alter function jxc_can_write(text,text,jsonb) rename to jxc_can_write_v110_profile_base;
  alter function jxc_doc_visible(jxc_users,text,jsonb) rename to jxc_doc_visible_v110_profile_base;
 end if;
end $$;
create or replace function jxc_can_write(p_role text,p_k text,p_d jsonb) returns boolean language sql immutable as $$
 select case when p_k='profile' then true else jxc_can_write_v110_profile_base(p_role,p_k,p_d) end
$$;
create or replace function jxc_doc_visible(me jxc_users,k text,pdoc jsonb) returns boolean language sql stable as $$
 select case when k='profile' then true else jxc_doc_visible_v110_profile_base(me,k,pdoc) end
$$;
create or replace function jxc_flow_ok(p_me jxc_users,p_k text,p_d jsonb,p_has boolean,p_od jsonb) returns boolean language plpgsql stable as $$
declare photo text:=coalesce(p_d->>'photo','');
begin
 if p_k<>'profile' then return jxc_flow_ok_v110_profile_base(p_me,p_k,p_d,p_has,p_od);end if;
 if p_d->>'id' is distinct from p_me.id or p_d->>'userId' is distinct from p_me.id or p_d->>'by' is distinct from p_me.id then return false;end if;
 if (p_d-array['id','userId','by','t','u','_q','photo','emoji'])<>'{}'::jsonb or length(photo)>180000 or length(coalesce(p_d->>'emoji',''))>24 then return false;end if;
 if photo<>'' and photo !~ '^data:image/(jpeg|png|webp|gif);base64,[A-Za-z0-9+/=]+$' and photo not like 'https://vctokfjzgjtvsqftadeh.supabase.co/storage/v1/object/public/media/%' then return false;end if;
 return not p_has or p_od->>'userId'=p_me.id;
end $$;
commit;
select 'personal_avatars_ready' status;
