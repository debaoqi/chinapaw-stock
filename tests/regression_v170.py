"""Offline regression: never signs in to or writes production services."""
import json, threading, functools, http.server, pathlib, sys
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path(__file__).resolve().parents[1]
class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*args): pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT/'www')))
threading.Thread(target=server.serve_forever,daemon=True).start()
results=[]
with sync_playwright() as pw:
    browser=pw.chromium.launch(channel='msedge',headless=True)
    for file,viewport in [('index.html',{'width':390,'height':844}),('web.html',{'width':1440,'height':1000})]:
        context=browser.new_context(viewport=viewport,locale='zh-CN',service_workers='block')
        context.add_init_script("Object.defineProperty(window,'JXC_CONFIG',{value:{},writable:false});")
        context.route('**/*',lambda r: r.continue_() if r.request.url.startswith('http://127.0.0.1:') else r.abort())
        page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto(f'http://127.0.0.1:{server.server_port}/{file}?demo=1')
        page.wait_for_function("typeof DB!=='undefined'&&DB.all('users').length>0")
        page.evaluate("""()=>{window.realSyncRun=Sync.run.bind(Sync);Sync.start=()=>{};clearInterval(Sync.timer);Sync.run=async()=>{};window.testRole=r=>{S.me=DB.all('users').find(u=>u.role===r)||{id:'test-'+r,role:r,name:r,wh:'W1'};closeSheet(true);S.hist=[];S.view='work';S.params={};render(false)};testRole('acct')}""")
        # A verified final receipt must release the order, without an extra hidden step.
        page.evaluate("""()=>{DB.put('so',{id:'cash',no:'SO-CASH',wh:'W1',cus:DB.all('partners').find(p=>p.type==='cus').id,by:'U3',pay:'cash',status:'submitted',t:Date.now(),items:[{pid:DB.all('products')[0].id,qty:1,price:100}]});DB.put('fin',{id:'receipt',type:'rcv',ref:'cash',refKind:'so',amount:100,method:'cash',status:'recorded',t:Date.now()});finVerify('receipt','cash')}""")
        assert page.evaluate("DB.get('so','cash').status")=='approved'
        page.evaluate("testRole('keeper');S.view='so_view';S.params={id:'cash'};render(false)")
        assert page.locator('#fixed').inner_text().find('确认发货')>=0
        page.evaluate("shipSheet('cash');const e=$('#shF');if(e)e.style.display='none';doShip('cash')")
        assert page.evaluate("DB.get('so','cash').status")=='shipped'
        count=page.evaluate("DB.all('moves').filter(m=>m.ref==='cash').length")
        page.evaluate("doShip('cash')");assert page.evaluate("DB.all('moves').filter(m=>m.ref==='cash').length")==count
        # Cashier can reach finance credit approval from receivables and directly send to GM.
        page.evaluate("""()=>{testRole('cashier');DB.put('so',{...DB.get('so','cash'),id:'credit',no:'SO-CREDIT',status:'submitted',pay:'credit'});arSheet('credit')}""")
        page.get_by_role('button',name='赊销：拒绝 / 直报总经理审批',exact=True).click()
        assert '驳回' in page.locator('#sheet').inner_text()
        page.fill('#sfN','客户信用良好，30 天回款');page.get_by_role('button',name='同意，交总经理审批',exact=True).click()
        assert page.evaluate("DB.get('so','credit').status")=='credit_gm'
        page.evaluate("testRole('gm');Alerts.scan([{k:'so',d:DB.get('so','credit')}],true)")
        assert page.evaluate("Alerts.list().some(n=>n.key==='socreditg')")
        page.evaluate("Alerts.scan([{k:'so',d:{...DB.get('so','credit'),id:'gm-created-credit',by:S.me.id}}],false)")
        assert page.evaluate("Alerts.list().some(n=>n.key==='sogm-created-creditg')")
        page.evaluate("soGm('credit')");page.fill('#sgN','同意赊销');page.get_by_role('button',name='批准赊账',exact=True).click()
        assert page.evaluate("DB.get('so','credit').status")=='approved'
        # Unauthorized approval and shipping are ignored.
        page.evaluate("testRole('sales');DB.put('so',{...DB.get('so','credit'),id:'reject-credit',status:'submitted'});soFinOk('reject-credit');doShip('credit')")
        assert page.evaluate("DB.get('so','reject-credit').status")=='submitted'
        assert page.evaluate("DB.get('so','credit').status")=='approved'
        page.evaluate("testRole('acct');soFin('reject-credit');soReject('reject-credit')");page.fill('#srR','客户欠款过多');page.get_by_role('button',name='确认驳回',exact=True).click()
        assert page.evaluate("DB.get('so','reject-credit').status")=='rejected'
        # Purchase receipt: both reviews leave stock unchanged; only keeper posts stock.
        page.evaluate("""()=>{testRole('buyer');const pid=DB.all('products')[0].id;DB.put('po',{id:'purchase',no:'PO-TEST',status:'ordered',wh:'W1',sup:DB.all('partners').find(p=>p.type==='sup').id,t:Date.now(),items:[{pid,qty:5,price:20}]});S.form=null;go('recv',{id:'purchase'});S.form.lines[0].exp='2028-12-31';window.beforeQty=qtyOf(pid,'W1');doRecv();window.testGR=DB.all('grn').find(g=>g.po==='purchase').id;}""")
        assert page.evaluate("DB.get('grn',testGR).status")=='submitted'
        assert page.evaluate("!!DB.get('grn',testGR).batch&&DB.get('grn',testGR).items.every(i=>!!i.batch)")
        assert page.evaluate("qtyOf(DB.get('po','purchase').items[0].pid,'W1')===beforeQty")
        page.evaluate("testRole('keeper');grnReview(testGR,true)");assert page.evaluate("DB.get('grn',testGR).status")=='submitted'
        page.evaluate("testRole('acct');go('grn_view',{id:testGR})")
        page.get_by_role('button',name='财务审批通过',exact=True).click()
        assert page.evaluate("DB.get('grn',testGR).status")=='fin_ok'
        page.evaluate("testRole('clerk');go('grn_view',{id:testGR})")
        assert '内勤' in page.locator('#screen').inner_text()
        page.get_by_role('button',name='内勤审核确认',exact=True).click()
        assert page.evaluate("DB.get('grn',testGR).status")=='ready'
        assert page.evaluate("qtyOf(DB.get('po','purchase').items[0].pid,'W1')===beforeQty")
        page.evaluate("testRole('keeper');go('grn_view',{id:testGR})");page.get_by_role('button',name='确认入库',exact=True).click()
        assert page.evaluate("DB.get('grn',testGR).status")=='done'
        assert page.evaluate("qtyOf(DB.get('po','purchase').items[0].pid,'W1')===beforeQty+5")
        page.evaluate("grnReview(testGR,true)");assert page.evaluate("DB.all('moves').filter(m=>m.ref===testGR).length")==1
        # Every outgoing expense and payment goes through operations, with GM above 2000.
        for amount in [1,2000,2000.01]:
            page.evaluate("""amt=>{testRole('sales');DB.put('exp',{id:'expense-test',cat:'office',amt,note:'审批回归测试',by:'U3',status:'submitted',t:Date.now()});testRole('acct')}""",amount)
            assert page.evaluate("expAct(DB.get('exp','expense-test'))")=='', 'accountant cannot bypass operations'
            page.evaluate("testRole('gm')");assert page.evaluate("expAct(DB.get('exp','expense-test'))")==''
            page.evaluate("testRole('ops');expView('expense-test')");page.fill('#exN','运营同意');page.evaluate("expDo('expense-test',true)")
            assert page.evaluate("DB.get('exp','expense-test').status")==('gm_pending' if amount>2000 else 'approved')
            if amount>2000:
                page.evaluate("testRole('acct')");assert page.evaluate("expAct(DB.get('exp','expense-test'))")==''
                page.evaluate("testRole('gm');expView('expense-test')");page.fill('#exN','总经理同意');page.evaluate("expDo('expense-test',true)")
            page.evaluate("testRole('acct');expView('expense-test')");page.fill('#exN','财务入账');page.evaluate("expDo('expense-test',true)")
            page.evaluate("testRole('cashier');expView('expense-test')");page.fill('#exN','凭证123');page.evaluate("expDo('expense-test',true)")
            assert page.evaluate("DB.get('exp','expense-test').status")=='paid'
            page.evaluate("""amount=>{DB.put('fin',{id:'payment-test',type:'pay',ref:'purchase',refKind:'po',amount,status:'req',by:'U5',t:Date.now()});testRole('gm')}""",amount)
            assert not page.evaluate("payCanReview(DB.get('fin','payment-test'))")
            page.evaluate("testRole('ops');payGm('payment-test')");page.fill('#pgN','运营同意');page.evaluate("payGmDo('payment-test',true)")
            assert page.evaluate("DB.get('fin','payment-test').status")==('gm_pending' if amount>2000 else 'approved')
            if amount>2000:
                page.evaluate("testRole('cashier')");assert not page.evaluate("payReady(DB.get('fin','payment-test'))")
                page.evaluate("testRole('gm');payGm('payment-test')");page.fill('#pgN','总经理同意');page.evaluate("payGmDo('payment-test',true)")
            page.evaluate("testRole('cashier');finPaySheet('payment-test')");page.fill('#pyN','PAY123');page.evaluate("finPay('payment-test')")
            assert page.evaluate("DB.get('fin','payment-test').status")=='paid'
        # Every role can render their workbench and allowed document screens.
        for role in ['gm','ops','buyer','clerk','sales','field','keeper','acct','cashier']:
            page.evaluate('(r)=>{testRole(r);tab("docs")}',role)
            assert 'is not defined' not in page.locator('#screen').inner_text()
        page.evaluate("testRole('gm');closeSheet(true);go('grn_view',{id:testGR})")
        page.wait_for_timeout(350)
        assert not page.locator('#sheet').evaluate('e=>e.classList.contains("on")')
        assert '采购入库单' in page.locator('#screen').inner_text()
        assert page.evaluate("$('.phone').scrollTop")==0
        page.screenshot(path=str(ROOT.parent/f'v170-receipt-{file}.png'),full_page=True)
        # Stale approvals restore server data and remove dependent optimistic stock moves,
        # while preserving unrelated unsent work for the next sync.
        recovered=page.evaluate("""async()=>{DB.outbox=[];DB.cloud=true;S.token='offline-test';S.syncing=false;
          DB.put('so',{id:'stale-so',status:'shipped'});DB.put('moves',{id:'stale-move',ref:'stale-so',qty:-1,type:'so_out'});DB.put('partners',{id:'unrelated',n:'keep'});
          rpc=async(fn,args)=>{if(fn==='jxc_push')throw new Error('Approval changed or permission denied: ["stale-so"]');return {seq:99,rows:[{k:'so',d:{id:'stale-so',status:'rejected',u:1}}]}};
          await realSyncRun(true);const result={status:DB.get('so','stale-so').status,moves:DB.all('moves').filter(m=>m.id==='stale-move').length,pending:DB.outbox.map(o=>o.id)};DB.cloud=false;S.token=null;return result}""")
        assert recovered=={'status':'rejected','moves':0,'pending':['unrelated']},recovered
        assert not errors,errors
        results.append({'surface':file,'business':'passed','pageErrors':errors})
        context.close()
    browser.close()
server.shutdown()
print(json.dumps(results,ensure_ascii=False,indent=2))
