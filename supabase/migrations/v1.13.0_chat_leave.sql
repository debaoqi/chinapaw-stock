-- All active staff may view leave availability/status; reasons, comments and attachments stay private.
begin;
create or replace function jxc_leave_public_summary(p_token text) returns jsonb
language plpgsql security definer set search_path=public,extensions as $$
declare who jxc_users;result jsonb;begin
who:=jxc_me_row(p_token);
select coalesce(jsonb_agg(jsonb_build_object('id',id,'by',d->>'by','days',d->'days','startDate',d->>'startDate','endDate',d->>'endDate','session',d->>'session','status',d->>'status','t',d->'t') order by pending desc,updated_at desc),'[]'::jsonb) into result
from (select id,d,updated_at,(d->>'status'='submitted') pending from jxc_docs where k='leave' and (d->>'status'='submitted' or updated_at>now()-interval '90 days') order by (d->>'status'='submitted') desc,updated_at desc limit 200) visible;
return result;end $$;
revoke all on function jxc_leave_public_summary(text) from public;
grant execute on function jxc_leave_public_summary(text) to anon,authenticated,service_role;
commit;
select 'public_leave_summary_ready' status;
