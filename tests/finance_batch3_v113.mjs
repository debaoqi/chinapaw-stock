// 第三批财务修正的验算：应收按出库确认 / 预收款、多收与客户退款、批量收款分配、应付按到货确认 / 预付款、按实到结案、供应商退款。
// 运行：node tests/finance_batch3_v113.mjs
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {ctx,vm} from './ui_v190.mjs';
const run=s=>vm.runInContext(s,ctx);

// ---------- 网页端：应收 ----------
run(`S.lang='zh';S.me={id:'A1',role:'acct',name:'会计'};const now=Date.now();
DB.d.partners=[{id:'C1',kind:'cus',n:'客户甲',paymentDays:30},{id:'V1',kind:'sup',n:'供应商乙'}];
DB.d.so=[
 {id:'SA',no:'SO-A',cus:'C1',status:'approved',pay:'cash',t:now-5e5,items:[{pid:'p',qty:5,price:100}]},
 {id:'SB',no:'SO-B',cus:'C1',status:'shipped',pay:'credit',t:now-4e5,st:now,items:[{pid:'p',qty:10,price:100}]},
 {id:'SC',no:'SO-C',cus:'C1',status:'rejected',pay:'cash',t:now-3e5,items:[{pid:'p',qty:2,price:100}]},
 {id:'SD',no:'SO-D',cus:'C1',status:'done',pay:'cash',t:now-2e5,st:now,items:[{pid:'p',qty:10,price:100,ret:2}]},
 {id:'SE',no:'SO-E',cus:'C1',status:'shipped',pay:'credit',t:now-1e5,st:now,items:[{pid:'p',qty:5,price:100}]}];
DB.d.fin=[
 {id:'R1',type:'rcv',ref:'SA',refKind:'so',amount:500,status:'verified',method:'cash',t:now},
 {id:'R2',type:'rcv',ref:'SB',refKind:'so',amount:300,status:'verified',method:'bank',t:now},
 {id:'R3',type:'rcv',ref:'SC',refKind:'so',amount:200,status:'verified',method:'cash',t:now},
 {id:'R4',type:'rcv',ref:'SD',refKind:'so',amount:1000,status:'verified',method:'cash',t:now}];
DB.d.refund=[{id:'F1',so:'SD',cus:'C1',amount:150,status:'paid',by:'A1',oby:'O1',pby:'K1',pref:'X1',method:'cash',t:now,pt:now},
             {id:'F2',so:'SC',cus:'C1',amount:30,status:'req',by:'A1',t:now}];
DB.d.po=[];DB.d.exp=[];DB.d.grn=[];DB.d.pr=[];DB.d.lcadj=[];DB.d.moves=[];DB.ver++;`);
const ar=id=>run(`arOf(DB.get('so','${id}'))`);
assert.equal(ar('SA').dlv,false);assert.equal(ar('SB').vbal,700);
assert.equal(ar('SC').excess,200,'被驳回的单已收 200 全部是多收');assert.equal(ar('SC').refundable,170,'扣掉审批中的 30');
assert.equal(ar('SD').tot,800);assert.equal(ar('SD').vgot,850,'1000 已收 − 150 已退');assert.equal(ar('SD').excess,50);
let F=run('finSum()');
assert.equal(F.arBal,700+500,'应收只算已出库：SO-B 700 + SO-E 500；SO-A 未出库不算');
assert.equal(F.advRcv,500,'SO-A 未出库已收 500 是预收款');assert.equal(F.custCredit,250,'多收：SO-C 200 + SO-D 50');
assert.equal(F.cash,500+300+200+1000-150,'已付的客户退款从资金中扣除');
// 对账单：未出库的单不计账龄，作为预收抵减；账龄只看已出库
const st=run(`customerStatement('C1')`);const rA=st.rows.find(r=>r.s.id==='SA');assert.equal(rA.shipped,false);assert.equal(rA.balance,-500);assert.equal(rA.age,0);
// 退款审批权限
run(`S.me={id:'O1',role:'ops'}`);assert.equal(run(`rfCanReview(DB.get('refund','F2'))`),true);
run(`S.me={id:'A1',role:'ops'}`);assert.equal(run(`rfCanReview(DB.get('refund','F2'))`),false,'不能审批自己提交的');
run(`S.me={id:'A1',role:'acct'}`);assert.match(run(`(arSheet('SC'),'')`),/^$/);
run(`S.finSeg='ar';S.finF='open'`);const arv=run('V.fin()');assert.match(arv,/客户多收 \/ 待退款/);assert.match(arv,/未出库/);assert.match(arv,/预收款/);

