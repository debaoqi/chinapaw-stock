import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const pg=new PGlite();
await pg.exec(`create schema extensions;create role anon;create role authenticated;create role service_role;
create table jxc_users(id text primary key default 'U'||substr(md5(random()::text),1,10),code text,name text,role text,wh text,active boolean default true,pw_hash text,is_admin boolean default false,pos text,seq bigint,created_at timestamptz default now());
create table jxc_sessions(token text,user_id text,last_seen timestamptz);create sequence jxc_seq;
create table jxc_docs(k text,id text,d jsonb,u bigint,by_user text,seq bigint default nextval('jxc_seq'),updated_at timestamptz default now(),primary key(k,id));
create table jxc_audit(user_id text,action text,k text,doc_id text,detail jsonb);
create table jxc_codes(code text,created_at timestamptz,used_at timestamptz,used_by text);
create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(name text,bucket_id text);
create function storage.foldername(text) returns text[] language sql as $$select string_to_array($1,'/')$$;create function storage.extension(text) returns text language sql as $$select split_part($1,'.',2)$$;
create function crypt(text,text) returns text language sql as $$select $1||$2$$;create function gen_salt(text) returns text language sql as $$select 'test-salt'::text$$;`);
const schema=readFileSync(new URL('../supabase/schema.sql',import.meta.url),'utf8');
for(const name of ['jxc_me_row','jxc_user_json'])await pg.exec(schema.match(new RegExp('create or replace function '+name+'\\b[\\s\\S]*?\\$\\$;','i'))[0]);
for(const [id,role,code] of [['owner','gm','111111'],['ops','ops','888888'],['acct','acct','555555'],['buyer','buyer','222222'],['keeper','keeper','444444'],['cashier','cashier','666666'],['sales','sales','333333']]){
 await pg.query("insert into jxc_users(id,role,code,name,pw_hash,active) values($1,$2,$3,$1,'h',true)",[id,role,code]);await pg.query('insert into jxc_sessions values($1,$1,now())',[id]);}
const mig=n=>readFileSync(new URL('../supabase/migrations/'+n,import.meta.url),'utf8');
for(const n of ['v1.8.0.sql','v1.9.0_live.sql','v1.9.2_sync.sql','v1.9.0_services.sql','v1.9.2_leave.sql','v1.9.2_vehicles.sql','v1.9.2_webpush.sql','v1.10.0_profiles.sql','v1.11.0_vehicle_ai.sql','v1.12.0_language.sql'])await pg.exec(mig(n));
if(!process.env.HUABAO_BUNDLE_ONLY){await pg.exec(mig('v1.13.0_finance_po.sql'));await pg.exec(mig('v1.13.0_finance_po.sql'));}

for(const n of process.env.HUABAO_BUNDLE_ONLY?['v1.14.0_complete.sql']:['v1.13.0_finance_arap.sql','v1.13.0_chat_leave.sql','v1.14.0_language_off.sql','v1.14.0_integrity.sql','v1.14.1_settlement.sql','v1.14.2_invoices.sql','v1.14.3_fx_credit.sql','v1.14.4_payment_caps.sql']){await pg.exec(mig(n));await pg.exec(mig(n));}
let tick=Date.now();
const push=async(tok,k,d)=>{try{await pg.query('select jxc_push($1,$2::jsonb)',[tok,JSON.stringify([{k,id:d.id,d:{...d,u:(tick=Math.max(Date.now()+1000,tick+1))}}])]);return true}catch(e){return e.message}};
const cur=async(k,id)=>(await pg.query('select d from jxc_docs where k=$1 and id=$2',[k,id])).rows[0]?.d;
const seed=async(k,d)=>pg.query('insert into jxc_docs(k,id,d,u,by_user) values($1,$2,$3,1,$4)',[k,d.id,JSON.stringify(d),d.by||'owner']);
console.log('Integrity migrations installed twice');
export {pg,push,cur,seed,assert};
