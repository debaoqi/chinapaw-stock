import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const pg=new PGlite();
await pg.exec(`create schema extensions;create role anon;create role authenticated;create role service_role;
create table jxc_users(id text primary key default 'U'||substr(md5(random()::text),1,10),code text,name text,role text,wh text,active boolean default true,pw_hash text,is_admin boolean default false,pos text,seq bigint,created_at timestamptz default now());
create table jxc_sessions(token text,user_id text,last_seen timestamptz);create sequence jxc_seq;
create table jxc_docs(k text,id text,d jsonb,u bigint,by_user text,seq bigint default nextval('jxc_seq'),updated_at timestamptz default now(),primary key(k,id));
create table jxc_audit(user_id text,action text,k text,doc_id text,detail jsonb);
create table jxc_codes(code text,created_at timestamptz,used_at timestamptz,used_by text);
create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(name text,bucket_id text);
create function storage.foldername(text) returns text[] language sql as $$select string_to_array($1,'/')$$;create function storage.extension(text) returns text language sql as $$select split_part($1,'.',2)$$;
-- Password crypto itself is unchanged; these stubs isolate account authorization tests.
create function crypt(text,text) returns text language sql as $$select $1||$2$$;create function gen_salt(text) returns text language sql as $$select 'test-salt'::text$$;`);
const schema=readFileSync(new URL('../supabase/schema.sql',import.meta.url),'utf8');
for(const name of ['jxc_me_row','jxc_user_json'])await pg.exec(schema.match(new RegExp('create or replace function '+name+'\\b[\\s\\S]*?\\$\\$;','i'))[0]);
for(const [id,role,code] of [['owner','gm','111111'],['ops','ops','888888'],['sales','sales','333333'],['acct','acct','555555'],['keeper','keeper','444444'],['clerk','clerk','999999'],['cashier','cashier','666666'],['field','field','777777'],['outsider','sales','333333-1']]){
 await pg.query("insert into jxc_users(id,role,code,name,pw_hash,active) values($1,$2,$3,$1,'original-hash',true)",[id,role,code]);await pg.query('insert into jxc_sessions values($1,$1,now())',[id]);
}
const migration=readFileSync(new URL('../supabase/migrations/v1.8.0.sql',import.meta.url),'utf8');await pg.exec(migration);
assert.equal((await pg.query("select role,pw_hash from jxc_users where id='owner'")).rows[0].role,'chair');
assert.equal((await pg.query("select pw_hash from jxc_users where id='owner'")).rows[0].pw_hash,'original-hash');
await pg.query("select jxc_admin_user('owner',$1::jsonb,'temporary-password')",[JSON.stringify({code:'111112',role:'gm',name:'总经理'})]);
const gm=(await pg.query("select id from jxc_users where code='111112'")).rows[0].id;
await pg.query("insert into jxc_sessions values('new-gm',$1,now())",[gm]);
await pg.exec(migration);assert.equal((await pg.query('select role from jxc_users where id=$1',[gm])).rows[0].role,'gm');
const reject=async fn=>{let blocked=false;try{await fn()}catch{blocked=true}assert.ok(blocked,'operation must reject')};
await reject(()=>pg.query("select jxc_admin_user('new-gm',$1::jsonb,null)",[JSON.stringify({id:'owner',role:'chair',name:'changed'})]));
let tick=100;
const put=async(token,k,d)=>pg.query('select jxc_push($1,$2::jsonb)',[token,JSON.stringify([{k,id:d.id,d:{...d,u:++tick}}])]);
for(const token of ['new-gm','ops','sales','acct','keeper','clerk','cashier','field']){
 await put(token,'att',{id:'photo-'+token,type:'in',photo:'data:image/jpeg;base64,test',t:tick});
 await reject(()=>put(token,'att',{id:'no-photo-'+token,type:'in',photo:'',t:tick}));
}
await reject(()=>put('owner','att',{id:'chair-checkin',type:'in',photo:'data:image/jpeg;base64,test'}));
const device='fcm-test-token-1234567890123456789012345';
await pg.query('select jxc_register_push($1,$2)',['sales',device]);
await pg.query('select jxc_register_push($1,$2)',['ops',device]);
assert.equal((await pg.query('select user_id from jxc_push_tokens where device_token=$1',[device])).rows[0].user_id,'ops');
await pg.query('select jxc_unregister_push($1,$2)',['sales',device]);assert.equal((await pg.query('select count(*)::int n from jxc_push_tokens')).rows[0].n,1);
await pg.query('select jxc_unregister_push($1,$2)',['ops',device]);assert.equal((await pg.query('select count(*)::int n from jxc_push_tokens')).rows[0].n,0);
await put('sales','chat',{id:'private',mem:['sales','ops'],type:'grp'});
await put('sales','msg',{id:'private-msg',ch:'private',mem:['sales','ops'],text:'hello',t:tick});
let event=(await pg.query("select recipients from jxc_push_events where event_key like 'msg:private-msg:%'")).rows[0];assert.deepEqual(event.recipients,['ops']);
await put('sales','msg',{id:'private-msg',ch:'private',mem:['sales','ops'],text:'hello',tr:{zh:'你好'},t:tick});
assert.equal((await pg.query("select count(*)::int n from jxc_push_events where event_key like 'msg:private-msg:%'")).rows[0].n,1);
await put('outsider','msg',{id:'spoof-private',ch:'private',mem:['sales','ops'],text:'invalid',t:tick});
assert.equal((await pg.query("select count(*)::int n from jxc_push_events where event_key like 'msg:spoof-private:%'")).rows[0].n,0);
await put('sales','so',{id:'credit',pay:'credit',status:'submitted',by:'sales',items:[]});
await put('acct','so',{id:'credit',pay:'credit',status:'credit_gm',by:'sales',items:[]});
event=(await pg.query("select recipients from jxc_push_events where event_key like 'so:credit:%' order by id desc limit 1")).rows[0];assert.deepEqual(event.recipients,[gm]);
const claim1=(await pg.query('select id,attempts from jxc_claim_push(1)')).rows[0];
const claim2=(await pg.query('select id,attempts from jxc_claim_push(1)')).rows[0];
assert.notEqual(claim1.id,claim2.id,'overlapping workers must claim different events');assert.equal(claim1.attempts,1);
assert.equal((await pg.query("select has_function_privilege('anon','jxc_claim_push(integer)','EXECUTE') allowed")).rows[0].allowed,false);
console.log('SQL v1.8 PASS: account preservation, repeatable upgrade, protected chairman, all-staff photos, token ownership, private-group recipients, translation dedupe, GM approvals');
await pg.close();