// ---------- 批量收款：900 按开单先后分配 SO-B 700、SO-E 200 ----------
run(`S.me={id:'K1',role:'cashier'};S.br={cus:'C1',amt:900,alloc:{},method:'bank',ref:'BANK-77'};bulkAuto()`);
assert.deepEqual({...run('S.br.alloc')},{SB:700,SE:200});
run(`S.br.alloc={SB:700,SE:100}`);run('bulkRcvSave()');assert.equal(run(`DB.all('fin').filter(f=>f.batch).length`),3,'已分配800、余款100登记为未分配预收款');
assert.equal(run(`DB.all('fin').find(f=>f.batch&&f.refKind==='customer').amount`),100);
run(`DB.d.fin=DB.d.fin.filter(f=>!f.batch);DB.outbox=DB.outbox.filter(o=>!o.d.batch);DB.ver++`);
run(`S.br.alloc={SB:700,SE:200}`);run('bulkRcvSave()');
const made=run(`DB.all('fin').filter(f=>f.batch).map(f=>[f.ref,f.amount,f.status,f.pref])`);
assert.deepEqual(Array.from(made,x=>Array.from(x)).sort(),[['SB',700,'recorded','BANK-77'],['SE',200,'recorded','BANK-77']]);
run(`S.me={id:'A1',role:'acct'}`);assert.equal(run('finSum()').arBal,1200,'待核对的批量收款不冲减应收');

// ---------- 应付：到货才形成应付，到货前付的是预付款 ----------
run(`DB.d.po=[{id:'P1',no:'PO-1',sup:'V1',wh:'W1',status:'ordered',t:now,items:[{pid:'p',qty:10,price:100,recv:0}],fees:[{k:'freight',amt:200}]},
              {id:'P2',no:'PO-2',sup:'V1',wh:'W1',status:'done',t:now,items:[{pid:'p',qty:5,price:100,recv:5}],fees:[]}];
DB.d.fin.push({id:'Y1',type:'pay',ref:'P1',refKind:'po',amount:300,status:'paid',t:now,pt:now,method:'bank'},
              {id:'Y2',type:'pay',ref:'P2',refKind:'po',amount:800,status:'paid',t:now,pt:now,method:'bank'});DB.ver++`);
