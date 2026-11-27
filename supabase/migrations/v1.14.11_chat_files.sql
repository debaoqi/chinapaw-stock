begin;
create table if not exists jxc_chat_files(id text primary key default gen_random_uuid()::text, owner_id text not null, ch text not null, name text not null, mime text not null, bytes bytea not null, created_at timestamptz not null default now(),check(octet_length(bytes) between 1 and 10485760));
alter table jxc_chat_files enable row level security;
revoke all on jxc_chat_files from public,anon,authenticated;
create index if not exists jxc_chat_files_owner_date on jxc_chat_files(owner_id,created_at);
create or replace function jxc_file_upload(p_token text,p_ch text,p_name text,p_type text,p_data text) returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare me jxc_users; c jsonb; f jxc_chat_files; raw bytea;begin
me:=jxc_me_row(p_token);
select d into c from jxc_docs where k='chat' and id=p_ch;
if p_ch<>'C_all' and (c is null or not coalesce(jxc_doc_visible(me,'chat',c),false)) then raise exception 'Chat access denied';end if;
if p_data is null or length(p_data)>13981016 or length(trim(coalesce(p_name,''))) not between 1 and 240 then raise exception 'File limit: 10MB';end if;
raw:=decode(p_data,'base64');if octet_length(raw) not between 1 and 10485760 then raise exception 'File limit: 10MB';end if;
perform pg_advisory_xact_lock(hashtext('chat-files:'||me.id));
if (select coalesce(sum(octet_length(bytes)),0) from jxc_chat_files where owner_id=me.id and created_at>now()-interval '1 day')+octet_length(raw)>104857600 then raise exception 'Daily file upload limit reached';end if;
insert into jxc_chat_files(owner_id,ch,name,mime,bytes) values(me.id,p_ch,regexp_replace(p_name,'[[:cntrl:]/\\]','_','g'),case when length(p_type)<=120 and p_type~'^[a-zA-Z0-9.+-]+/[a-zA-Z0-9.+-]+$' then p_type else 'application/octet-stream' end,raw) returning * into f;
return jsonb_build_object('id',f.id,'name',f.name,'type',f.mime,'size',octet_length(f.bytes));end $$;
create or replace function jxc_file_get(p_token text,p_id text) returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare me jxc_users; f jxc_chat_files;c jsonb;begin
me:=jxc_me_row(p_token);select * into f from jxc_chat_files where id=p_id;
if f.id is null then raise exception 'File not found';end if;
select d into c from jxc_docs where k='chat' and id=f.ch;
if f.ch<>'C_all' and (c is null or not coalesce(jxc_doc_visible(me,'chat',c),false)) then raise exception 'Chat access denied';end if;
if not exists(select 1 from jxc_docs where k='msg' and d->'file'->>'id'=f.id and d->>'ch'=f.ch and not coalesce((d->>'rc')::boolean,false) and jxc_doc_visible(me,'msg',d)) then raise exception 'File message unavailable';end if;
return jsonb_build_object('name',f.name,'type',f.mime,'size',octet_length(f.bytes),'data',encode(f.bytes,'base64'));end $$;
revoke all on function jxc_file_upload(text,text,text,text,text),jxc_file_get(text,text) from public;
grant execute on function jxc_file_upload(text,text,text,text,text),jxc_file_get(text,text) to anon,authenticated,service_role;
commit;
select 'chat_files_ready' status;
