import {pg,push,cur,seed,assert} from './integrity_fixture.mjs';
try{
await seed('settings',{id:'app',base:'GHS',expLimit:750});await seed('wh',{id:'W1'});await seed('products',{id:'p',n:{zh:'test'},minPrice:0});await seed('partners',{id:'C1',type:'cus',creditLimit:10000,paymentDays:30});await seed('partners',{id:'V1',type:'sup'});
await seed('stockreq',{id:'OPEN',status:'approved',wh:'W1',items:[{pid:'p',qty:100,uc:1}]});assert.equal(await push('keeper','moves',{id:'INIT',pid:'p',wh:'W1',batch:'A',qty:100,type:'init',ref:'OPEN'}),true);
for(const id of ['S1','S2'])assert.equal(await push('sales','so',{id,cus:'C1',wh:'W1',status:'submitted',pay:'cash',items:[{pid:'p',qty:5,price:20}]}),true);
assert.equal(await push('cashier','fin',{id:'DEP',type:'rcv',refKind:'customer',ref:'C1',amount:250,status:'recorded'}),true);let f=await cur('fin','DEP');assert.equal(await push('acct','fin',{...f,status:'verified',vby:'acct'}),true);
const alloc=(id,target,amount)=>({id,cus:'C1',sourceKind:'customer',source:'C1',target,amount,status:'posted'});
assert.equal(await push('acct','allocation',alloc('AL1','S1',100)),true);assert.equal(await push('acct','allocation',alloc('AL2','S2',100)),true);assert.notEqual(await push('acct','allocation',alloc('AL3','S2',1)),true);assert.equal(Number((await pg.query("select jxc_customer_balance('C1') n")).rows[0].n),50);
assert.notEqual(await push('cashier','allocation',alloc('BYPASS','S1',10)),true);
assert.equal(Number((await pg.query("select jxc_order_paid('S1') n")).rows[0].n),100);
const salesPull=(await pg.query("select jxc_pull('sales',0) r")).rows[0].r;assert.equal(salesPull.rows.find(r=>r.k==='so'&&r.d.id==='S1').d.paidVerified,100);
let s=await cur('so','S1');assert.equal(await push('acct','so',{...s,status:'approved',fin:{by:'acct',t:1}}),true,'Allocated advances can release a cash order after separate review');
assert.equal(await push('acct','refund',{id:'RF',refKind:'customer',cus:'C1',amount:50,reason:'Return unused deposit',status:'req'}),true);assert.equal(Number((await pg.query("select jxc_customer_balance('C1') n")).rows[0].n),0,'Pending refunds reserve customer balance');
let rf=await cur('refund','RF');assert.equal(await push('ops','refund',{...rf,status:'approved',oby:'ops'}),true);rf=await cur('refund','RF');assert.equal(await push('cashier','refund',{...rf,status:'paid',pby:'cashier',pref:'RF-0001'}),true);
assert.notEqual(await push('acct','refund',{id:'RF2',refKind:'customer',cus:'C1',amount:1,reason:'double refund',status:'req'}),true);
const po={id:'P1',sup:'V1',wh:'W1',status:'ordered',items:[{pid:'p',qty:10,price:10,recv:0}],fees:[]};assert.equal(await push('buyer','po',po),true);
let pay={id:'PAY1',type:'pay',refKind:'po',ref:'P1',amount:20,purp:'goods',status:'req'};assert.match(String(await push('acct','fin',pay)),/matched supplier invoice/);
assert.equal(await push('acct','fin',{...pay,id:'PD',purp:'dep'}),true,'Deposit may precede receipt and invoice');
await seed('grn',{id:'G1',po:'P1',wh:'W1',status:'ready',batch:'B',items:[{pid:'p',qty:5,batch:'B'}]});assert.equal(await push('keeper','moves',{id:'GR1',pid:'p',wh:'W1',batch:'B',qty:5,type:'po_in',ref:'G1'}),true);
const invoice={id:'INV1',kind:'purchase',po:'P1',sup:'V1',invoiceNo:'Supplier-001',invoiceDate:'2026-11-26',status:'pending',fees:0,items:[{pid:'p',qty:6,price:10}]};assert.equal(await push('acct','invoice',invoice),true);let inv=await cur('invoice','INV1');assert.match(String(await push('ops','invoice',{...inv,status:'matched',verifiedBy:'ops'})),/Three-way match failed/);
assert.equal(await push('ops','invoice',{...inv,status:'rejected',verifiedBy:'ops'}),true);
assert.equal(await push('acct','invoice',{...invoice,id:'INV2',invoiceNo:'Supplier-002',items:[{pid:'p',qty:5,price:10}]}),true);inv=await cur('invoice','INV2');assert.equal(await push('ops','invoice',{...inv,status:'matched',verifiedBy:'ops'}),true);assert.equal((await cur('invoice','INV2')).total,50);
assert.equal(await push('acct','fin',pay),true);assert.notEqual(await push('acct','fin',{...pay,id:'PAY2',amount:20}),true,'Matched amount minus other pending payments limits payment');
assert.notEqual(await push('acct','invoice',{...invoice,id:'DUPINV',invoiceNo:'supplier-002'}),true);
// Central FX rates and original prices, with base-currency history locked.
await pg.query("select jxc_fx_rate_set('acct','CNY',2,'2026-11-25')");
assert.equal(await push('buyer','po',{...po,id:'FXPO',originalCurrency:'CNY',items:[{pid:'p',qty:10,originalPrice:5,price:10,recv:0}]}),true);
let fp=await cur('po','FXPO');assert.equal(fp.fx.rate,2);assert.equal(fp.items[0].originalPrice,5);
assert.notEqual(await push('buyer','po',{...fp,fx:{...fp.fx,rate:99}}),true);
await pg.query("select jxc_fx_rate_set('acct','CNY',3,'2026-11-26')");
assert.equal(await push('acct','fin',{id:'FXPAY',type:'pay',refKind:'po',ref:'FXPO',amount:20,purp:'dep',status:'req'}),true);let fxp=await cur('fin','FXPAY');assert.equal(await push('ops','fin',{...fxp,status:'approved',oby:'ops'}),true);fxp=await cur('fin','FXPAY');assert.equal(await push('cashier','fin',{...fxp,status:'paid',pby:'cashier',pref:'FX-001'}),true);fxp=await cur('fin','FXPAY');assert.equal(fxp.nativeAmount,10);assert.equal(fxp.cashAmountBase,30);assert.equal(fxp.fxLoss,10);assert.equal((await cur('po','FXPO')).fx.rate,2);
assert.match(String(await push('owner','settings',{...await cur('settings','app'),base:'USD'})),/currency is locked/);
// A changed company threshold applies to new requests; existing requests keep their snapshot.
assert.equal(await push('buyer','po',{...po,id:'THPO',items:[{pid:'p',qty:100,price:20,recv:0}]}),true);
assert.equal(await push('acct','fin',{id:'THPAY',type:'pay',refKind:'po',ref:'THPO',amount:1000,purp:'dep',status:'req'}),true);
let th=await cur('fin','THPAY');assert.equal(th.approvalLimit,750);
assert.notEqual(await push('ops','fin',{...th,status:'approved',oby:'ops'}),true);
assert.equal(await push('owner','settings',{...await cur('settings','app'),expLimit:2000}),true);
assert.equal(await push('ops','fin',{...th,status:'gm_pending',oby:'ops'}),true,'Request retains original 750 threshold after settings change');
console.log('Settlement SQL PASS: standalone deposits, multi-order allocations, pending-refund reserves, no duplicate cash, invoice quantities/prices/duplicates/payment caps, immutable FX snapshots and realized FX loss.');
}finally{await pg.close()}