const ap=id=>run(`apOf(DB.get('po','${id}'))`);
let x=ap('P1');assert.deepEqual([x.due,x.adv,x.bal,x.tot,x.free],[0,300,0,1200,900],'定金 300 是预付款，仍可按订单总额申请付款');
run(`DB.d.po[0].items[0].recv=6;DB.d.grn=[{id:'G1',po:'P1',status:'done',items:[{pid:'p',qty:6}]}];DB.ver++`);
x=ap('P1');assert.deepEqual([x.due,x.bal,x.adv],[800,500,0],'到货 6 件：600 货款 + 200 运费');
// 按实到结案：结案后付款上限按已到货应付
run(`S.me={id:'B1',role:'buyer'};S.params={id:'P1'}`);assert.match(run('V.po_view()'),/按实到数量结案/);assert.doesNotMatch(run('V.po_view()'),/取消订单/,'已入库的采购单不能取消');
run(`DB.d.po[0].status='done';DB.ver++`);x=ap('P1');assert.equal(x.tot,800);assert.equal(x.free,500);
// 退货 1 件后应付减少
run(`DB.d.pr=[{id:'PR1',grn:'G1',status:'done',items:[{i:0,pid:'p',qty:1}]}];DB.ver++`);assert.equal(ap('P1').due,700);
// 供应商欠我方：P2 到货 500 已付 800，欠 300；供应商退回 200 并核对后剩 100
x=ap('P2');assert.equal(x.adv,300);
run(`DB.d.fin.push({id:'Z1',type:'rcv',ref:'P2',refKind:'po',amount:200,status:'verified',method:'bank',t:now});DB.ver++`);
x=ap('P2');assert.equal(x.paid,600);assert.equal(x.adv,100);
run(`S.me={id:'A1',role:'acct'}`);
assert.equal(ar('SB').vgot,300,'供应商退款不会混进客户应收');
run(`S.me={id:'A1',role:'acct'}`);F=run('finSum()');assert.equal(F.advPay,100);assert.equal(F.apBal,700-300,'P1 欠 400（700 − 300 定金）');
// 没有入库和付款的采购单可以取消（以前这个按钮被“登记到货”挡住）
run(`DB.d.po.push({id:'P3',no:'PO-3',sup:'V1',wh:'W1',status:'ordered',t:now,items:[{pid:'p',qty:1,price:1,recv:0}],fees:[]});DB.ver++;S.me={id:'B1',role:'buyer'};S.params={id:'P3'}`);
assert.match(run('V.po_view()'),/取消订单/);
// 资金日记账：客户退款、供应商退款的说明
run(`S.me={id:'A1',role:'acct'}`);assert.ok(run(`cashEntries().map(cashLabel).map(l=>l.type)`).includes('客户退款'));assert.ok(run(`cashEntries().map(cashLabel).map(l=>l.type)`).includes('供应商退款'));
console.log('Finance batch 3 client PASS: AR on shipment & advances, over-receipts & refunds, bulk receipt allocation, AP on receipt & deposits, short close, supplier refunds.');

// ---------- 服务器端：客户退款规则 ----------
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
for(const [id,role,code] of [['owner','gm','111111'],['ops','ops','888888'],['acct','acct','555555'],['cashier','cashier','666666'],['sales','sales','333333']]){
 await pg.query("insert into jxc_users(id,role,code,name,pw_hash,active) values($1,$2,$3,$1,'h',true)",[id,role,code]);await pg.query('insert into jxc_sessions values($1,$1,now())',[id]);}
