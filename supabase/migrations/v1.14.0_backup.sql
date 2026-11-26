-- Private, one-time pre-upgrade snapshot. No account/password copies and no business row edits.
begin;
create schema if not exists jxc_backup_20261126_v114;
create table if not exists jxc_backup_20261126_v114.docs as table public.jxc_docs;
create table if not exists jxc_backup_20261126_v114.functions as
select p.oid::regprocedure::text as signature,pg_get_functiondef(p.oid) as definition
from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'jxc_%' and p.prokind='f';
alter table jxc_backup_20261126_v114.docs enable row level security;
alter table jxc_backup_20261126_v114.functions enable row level security;
revoke all on schema jxc_backup_20261126_v114 from public,anon,authenticated;
revoke all on all tables in schema jxc_backup_20261126_v114 from public,anon,authenticated;
commit;
