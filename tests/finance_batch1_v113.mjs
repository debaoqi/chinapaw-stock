// 第一批财务修正的验算：资金余额含费用报销、未核对收款不冲减应收、盘盈盘亏进利润、运费只算一次。
// 运行：node tests/finance_batch1_v113.mjs（会先跑 ui_v190.mjs 的回归，再用固定数字验算）
import assert from 'node:assert/strict';
import {ctx,vm} from './ui_v190.mjs';
const run=s=>vm.runInContext(s,ctx);
run(`S.lang='zh';S.me={id:'A1',role:'acct',name:'会计'};const now=Date.now();
DB.d.partners=[{id:'C1',kind:'cus',n:'测试客户'}];
DB.d.so=[
 {id:'S1',no:'SO-1',cus:'C1',status:'done',st:now,t:now,pay:'cash',items:[{pid:'p',qty:10,price:100}],frt:{payer:'us',amt:50}},
 {id:'S2',no:'SO-2',cus:'C1',status:'shipped',st:now,t:now,pay:'credit',items:[{pid:'p',qty:1,price:200}],frt:{payer:'us',amt:40}}];
DB.d.fin=[
 {id:'F1',type:'rcv',ref:'S1',refKind:'so',amount:600,method:'cash',status:'verified',t:now},
 {id:'F2',type:'rcv',ref:'S1',refKind:'so',amount:300,method:'momo',status:'recorded',t:now},
 {id:'F3',type:'pay',ref:'P1',refKind:'po',amount:400,method:'bank',status:'paid',t:now,pt:now},
 {id:'F4',type:'pay',ref:'P1',refKind:'po',amount:999,method:'bank',status:'approved',t:now},
 {id:'F5',type:'rcv',ref:'S1',refKind:'so',amount:77,method:'cash',status:'void',t:now}];
DB.d.exp=[
 {id:'E1',cat:'office',amt:30,status:'paid',by:'U9',t:now,bt:now,pd:{by:'A2',t:now,method:'cash',ref:'R1'}},
 {id:'E2',cat:'freight',amt:70,status:'booked',by:'U9',t:now,bt:now,so:'S1'},
 {id:'E3',cat:'rent',amt:500,status:'submitted',by:'U9',t:now}];
DB.d.moves=[
 {id:'M1',type:'so_out',ref:'S1',pid:'p',qty:-10,costAmount:600,revenue:1000,costFixed:true,t:now},
 {id:'M2',type:'so_out',ref:'S2',pid:'p',qty:-1,costAmount:60,revenue:200,costFixed:true,t:now},
 {id:'M3',type:'adj',ref:'K1',pid:'p',qty:-2,costAmount:20,costFixed:true,t:now},
 {id:'M4',type:'adj',ref:'K1',pid:'q',qty:1,costAmount:5,costFixed:true,t:now}];
DB.ver++;`);

// 1. 应收：只有已核对的 600 冲减；登记未核对的 300 单列
const ar=run(`arOf(DB.get('so','S1'))`);
assert.equal(ar.tot,1000);assert.equal(ar.vgot,600);assert.equal(ar.pend,300);assert.equal(ar.vbal,400);
assert.equal(ar.bal,100,'登记口径的余额保留给“防止重复登记”和放行判断');

// 2. 资金：600 已核对收款 − 400 采购付款 − 30 已付费用 = 170；300 待核对不计入；已批准未付和作废不计
const F=run('finSum()');
assert.equal(F.cash,170);assert.equal(F.cashPend,300);assert.equal(F.payMonth,430);
assert.equal(F.arBal,400+200,'S1 余额 400 + S2 赊销未收 200');

// 3. 利润：运费 S1 按关联报销 70、S2 按单上 40 → 110；运营费用只算办公 30（运费报销不重复、未入账的房租不算）；盘亏 −20 盘盈 +5 → −15
const p=run(`profitParts(DB.all('so').filter(s=>['shipped','done'].includes(s.status)),DB.all('moves'),0)`);
assert.deepEqual({...p},{freight:110,opex:30,adj:-15,lc:0,prLoss:0});

// 4. 页面：资金日记账含费用报销与“待核对”提示；应收列表显示待核对；报表显示盘盈盘亏和正确净利润
run(`S.finSeg='book'`);const book=run('V.fin()');
assert.match(book,/费用报销/);assert.match(book,/待会计核对/);assert.match(book,/未计入余额/);
run(`S.finSeg='ar';S.finF='all'`);const arv=run('V.fin()');assert.match(arv,/待核对/);
run(`S.rpR='month'`);const rep=run('V.report()');
assert.match(rep,/盘盈 \/ 盘亏/);
const net=1200-660-110-30-15;assert.ok(rep.includes(run(`money(${net})`)),'净利润 = 1200 − 660 − 110 − 30 − 15 = '+net);

// 5. 导出资金日记账：含费用行，合计与余额只算已计入的
let sheet;run(`exportXlsx=(n,s)=>{globalThis.__x=s}`);run('exportFin()');sheet=run('__x')[0];
assert.equal(sheet.rows.length,4,'2 笔收款 + 1 笔采购付款 + 1 笔费用；作废与未付款不列');const last=sheet.total;assert.deepEqual([last[5],last[6],last[7]],[600,430,170]);
assert.ok(sheet.rows.some(r=>r[1]==='费用报销'&&r[6]===30));
assert.ok(sheet.rows.some(r=>String(r[8]).includes('未计入余额')&&r[5]===300));

// 6. 费用表单：运费类可关联我方承担运费的销售单，清关类只提示不要重复报销
assert.match(run(`expFreightBox({cat:'freight',so:''})`),/SO-1/);
assert.match(run(`expFreightBox({cat:'clear'})`),/附加费用/);assert.equal(run(`expFreightBox({cat:'office'})`),'');

// 7. 旧数据：本期盘点调整缺少成本快照时，利润暂停展示而不是按 0 计
run(`DB.d.moves.push({id:'M5',type:'adj',ref:'K2',pid:'p',qty:-1,t:Date.now()});DB.ver++`);
assert.match(run('V.report()'),/盘点调整缺少可信成本快照/);
console.log('Finance batch 1 PASS: cash book incl. paid expenses, verified-only receivables, count gain/loss in profit, freight counted once.');
