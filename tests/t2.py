import asyncio
from playwright.async_api import async_playwright
async def as_(pg,pw):
    await pg.evaluate("logout();S.view='login';render(true)");await pg.fill('#lgPw',pw);await pg.click('button.bigbtn');await pg.wait_for_timeout(500)
    return await pg.evaluate("S.me?S.me.role+'/'+S.me.code:document.querySelector('#lgErr').textContent")
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
        ctx=await b.new_context(viewport={'width':390,'height':844},locale='zh-CN',timezone_id='Africa/Accra');errs=[]
        A=await ctx.new_page();K=await ctx.new_page()
        for pg in (A,K):pg.on('pageerror',lambda e:errs.append(str(e)))
        await A.goto('http://localhost:8765/');await A.wait_for_timeout(1200);await K.goto('http://localhost:8765/');await K.wait_for_timeout(1000)
        print('sales:',await as_(A,'333333'))
        await K.evaluate("S.me=(({pw,...u})=>u)(DB.get('users','U4'));tab('home')")
        q0=await K.evaluate("qtyOf('P1','W2')")
        await A.evaluate("S.form=null;go('so_new',{add:'P1'})");await A.wait_for_timeout(200)
        await A.select_option('select.inp >> nth=0','C1');await A.select_option('select.inp >> nth=1','W2');await A.evaluate("S.form.items[0].qty=20")
        await A.click(".bbar button >> nth=-1");await A.wait_for_timeout(700);so=await A.evaluate("S.params.id")
        await K.wait_for_timeout(500);print('keeper banner:',await K.evaluate("document.querySelector('#banner').classList.contains('on')&&document.querySelector('#banner').innerText.replace(/\\n/g,' ')"))
        await K.evaluate(f"go('so_view',{{id:'{so}'}})");await K.wait_for_timeout(200);await K.click(".bbar button:has-text('确认发货')");await K.wait_for_timeout(200)
        await K.click("text=确认出库，扣减库存");await K.wait_for_timeout(500);print('shipped; stock',q0,'->',await K.evaluate("qtyOf('P1','W2')"))
        # sales return: request only
        await A.evaluate(f"S.form=null;go('sr_new',{{so:'{so}'}})");await A.wait_for_timeout(200);await A.evaluate("S.form.lines[0].qty=5");await A.click(".bbar button");await A.wait_for_timeout(500)
        sr=await A.evaluate("DB.all('sr').sort((a,b)=>b.t-a.t)[0].id");print('return pending; stock still',await A.evaluate("qtyOf('P1','W2')"),await A.evaluate(f"DB.get('sr','{sr}').status"))
        print('sales can exec return?',await A.evaluate("can('sr_exec')"))
        await K.wait_for_timeout(400);await K.evaluate(f"retExec('sr','{sr}')");await K.wait_for_timeout(300);print('keeper received; stock',await K.evaluate("qtyOf('P1','W2')"),await K.evaluate(f"DB.get('sr','{sr}').status"))
        # finance: cashier records receipt, accountant verifies
        print('cashier:',await as_(A,'666666'))
        await A.evaluate(f"arSheet('{so}')");await A.wait_for_timeout(300);bal=await A.evaluate(f"arOf(DB.get('so','{so}')).bal")
        await A.fill('#rcA',str(round(bal/2,2)));await A.click("#sheet .chip:has-text('手机钱包')");await A.click("text=确认收款");await A.wait_for_timeout(300)
        f=await A.evaluate(f"DB.all('fin').find(x=>x.ref==='{so}')");print('receipt',f['amount'],f['method'],f['status'],'| cashier can verify?',await A.evaluate("can('fin_verify')"),'approve?',await A.evaluate("can('fin_approve')"))
        print('accountant:',await as_(A,'555555'))
        await A.evaluate(f"arSheet('{so}')");await A.wait_for_timeout(300);await A.click("#sheet button:has-text('核对')");await A.wait_for_timeout(300)
        print('verified:',await A.evaluate(f"DB.all('fin').find(x=>x.ref==='{so}').status"),'| acct can record receipts?',await A.evaluate("can('fin_receive')"),'pay?',await A.evaluate("can('fin_pay')"))
        po=await A.evaluate("apDocs().find(p=>apOf(p).free>0).id");await A.evaluate(f"apSheet('{po}')");await A.wait_for_timeout(300)
        await A.fill('#apA','1000');await A.click("text=审批，交出纳付款");await A.wait_for_timeout(300)
        fid=await A.evaluate(f"DB.all('fin').filter(x=>x.ref==='{po}'&&x.status==='approved').sort((a,b)=>b.t-a.t)[0].id")
        print('cashier:',await as_(A,'666666'));await A.evaluate(f"finPaySheet('{fid}')");await A.wait_for_timeout(200);await A.click("text=确认已付款");await A.wait_for_timeout(300)
        print('paid:',await A.evaluate(f"DB.get('fin','{fid}').status"),await A.evaluate(f"apOf(DB.get('po','{po}')).paid"))
        # department isolation
        print('cashier sees stock?',await A.evaluate("can('stock')"),'| buyer sees finance?',await A.evaluate("can('fin',{role:'buyer'})"),'| sales sees cost?',await A.evaluate("can('cost',{role:'sales'})"))
        # accounts
        print('GM:',await as_(A,'111111'))
        await A.evaluate("go('m_users');acctSheet(null,'333333-1')");await A.wait_for_timeout(200);await A.evaluate("S.eu.name='新销售'");await A.evaluate("acctSave()");await A.wait_for_timeout(300)
        print('new 333333-1 login:',await as_(A,'333333-1'))
        print('GM:',await as_(A,'111111'))
        u=await A.evaluate("DB.all('users').find(u=>u.code==='333333-1').id")
        await A.evaluate(f"acctSheet('{u}')");await A.wait_for_timeout(200);await A.fill('#euPw','222222');await A.evaluate("acctSave()");await A.wait_for_timeout(300)
        print('duplicate password blocked:',await A.evaluate("$('#euE').textContent"))
        await A.fill('#euPw','sales2026');await A.evaluate("S.eu.active=false;acctSave()");await A.wait_for_timeout(300)
        print('disabled login:',await as_(A,'sales2026'))
        print('GM:',await as_(A,'111111'));await A.evaluate("go('me');pwdSheet()");await A.fill('#pw0','111111');await A.fill('#pw1','gm8888x');await A.fill('#pw2','gm8888x');await A.evaluate("doPw()");await A.wait_for_timeout(300)
        print('old GM pw:',await as_(A,'111111'),'| new:',await as_(A,'gm8888x'))
        # stores
        await A.evaluate("platformSheet()");await A.wait_for_timeout(200);await A.fill('#plPw','888888');await A.evaluate("S.pl.vip=false;planSave()");await A.wait_for_timeout(400)
        print('free plan stores:',await A.evaluate("activeWh().map(w=>w.id)"),'| new store blocked:',await A.evaluate("storeEdit();$('#sheet .sh').textContent"))
        await A.evaluate("closeSheet();platformSheet()");await A.wait_for_timeout(200);await A.fill('#plPw','wrong');await A.evaluate("S.pl.vip=true;S.pl.limit=4;planSave()");await A.wait_for_timeout(300)
        print('wrong platform pw:',await A.evaluate("$('#plE').textContent"))
        await A.fill('#plPw','888888');await A.evaluate("planSave()");await A.wait_for_timeout(300);print('VIP 4 stores:',await A.evaluate("[plan().vip,plan().limit,activeWh().length]"))
        # lockout
        for i in range(5): r=await as_(A,'000000')
        print('after 5 wrong:',await as_(A,'gm8888x'))
        print('\n'.join(errs) or 'NO ERRORS');await b.close()
asyncio.run(main())