const mig=n=>readFileSync(new URL('../supabase/migrations/'+n,import.meta.url),'utf8');
for(const n of ['v1.8.0.sql','v1.9.0_live.sql','v1.9.2_sync.sql','v1.9.0_services.sql','v1.9.2_leave.sql','v1.9.2_vehicles.sql','v1.9.2_webpush.sql','v1.10.0_profiles.sql','v1.11.0_vehicle_ai.sql','v1.12.0_language.sql','v1.13.0_finance_po.sql'])await pg.exec(mig(n));
await pg.exec(mig('v1.13.0_finance_arap.sql'));await pg.exec(mig('v1.13.0_finance_arap.sql'));
// owner 原为 gm，v1.8.0 升级后是董事长；另建一个总经理
await pg.query("insert into jxc_users(id,role,code,name,pw_hash,active) values('gm','gm','111112','gm','h',true)");await pg.query("insert into jxc_sessions values('gm','gm',now())");
const ins=(k,id,d)=>pg.query('insert into jxc_docs(k,id,d,u) values($1,$2,$3,1)',[k,id,JSON.stringify({id,...d})]);
// This refund-only fixture represents pre-existing legacy records, not a new warehouse posting.
// Disable the counter trigger only while seeding it in this disposable in-memory database.
await pg.exec('alter table jxc_docs disable trigger jxc_document_totals_trigger');
await ins('so','SD',{no:'SO-D',cus:'C1',status:'done',items:[{pid:'p',qty:10,price:100,ret:2}]});
await pg.exec('alter table jxc_docs enable trigger jxc_document_totals_trigger');
await ins('fin','R4',{type:'rcv',ref:'SD',refKind:'so',amount:1000,status:'verified'});
await ins('so','SC',{no:'SO-C',cus:'C1',status:'rejected',items:[{pid:'p',qty:50,price:100}]});
await ins('fin','R5',{type:'rcv',ref:'SC',refKind:'so',amount:5000,status:'verified'});
let tick=Date.now();const push=async(tok,d)=>{try{await pg.query('select jxc_push($1,$2::jsonb)',[tok,JSON.stringify([{k:'refund',id:d.id,d:{...d,u:++tick}}])]);return true}catch(e){return e.message}};
const rf={id:'RF1',so:'SD',cus:'C1',amount:200,reason:'退货 2 件',status:'req',by:'acct',t:1};
assert.notEqual(await push('acct',{...rf,amount:250}),true,'超过可退金额 200');
assert.notEqual(await push('sales',{...rf,by:'sales'}),true,'销售不能申请退款');
assert.notEqual(await push('acct',{...rf,cus:'C9'}),true,'客户必须与销售单一致');
assert.equal(await push('acct',rf),true);
assert.notEqual(await push('acct',{...rf,id:'RF2',amount:10}),true,'已无可退金额');
assert.notEqual(await push('acct',{...rf,status:'approved',oby:'acct'}),true,'会计不能审批');
assert.notEqual(await push('ops',{...rf,amount:100,status:'approved',oby:'ops'}),true,'审批时不能改金额');
assert.notEqual(await push('cashier',{...rf,status:'paid',pby:'cashier',pref:'X'}),true,'未审批不能付款');
assert.equal(await push('ops',{...rf,status:'approved',oby:'ops'}),true);
assert.notEqual(await push('cashier',{...rf,status:'paid',oby:'ops',pby:'cashier'}),true,'必须填凭证号');
assert.equal(await push('cashier',{...rf,status:'paid',oby:'ops',pby:'cashier',pref:'CASH-1',method:'cash'}),true);
// 大额：> 2000 运营经理通过后必须交总经理
const big={id:'RF3',so:'SC',cus:'C1',amount:3000,reason:'订单驳回，退回全款',status:'req',by:'acct',t:1};
assert.equal(await push('acct',big),true);
assert.notEqual(await push('ops',{...big,status:'approved',oby:'ops'}),true,'大额不能由运营经理直接批准');
assert.equal(await push('ops',{...big,status:'gm_pending',oby:'ops'}),true);
assert.notEqual(await push('cashier',{...big,status:'paid',oby:'ops',pby:'cashier',pref:'B1'}),true);
assert.equal(await push('gm',{...big,status:'approved',oby:'ops',gby:'gm'}),true);
assert.equal(await push('cashier',{...big,status:'paid',oby:'ops',gby:'gm',pby:'cashier',pref:'BANK-1',method:'bank'}),true);
// 撤回：会计撤回自己未批准的申请
const w={id:'RF4',so:'SC',cus:'C1',amount:100,reason:'测试撤回',status:'req',by:'acct',t:1};
assert.equal(await push('acct',w),true);assert.equal(await push('acct',{...w,status:'void'}),true);
// 可见性
const vis=async who=>JSON.stringify((await pg.query('select jxc_pull($1,0) r',[who])).rows[0].r).includes('RF1');
assert.equal(await vis('acct'),true);assert.equal(await vis('cashier'),true);assert.equal(await vis('sales'),false);
console.log('Finance batch 3 SQL PASS: refund limited to refundable amount, operations then GM above 2000, cashier pays with reference, no self-approval or amount edits, sales cannot see refunds; migration re-runnable.');

await pg.close();
