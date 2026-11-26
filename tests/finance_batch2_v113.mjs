// 第二批财务修正的验算：采购单锁定、入库后补录费用（lcadj）、采购退货费用损失。
// 运行：node tests/finance_batch2_v113.mjs（网页计算 + 本地 PostgreSQL 执行全部升级脚本后验证服务器规则）
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {ctx,vm} from './ui_v190.mjs';
const run=s=>vm.runInContext(s,ctx);

// ---------- 网页端 ----------
run(`S.lang='zh';S.me={id:'A1',role:'acct',name:'会计'};const now=Date.now();
DB.d.partners=[{id:'V1',kind:'sup',n:'测试供应商'}];
DB.d.po=[{id:'P1',no:'PO-1',sup:'V1',wh:'W1',status:'received',t:now,items:[{pid:'p',qty:10,price:100,recv:10}],fees:[{k:'freight',amt:200}]},
         {id:'P2',no:'PO-2',sup:'V1',wh:'W1',status:'ordered',t:now,items:[{pid:'p',qty:5,price:100,recv:0}],fees:[]}];
DB.d.grn=[{id:'G1',po:'P1',status:'done',items:[{pid:'p',qty:10}]}];
DB.d.pr=[{id:'R1',grn:'G1',status:'done',items:[{i:0,pid:'p',qty:2}]}];
DB.d.fin=[];DB.d.exp=[];DB.d.so=[];
DB.d.lcadj=[{id:'L1',po:'P1',k:'clear',n:'二次清关',amt:150,status:'approved',by:'A1',t:now,approval:{by:'O1',t:now}},
            {id:'L2',po:'P1',k:'other',n:'滞箱费',amt:80,status:'pending',by:'A1',t:now}];
DB.d.moves=[{id:'M1',type:'po_ret',ref:'R1',pid:'p',qty:-2,uc:120,costAmount:240,costFixed:true,t:now}];
DB.ver++;`);
// 应付 = 1000 货款 + 200 附加费用 + 150 已批准补录 − 200 退货（2 × 100）= 1150；待审批的 80 不计
assert.equal(run(`apOf(DB.get('po','P1')).tot`),1150);
// 有入库单的采购单锁定，不显示取消；没有入库和付款的不锁
assert.equal(run(`poLocked(DB.get('po','P1'))`),true);assert.equal(run(`poLocked(DB.get('po','P2'))`),false);
// 利润：补录费用 150；退货按到岸成本 240 出库，供应商退 200，损失 40
const p=run(`profitParts([],DB.all('moves'),0)`);assert.equal(p.lc,150);assert.equal(p.prLoss,40);
// 页面：会计能补录，看到列表；运营经理能审批别人提交的，不能审批自己提交的
run(`S.params={id:'P1'}`);assert.match(run('V.po_view()'),/入库后补录的费用/);assert.match(run('V.po_view()'),/补录费用/);
run(`S.me={id:'O1',role:'ops',name:'运营'}`);assert.equal(run(`lcCanReview(DB.get('lcadj','L2'))`),true);
run(`S.me={id:'A1',role:'ops',name:'x'}`);assert.equal(run(`lcCanReview(DB.get('lcadj','L2'))`),false,'不能审批自己提交的');
run(`S.me={id:'O1',role:'ops',name:'运营'};S.finSeg='ap';S.finF='all'`);assert.match(run('V.fin()'),/补录费用待您审批/);
run(`S.me={id:'G9',role:'gm',name:'总经理'};S.rpR='month'`);const rep=run('V.report()');
assert.match(rep,/入库后补录的采购费用/);assert.match(rep,/采购退货费用损失/);
console.log('Finance batch 2 client PASS: payable incl. approved additions, PO lock, return cost loss, review rules.');

// ---------- 服务器端（本地 PostgreSQL，按生产顺序执行全部升级脚本，再执行本次脚本两次） ----------
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
await pg.exec(mig('v1.13.0_finance_po.sql'));await pg.exec(mig('v1.13.0_finance_po.sql'));
let tick=Date.now();const push=async(tok,k,d)=>{try{await pg.query('select jxc_push($1,$2::jsonb)',[tok,JSON.stringify([{k,id:d.id,d:{...d,u:++tick}}])]);return true}catch(e){return e.message}};
const po={id:'PO1',no:'PO1',sup:'V1',wh:'W1',status:'ordered',t:1,items:[{pid:'p',qty:10,price:100,recv:0}],fees:[{k:'freight',amt:200}]};
await pg.query("insert into jxc_docs(k,id,d,u) values('po','PO1',$1,1)",[JSON.stringify(po)]);
// 没有入库和付款时，采购主管仍可修改并取消
assert.equal(await push('buyer','po',{...po,fees:[{k:'freight',amt:250}]}),true);
await pg.query("insert into jxc_docs(k,id,d,u) values('grn','G1',$1,1)",[JSON.stringify({id:'G1',po:'PO1',status:'submitted',batch:'B1',items:[{pid:'p',qty:10,batch:'B1'}]})]);
const cur=async()=>(await pg.query("select d from jxc_docs where k='po' and id='PO1'")).rows[0].d;
// 有了入库单：改单价、改附加费用、取消都被拒；只改入库数量和状态可以
assert.match(String(await push('buyer','po',{...await cur(),items:[{pid:'p',qty:10,price:90,recv:0}]})),/locked|不能再修改/);
assert.match(String(await push('buyer','po',{...await cur(),fees:[]})),/locked|不能再修改/);
assert.match(String(await push('buyer','po',{...await cur(),status:'cancel'})),/cancel|不能取消/);
await pg.query("update jxc_docs set d=jsonb_set(d||'{\"status\":\"received\"}','{items,0,recv}','10') where k='po' and id='PO1'");
assert.equal((await cur()).items[0].recv,10,'入库数量由入库流程更新，不受锁定影响');
// 补录费用：会计提交；采购员不能提交；运营经理审批；提交人不能自批；批准后内容不能再改
const lc={id:'LC1',po:'PO1',k:'clear',n:'二次清关',amt:150,status:'pending',by:'acct',t:1};
assert.notEqual(await push('buyer','lcadj',{...lc,by:'buyer'}),true);
assert.notEqual(await push('acct','lcadj',{...lc,amt:0}),true);
assert.notEqual(await push('acct','lcadj',{...lc,status:'approved'}),true,'不能直接提交为已批准');
assert.equal(await push('acct','lcadj',lc),true);
assert.notEqual(await push('acct','lcadj',{...lc,status:'approved',approval:{by:'acct',t:2}}),true,'会计不能审批');
assert.notEqual(await push('ops','lcadj',{...lc,amt:999,status:'approved',approval:{by:'ops',t:2}}),true,'审批时不能改金额');
assert.equal(await push('ops','lcadj',{...lc,status:'approved',approval:{by:'ops',t:2}}),true);
assert.notEqual(await push('ops','lcadj',{...lc,status:'rejected',approval:{by:'ops',t:3}}),true,'已批准的不能再改');
// 可见性：销售看不到补录费用，会计看得到
const vis=async who=>JSON.stringify((await pg.query('select jxc_pull($1,0) r',[who])).rows[0].r).includes('LC1');
assert.equal(await vis('acct'),true);assert.equal(await vis('sales'),false);
console.log('Finance batch 2 SQL PASS: PO locked after receipt, cancellation blocked, cost additions need operations approval, no self-approval, sales cannot see them; migration re-runnable.');

await pg.close();
