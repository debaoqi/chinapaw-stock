import {pg,push,cur,seed,assert} from './integrity_fixture.mjs';
try{
await seed('settings',{id:'app',base:'GHS'});await seed('wh',{id:'W1'});await seed('products',{id:'p',n:{zh:'product'},minPrice:0});await seed('partners',{id:'C',type:'cus',creditLimit:1000,paymentDays:30});await seed('stockreq',{id:'OP',status:'approved',wh:'W1',items:[{pid:'p',qty:10,uc:5}]});
assert.equal(await push('keeper','moves',{id:'INIT',pid:'p',wh:'W1',batch:'A',qty:10,type:'init',ref:'OP'}),true);
await seed('so',{id:'S',cus:'C',wh:'W1',status:'approved',pay:'credit',items:[{pid:'p',qty:4,price:10,shipped:0}]});
assert.equal(await push('keeper','moves',{id:'OUT',pid:'p',wh:'W1',batch:'A',qty:-4,type:'so_out',ref:'S'}),true);let s=await cur('so','S');assert.equal(await push('keeper','so',{...s,status:'shipped',items:[{...s.items[0],shipped:4}],st:1}),true);
await seed('sr',{id:'SR',so:'S',wh:'W1',status:'pending',items:[{pid:'p',qty:2,i:0}],reason:'damaged'});
assert.equal(await push('keeper','moves',{id:'RET',pid:'p',wh:'W1',batch:'A',qty:2,type:'so_ret',ref:'SR',quality:'good'}),true);assert.equal((await cur('moves','RET')).quality,'hold','All sales returns are quarantined even if modified client asks for good');
let sr=await cur('sr','SR');assert.equal(await push('keeper','sr',{...sr,status:'done'}),true);assert.equal((await cur('credit_note','CN_SR')).amount,-20);
assert.equal((await cur('so','S')).items[0].ret,2,'Return completion updates the sales return counter on the server');
assert.equal(await push('acct','partners',{...await cur('partners','C'),creditLimit:25}),true);
assert.equal(await push('sales','so',{id:'CREDIT-AFTER-RETURN',cus:'C',wh:'W1',pay:'credit',status:'submitted',items:[{pid:'p',qty:1,price:5}]}),true,'Returned value frees customer credit');
assert.equal(Number((await pg.query("select sum((d->>'qty')::numeric) n from jxc_docs where k='moves' and coalesce(d->>'quality','good')='good'")).rows[0].n),6);
const qc={id:'QC',wh:'W1',quality:'hold',items:[{pid:'p',batch:'A',qty:1}],reason:'Inspection passed',status:'pending'};assert.equal(await push('keeper','qc',qc),true);let q=await cur('qc','QC');assert.notEqual(await push('keeper','qc',{...q,status:'approved',approval:{by:'keeper'}}),true);assert.equal(await push('ops','qc',{...q,status:'approved',approval:{by:'ops'}}),true);
assert.match(String(await push('keeper','moves',{id:'BADBATCH',pid:'p',wh:'W1',batch:'B',qty:-1,type:'qc_out',ref:'QC'})),/Quantity exceeds|Insufficient/);
assert.equal(await push('keeper','moves',{id:'QO',pid:'p',wh:'W1',batch:'A',qty:-1,type:'qc_out',ref:'QC'}),true);assert.equal(await push('keeper','moves',{id:'QI',pid:'p',wh:'W1',batch:'A',qty:1,type:'qc_in',ref:'QC'}),true);q=await cur('qc','QC');assert.equal(await push('keeper','qc',{...q,status:'done',doneBy:'keeper'}),true);
assert.equal(Number((await pg.query("select sum((d->>'qty')::numeric) n from jxc_docs where k='moves' and coalesce(d->>'quality','good')='good'")).rows[0].n),7);
assert.equal(await push('keeper','writeoff',{id:'WO',wh:'W1',quality:'hold',items:[{pid:'p',batch:'A',qty:1}],reason:'Broken beyond repair',status:'pending'}),true);let wo=await cur('writeoff','WO');assert.equal(await push('ops','writeoff',{...wo,status:'approved',approval:{by:'ops'}}),true);assert.equal(await push('keeper','moves',{id:'WOM',pid:'p',wh:'W1',batch:'A',qty:-1,type:'writeoff',ref:'WO'}),true);wo=await cur('writeoff','WO');assert.equal(await push('keeper','writeoff',{...wo,status:'done',doneBy:'keeper'}),true);assert.equal((await cur('moves','WOM')).costAmount,5);
await seed('so',{id:'FREE',cus:'C',wh:'W1',status:'approved',pay:'credit',items:[{pid:'p',qty:1,price:0,shipped:0}]});
assert.equal(await push('keeper','moves',{id:'FREEOUT',pid:'p',wh:'W1',batch:'A',qty:-1,type:'so_out',ref:'FREE'}),true);
let free=await cur('so','FREE');assert.equal(await push('keeper','so',{...free,status:'shipped',items:[{...free.items[0],shipped:1}]}),true);
await seed('sr',{id:'FREERET',so:'FREE',wh:'W1',status:'pending',items:[{pid:'p',qty:1}]});
assert.equal(await push('keeper','moves',{id:'FREERETMOVE',pid:'p',wh:'W1',batch:'A',qty:1,type:'so_ret',ref:'FREERET'}),true);
assert.equal(await push('keeper','sr',{...await cur('sr','FREERET'),status:'done'}),true,'A zero-price item can still be physically returned');
assert.equal((await cur('credit_note','CN_FREERET')).amount,0);
console.log('Quality SQL PASS: mandatory quarantine, red credit note, no saleable stock increase on return, independent QC/write-off approval, batch authorization, complete release and write-off costing.');
}finally{await pg.close()}
