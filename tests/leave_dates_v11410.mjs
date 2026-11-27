import assert from 'node:assert/strict';
import {ctx,vm} from './ui_v190.mjs';
const run=s=>vm.runInContext(s,ctx);
for(const [a,b,n] of [['2026-11-27','2026-11-27',1],['2026-11-27','2026-11-30',4],['2026-12-31','2027-01-02',3],['2028-02-28','2028-03-01',3],['2026-11-30','2026-11-27',0],['2026-02-30','2026-03-02',0],['','2026-11-27',0]]){ctx.a=a;ctx.b=b;assert.equal(run('leaveDateDays(a,b)'),n)}
run("DB.d.users=[{id:'gm-person',role:'gm'},{id:'ops-person',role:'ops'},{id:'staff-person',role:'sales'}];DB.ver++");
for(const role of ['chair','gm','ops','sales']){run(`S.me={id:'reviewer',role:'${role}'}`);assert.equal(run("leaveCan({by:'gm-person',days:1,status:'submitted'})"),role==='chair');assert.equal(run('leaveCanApply()'),role!=='chair')}
run("S.me={id:'gm-person',role:'gm'}");assert.equal(run("leaveCan({by:'gm-person',days:5,status:'submitted'})"),false);
run("S.me={id:'reviewer',role:'ops'}");assert.equal(run("leaveCan({by:'staff-person',days:2,status:'submitted'})"),true);assert.equal(run("leaveCan({by:'ops-person',days:1,status:'submitted'})"),false);
let sheet='';ctx.capture=s=>sheet=s;run('openSheet=capture');run('leaveForm()');assert.ok(sheet.includes('lvStart')&&sheet.includes('lvEnd'));assert.ok(!sheet.includes('lvSession')&&!sheet.includes('lvReason')&&!sheet.includes('type="number"'));
run("S.me={id:'reviewer',role:'chair'}");sheet='';run('leaveForm()');assert.equal(sheet,'');assert.ok(!run('chatLeavePanel()').includes('onclick="leaveForm()"'));assert.ok(!run('V.leave()').includes('onclick="leaveForm()"'));
// Saving derives days again; a displayed or tampered count is never accepted.
let saved;ctx.nodes={'#lvStart':{value:'2026-12-31'},'#lvEnd':{value:'2027-01-02'},'#lvDays':{value:'999'}};ctx.captureSave=d=>{saved=d;return {...d,id:'local-leave-test'}};
run("S.me={id:'staff',role:'sales'};document.querySelector=s=>nodes[s];DB.put=(k,d)=>captureSave(d);commitBusiness=async()=>{};closeSheet=()=>{};go=()=>{};toast=()=>{}");await run('leaveSave()');assert.equal(saved.days,3);assert.equal(saved.session,undefined);assert.equal(saved.reason,undefined);
console.log('Leave dates PASS: date boundaries, inclusive totals, chairman no-apply, GM reviewer routing, self-review protection, and saved-day recomputation.');

