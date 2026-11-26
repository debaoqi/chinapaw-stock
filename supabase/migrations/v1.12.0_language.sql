begin;
create table if not exists jxc_language_settings(id boolean primary key default true check(id),enabled boolean not null default false,monthly_budget_usd numeric(12,4) not null default 0 check(monthly_budget_usd>=0));
insert into jxc_language_settings(id) values(true) on conflict do nothing;
create table if not exists jxc_language_requests(id text primary key,user_id text not null references jxc_users(id),action text not null check(action in ('transcribe','translate')),input_hash text not null,status text not null check(status in ('pending','ready','failed')),reserved_usd numeric(12,4) not null,result jsonb,created_at timestamptz not null default now(),finished_at timestamptz);
create index if not exists jxc_language_budget_month on jxc_language_requests(created_at);
alter table jxc_language_settings enable row level security;alter table jxc_language_requests enable row level security;
revoke all on jxc_language_settings,jxc_language_requests from public,anon,authenticated;
grant all on jxc_language_settings,jxc_language_requests to service_role;
create or replace function jxc_language_status(p_token text) returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare who jxc_users;cfg jxc_language_settings;begin who:=jxc_me_row(p_token);select * into cfg from jxc_language_settings where id;
return jsonb_build_object('enabled',coalesce(cfg.enabled,false),'budgetReady',coalesce(cfg.monthly_budget_usd>0,false));end $$;
create or replace function jxc_language_reserve(p_token text,p_id text,p_action text,p_hash text) returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare who jxc_users;cfg jxc_language_settings;r jxc_language_requests;cost numeric;spent numeric;begin
who:=jxc_me_row(p_token);
if p_id is null or p_id !~ '^[A-Za-z0-9_-]{10,80}$' or p_hash is null or p_hash !~ '^[a-f0-9]{64}$' or p_action is null or p_action not in ('transcribe','translate') then raise exception 'Invalid language request';end if;
perform pg_advisory_xact_lock(hashtext('jxc_language_budget'));
select * into cfg from jxc_language_settings where id;if not coalesce(cfg.enabled,false) or coalesce(cfg.monthly_budget_usd,0)<=0 then return jsonb_build_object('disabled',true);end if;
select * into r from jxc_language_requests where id=p_id;
if found then if r.user_id<>who.id or r.action<>p_action or r.input_hash<>p_hash then raise exception 'Language request conflict';end if;
if r.status='ready' then return jsonb_build_object('cached',true,'result',r.result);end if;return jsonb_build_object('busy',true);end if;
select * into r from jxc_language_requests where user_id=who.id and action=p_action and input_hash=p_hash and status='ready' and created_at>now()-interval '7 days' order by created_at desc limit 1;
if found then return jsonb_build_object('cached',true,'result',r.result);end if;
if exists(select 1 from jxc_language_requests where user_id=who.id and action=p_action and input_hash=p_hash and status='pending' and created_at>now()-interval '2 minutes') then return jsonb_build_object('busy',true);end if;
if (select count(*) from jxc_language_requests where user_id=who.id and created_at>now()-interval '1 minute')>=12 then return jsonb_build_object('limited',true);end if;
-- Conservative reservation, not an invoice: fixed models and server-validated input/output limits.
-- GPT-Transcribe <=65 seconds; GPT-6.1 Terra <=2000 characters and <=8192 output tokens.
cost:=case when p_action='transcribe' then .0100 else .0800 end;
select coalesce(sum(reserved_usd),0) into spent from jxc_language_requests where created_at>=date_trunc('month',now());
if spent+cost>cfg.monthly_budget_usd then return jsonb_build_object('budget',true);end if;
insert into jxc_language_requests(id,user_id,action,input_hash,status,reserved_usd) values(p_id,who.id,p_action,p_hash,'pending',cost);
return jsonb_build_object('requestId',p_id,'userId',who.id);end $$;
create or replace function jxc_language_finish(p_id text,p_user text,p_result jsonb,p_ok boolean) returns void language plpgsql security definer set search_path=public,extensions as $$
begin if p_result is not null and (jsonb_typeof(p_result)<>'object' or octet_length(p_result::text)>80000) then raise exception 'Invalid language result';end if;
update jxc_language_requests set status=case when p_ok then 'ready' else 'failed' end,result=case when p_ok then p_result else null end,finished_at=now() where id=p_id and user_id=p_user and status='pending';end $$;
revoke all on function jxc_language_status(text),jxc_language_reserve(text,text,text,text),jxc_language_finish(text,text,jsonb,boolean) from public,anon,authenticated;
grant execute on function jxc_language_status(text),jxc_language_reserve(text,text,text,text),jxc_language_finish(text,text,jsonb,boolean) to service_role;
commit;
select 'language_service_installed_disabled' status;
