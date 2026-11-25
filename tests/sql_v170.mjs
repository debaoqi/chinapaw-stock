import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const sql=readFileSync(new URL('../supabase/schema.sql',import.meta.url),'utf8');
const pg=new PGlite();
await pg.exec(`create table jxc_users(id text,role text,active boolean,is_admin boolean);create table jxc_sessions(token text,user_id text,last_seen timestamptz);create sequence jxc_seq;create table jxc_docs(k text,id text,d jsonb,u bigint,by_user text,seq bigint default nextval('jxc_seq'),updated_at timestamptz default now(),primary key(k,id));create table jxc_audit(user_id text,action text,k text,doc_id text,detail jsonb);`);
for(const name of ['jxc_me_row','jxc_can_write','jxc_flow_ok','jxc_push'])await pg.exec(sql.match(new RegExp('create or replace function '+name+'\\b[\\s\\S]*?\\$\\$;'))[0]);
for(const role of ['gm','ops','buyer','clerk','keeper','acct','cashier','sales'])await pg.query(`insert into jxc_users values($1,$1,true,false);insert into jxc_sessions values($1,$1,now())`,[role]).catch(async()=>{await pg.query('insert into jxc_users values($1,$1,true,false)',[role]);await pg.query('insert into jxc_sessions values($1,$1,now())',[role])});
let tick=0;const put=async(role,k,d)=>{d={...d,u:++tick};return(await pg.query('select jxc_push($1,$2::jsonb) r',[role,JSON.stringify([{k,id:d.id,d}])])).rows[0].r};
const get=async(k,id)=>(await pg.query('select d from jxc_docs where k=$1 and id=$2',[k,id])).rows[0]?.d;
const rejects=async fn=>{let bad=false;try{await fn()}catch(e){bad=true}assert.ok(bad,'unauthorized operation must reject')};
let g={id:'g',no:'GR-1',po:'p',wh:'W1',by:'buyer',batch:'B1',status:'submitted',items:[{pid:'x',qty:5,batch:'B1'}]};
await put('buyer','grn',g);await rejects(async()=>put('keeper','grn',{...g,status:'done'}));
await put('acct','grn',{...await get('grn','g'),status:'fin_ok',fin:{by:'acct'}});
await rejects(async()=>put('clerk','grn',{...await get('grn','g'),status:'ready',items:[{pid:'x',qty:99,batch:'B1'}]}));
await put('clerk','grn',{...await get('grn','g'),status:'ready',check:{by:'clerk'}});
await put('keeper','moves',{id:'move',pid:'x',qty:5,ref:'g',type:'po_in'});
await put('keeper','grn',{...await get('grn','g'),status:'done',received:{by:'keeper'}});
await rejects(async()=>put('keeper','moves',{id:'move2',pid:'x',qty:5,ref:'g',type:'po_in'}));
for(const amount of [1,2000,2000.01]){
 const id='e'+amount;let e={id,amt:amount,by:'sales',note:'test',status:'submitted'};await put('sales','exp',e);
 await rejects(async()=>put('acct','exp',{...await get('exp',id),status:'booked'}));
 await rejects(async()=>put('gm','exp',{...await get('exp',id),status:'approved',gm:{by:'gm'}}));
 await put('ops','exp',{...await get('exp',id),status:amount>2000?'gm_pending':'approved',op:{by:'ops'}});
 if(amount>2000){await rejects(async()=>put('acct','exp',{...await get('exp',id),status:'booked'}));await put('gm','exp',{...await get('exp',id),status:'approved',gm:{by:'gm'}})}
 await put('acct','exp',{...await get('exp',id),status:'booked',bk:{by:'acct'}});
 await rejects(async()=>put('cashier','exp',{...await get('exp',id),amt:amount+1,status:'paid',pd:{by:'cashier'}}));
 await put('cashier','exp',{...await get('exp',id),status:'paid',pd:{by:'cashier'}});
 const fid='f'+amount;await put('acct','fin',{id:fid,type:'pay',ref:'p',refKind:'po',amount,status:'req'});
 await rejects(async()=>put('gm','fin',{...await get('fin',fid),status:'approved',gby:'gm'}));
 await put('ops','fin',{...await get('fin',fid),status:amount>2000?'gm_pending':'approved',oby:'ops'});
 await rejects(async()=>put('cashier','fin',{...await get('fin',fid),amount:amount+1,status:'paid',pby:'cashier'}));
 if(amount>2000){await rejects(async()=>put('cashier','fin',{...await get('fin',fid),status:'paid'}));await put('gm','fin',{...await get('fin',fid),status:'approved',gby:'gm'})}
 await put('cashier','fin',{...await get('fin',fid),status:'paid',pby:'cashier'});
}
// A rejected operation rolls back all earlier operations in the same batch.
await rejects(async()=>pg.query('select jxc_push($1,$2::jsonb)', ['keeper',JSON.stringify([{k:'moves',id:'rollback',d:{id:'rollback',type:'init',qty:1,u:++tick}},{k:'so',id:'bad',d:{id:'bad',status:'shipped',u:++tick}}]) ]));
assert.equal(await get('moves','rollback'),undefined);
// Exercise the actual upgrade migration twice, including preservation of paid history.
await pg.exec(`create schema storage;create role anon;create role authenticated;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(name text,bucket_id text);create function storage.foldername(text) returns text[] language sql as $$select string_to_array($1,'/')$$;create function storage.extension(text) returns text language sql as $$select split_part($1,'.',2)$$;`);
await pg.query('insert into jxc_docs(k,id,d) values($1,$2,$3)', ['exp','legacy',JSON.stringify({id:'legacy',status:'booked',amt:2500,ap:{by:'gm'},by:'sales'})]);
const migration=readFileSync(new URL('../supabase/migrations/v1.7.0.sql',import.meta.url),'utf8');
await pg.exec(migration);assert.equal((await get('exp','legacy')).status,'submitted');assert.equal((await get('exp','legacy')).legacyApproval.status,'booked');
await pg.exec(migration);assert.equal((await get('exp','e2000.01')).status,'paid');
console.log('SQL PASS: purchase reviews, role guards, immutable amounts, 1 / 2000 / 2000.01 expense+payment chains, transaction rollback');await pg.close();
