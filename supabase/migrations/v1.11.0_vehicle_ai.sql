begin;
create table if not exists jxc_vehicle_ai_requests(
 id text primary key,user_id text not null references jxc_users(id),image_hash text not null,
 status text not null check(status in ('pending','ready','failed')),result jsonb,
 created_at timestamptz not null default now(),finished_at timestamptz
);
create index if not exists jxc_vehicle_ai_user_day on jxc_vehicle_ai_requests(user_id,created_at);
alter table jxc_vehicle_ai_requests enable row level security;
revoke all on jxc_vehicle_ai_requests from public,anon,authenticated;
grant all on jxc_vehicle_ai_requests to service_role;
create or replace function jxc_vehicle_ai_identity(p_token text) returns text
language plpgsql security definer set search_path=public,extensions as $$
declare u jxc_users;begin
 u:=jxc_me_row(p_token);
 if u.role not in ('chair','gm','ops','buyer','clerk','keeper') then raise exception 'Vehicle recognition permission denied';end if;
 return u.id;
end $$;
create or replace function jxc_vehicle_ai_reserve(p_token text,p_hash text,p_id text,p_force boolean default false) returns jsonb
language plpgsql security definer set search_path=public,extensions as $$
declare who text;r jxc_vehicle_ai_requests;
begin
 who:=jxc_vehicle_ai_identity(p_token);
 if p_hash !~ '^[a-f0-9]{64}$' or p_id !~ '^[A-Za-z0-9_-]{10,80}$' then raise exception 'Invalid recognition request';end if;
 perform pg_advisory_xact_lock(hashtext('jxc_vehicle_ai_budget'));
 select * into r from jxc_vehicle_ai_requests where id=p_id;
 if found then
  if r.user_id<>who or r.image_hash<>p_hash then raise exception 'Recognition request conflict';end if;
  if r.status='ready' then return jsonb_build_object('cached',true,'result',r.result,'userId',who);end if;
  return jsonb_build_object('busy',true);
 end if;
 if not p_force then
  select * into r from jxc_vehicle_ai_requests where user_id=who and image_hash=p_hash and status='ready' and created_at>now()-interval '1 day' order by created_at desc limit 1;
  if found then return jsonb_build_object('cached',true,'result',r.result,'userId',who);end if;
 end if;
 if exists(select 1 from jxc_vehicle_ai_requests where user_id=who and status='pending' and created_at>now()-interval '2 minutes') then return jsonb_build_object('busy',true);end if;
 if (select count(*) from jxc_vehicle_ai_requests where user_id=who and created_at>=date_trunc('day',now()))>=30 or (select count(*) from jxc_vehicle_ai_requests where created_at>=date_trunc('day',now()))>=100 then return jsonb_build_object('limited',true);end if;
 insert into jxc_vehicle_ai_requests(id,user_id,image_hash,status) values(p_id,who,p_hash,'pending');
 return jsonb_build_object('userId',who,'requestId',p_id);
end $$;
create or replace function jxc_vehicle_ai_finish(p_id text,p_user text,p_result jsonb,p_ok boolean) returns void
language plpgsql security definer set search_path=public,extensions as $$
begin
 if p_result is not null and (jsonb_typeof(p_result)<>'object' or octet_length(p_result::text)>20000) then raise exception 'Invalid recognition result';end if;
 update jxc_vehicle_ai_requests set status=case when p_ok then 'ready' else 'failed' end,result=case when p_ok then p_result else null end,finished_at=now() where id=p_id and user_id=p_user and status='pending';
end $$;
revoke all on function jxc_vehicle_ai_identity(text),jxc_vehicle_ai_reserve(text,text,text,boolean),jxc_vehicle_ai_finish(text,text,jsonb,boolean) from public,anon,authenticated;
grant execute on function jxc_vehicle_ai_identity(text),jxc_vehicle_ai_reserve(text,text,text,boolean),jxc_vehicle_ai_finish(text,text,jsonb,boolean) to service_role;
commit;
select 'vehicle_ai_quota_ready' status;
