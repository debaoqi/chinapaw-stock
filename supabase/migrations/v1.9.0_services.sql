begin;
create schema if not exists jxc_operational_backups;
revoke all on schema jxc_operational_backups from public,anon,authenticated;
create table if not exists jxc_operational_backups.snapshots(
 day date primary key,created_at timestamptz not null default now(),
 docs jsonb not null,users jsonb not null,audit jsonb not null
);
alter table jxc_operational_backups.snapshots enable row level security;
revoke all on jxc_operational_backups.snapshots from public,anon,authenticated;
create or replace function jxc_operational_daily_backup() returns void
language plpgsql security definer set search_path=public,extensions as $$
begin
 insert into jxc_operational_backups.snapshots(day,docs,users,audit)
 select current_date,
  coalesce((select jsonb_agg(x) from public.jxc_docs x),'[]'),
  coalesce((select jsonb_agg(x) from public.jxc_users x),'[]'),
  coalesce((select jsonb_agg(x) from public.jxc_audit x),'[]')
 on conflict(day) do nothing;
end $$;
revoke all on function jxc_operational_daily_backup() from public,anon,authenticated;
select jxc_operational_daily_backup();
do $$ begin
 if to_regnamespace('cron') is not null then
  if not exists(select 1 from cron.job where jobname='huabao-operational-daily-backup') then
   perform cron.schedule('huabao-operational-daily-backup','0 2 * * *','select public.jxc_operational_daily_backup();');
  end if;
 end if;
end $$;

create or replace function jxc_queue_operational_push() returns trigger
language plpgsql security definer set search_path=public,extensions as $$
declare roles text[]:=array[]::text[];targets text[];st text:=new.d->>'status';applicant text;
begin
 if tg_op='UPDATE' and st is not distinct from old.d->>'status' then return new;end if;
 if new.k='leave' then
  if st='submitted' then roles:=case when (new.d->>'days')::numeric<=2 then array['ops'] else array['gm'] end;
  else applicant:=new.d->>'by';end if;
 elsif new.k in ('stockreq','transfer') then
  roles:=case st when 'pending' then array['ops'] when 'approved' then array['keeper'] when 'transit' then array['keeper'] else array[]::text[] end;
  if st in ('done','rejected') then applicant:=new.d->>'by';end if;
 elsif new.k='receipt' then
  select d->>'by' into applicant from public.jxc_docs where k='so' and id=new.d->>'so';
 end if;
 select array_agg(id) into targets from public.jxc_users where active and id is distinct from new.by_user and (role=any(roles) or id=applicant);
 if coalesce(array_length(targets,1),0)>0 then
  insert into public.jxc_push_events(event_key,recipients,body) values(new.k||':'||new.id||':'||new.seq,targets,'您有新的审批或业务状态提醒，请打开华宝进销存查看') on conflict(event_key) do nothing;
 end if;
 return new;
end $$;
drop trigger if exists jxc_queue_operational_push_trigger on public.jxc_docs;
create trigger jxc_queue_operational_push_trigger after insert or update on public.jxc_docs
 for each row when (new.k in ('leave','stockreq','transfer','receipt')) execute function jxc_queue_operational_push();
commit;
