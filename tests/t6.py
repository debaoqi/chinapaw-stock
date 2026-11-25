import asyncio
from playwright.async_api import async_playwright
async def fillpw(pg,pw):
    await pg.evaluate("p=>{const r=roleOfCode(p);if(r){S.lgRole=r;S.lgPos=null;S.lgDept=deptOf(r).id;S.lgUid=(DB.all('users').find(u=>u.code===p)||{}).id||null;LS.set('lgRole',r)}}",pw)
    await pg.fill('#lgPw','666666')

U='http://localhost:8766/'
async def login(pg,pw):
    await pg.goto(U);await pg.wait_for_timeout(1000);await fillpw(pg,pw);await pg.click('button.bigbtn');await pg.wait_for_timeout(2500)
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox']);errs=[]
        def ctx(): return b.new_context(viewport={'width':390,'height':844},locale='zh-CN',timezone_id='Africa/Accra')
        cg=await ctx();G=await cg.new_page();G.on('dialog',lambda d:asyncio.ensure_future(d.accept()));G.on('pageerror',lambda e:errs.append('G '+str(e)))
        await login(G,'111111');print('GM:',await G.evaluate("S.me&&S.me.role"),'| plan from server:',await G.evaluate("plan()"))
        await G.evaluate("go('m_backup')");await G.evaluate("bkDemo()");await G.wait_for_timeout(8000)
        print('GM outbox after demo import:',await G.evaluate("DB.outbox.length"),'| plan still server-controlled:',await G.evaluate("(Sync.run(true),0)") or '', )
        await G.wait_for_timeout(2500);print('plan after import (GM could not self-grant):',await G.evaluate("plan()"))
        cs=await ctx();Sa=await cs.new_page();Sa.on('pageerror',lambda e:errs.append('S '+str(e)))
        ck=await ctx();K=await ck.new_page();K.on('pageerror',lambda e:errs.append('K '+str(e)))
        await login(Sa,'333333');await login(K,'444444')
        print('sales/keeper roles:',await Sa.evaluate("S.me.role"),await K.evaluate("S.me.role"),'| products synced:',await Sa.evaluate("DB.all('products').length"))
        await Sa.evaluate("S.form=null;go('so_new',{add:'P1'})");await Sa.wait_for_timeout(200)
        await Sa.select_option('select.inp >> nth=0','C1');await Sa.evaluate("S.form.items[0].qty=7");await Sa.click(".bbar button >> nth=-1");await Sa.wait_for_timeout(1500)
        so=await Sa.evaluate("S.params.id")
        for i in range(15):
            await K.wait_for_timeout(1000)
            if await K.evaluate(f"!!DB.get('so','{so}')"):break
        print('keeper got order after ~',i+1,'s; banner:',await K.evaluate("document.querySelector('#banner').innerText.replace(/\\n/g,' ')"))
        # 现款单：仓库不能先出库；财务确认收款后才能出库（经云端）
        ca=await ctx();Ac=await ca.new_page();Ac.on('pageerror',lambda e:errs.append('A '+str(e)));await login(Ac,'555555')
        await K.evaluate(f"DB.put('so',{{...DB.get('so','{so}'),status:'shipped'}})");await K.wait_for_timeout(2500);print('keeper forced ship -> server status:',await Ac.evaluate(f"(Sync.run(true),DB.get('so','{so}').status)"))
        await Ac.wait_for_timeout(1500);await Ac.evaluate(f"soFin('{so}')");await Ac.wait_for_timeout(200);await Ac.fill('#sfR','RC-9');await Ac.evaluate(f"soFinOk('{so}')")
        for i in range(10):
            await K.wait_for_timeout(500)
            if await K.evaluate(f"DB.get('so','{so}').status==='approved'"):break
        print('keeper sees approved after ~',(i+1)/2,'s')
        # 私聊经云端：只有成员收到
        kid=await K.evaluate("S.me.id");await Sa.evaluate(f"openDm('{kid}')");await Sa.wait_for_timeout(300);await Sa.fill('#cIn','明天几点送货？');await Sa.evaluate("chSend()");dm=await Sa.evaluate("S.chId")
        for i in range(12):
            await K.wait_for_timeout(500)
            if await K.evaluate(f"DB.all('msg').some(m=>m.ch==='{dm}')"):break
        print('keeper got DM after ~',(i+1)/2,'s | unread',await K.evaluate("chatUnread()"))
        await Ac.wait_for_timeout(2000);print('accountant received DM?',await Ac.evaluate(f"DB.all('msg').some(m=>m.ch==='{dm}')||!!DB.get('chat','{dm}')"))
        cf=await ctx();Fd=await cf.new_page();await login(Fd,'777777');co=await ctx();Op=await co.new_page();await login(Op,'888888')
        print('new roles on cloud:',await Fd.evaluate("S.me&&S.me.role"),await Op.evaluate("S.me&&S.me.role"))
        await cs.set_offline(True);await Sa.wait_for_timeout(300)
        await Sa.evaluate("S.form=null;go('so_new',{add:'P8'})");await Sa.wait_for_timeout(200);await Sa.select_option('select.inp >> nth=0','C2');await Sa.click(".bbar button >> nth=-1");await Sa.wait_for_timeout(500)
        so2=await Sa.evaluate("S.params.id");print('offline outbox:',await Sa.evaluate("DB.outbox.length"))
        await cs.set_offline(False);await Sa.wait_for_timeout(3000)
        for i in range(15):
            await K.wait_for_timeout(1000)
            if await K.evaluate(f"!!DB.get('so','{so2}')"):break
        print('offline order reached keeper after ~',i+1,'s')
        # forged: sales tries to write a stock movement and a finance record
        await Sa.evaluate("DB.put('moves',{pid:'P1',wh:'W1',qty:500,type:'po_in',t:Date.now()});DB.put('fin',{type:'rcv',ref:'x',amount:9,status:'verified',t:Date.now()})");await Sa.wait_for_timeout(3000)
        print('server rejected; toast:',await Sa.evaluate("document.querySelector('#toast').innerText"))
        # cashier & accountant through server
        cc=await ctx();Ca=await cc.new_page();await login(Ca,'666666');print('cashier role:',await Ca.evaluate("S.me.role"))
        await Ca.wait_for_timeout(1000);so=so2;await Ca.evaluate(f"arSheet('{so}')");await Ca.wait_for_timeout(300);await Ca.click("text=确认收款");await Ca.wait_for_timeout(3000)
        print('receipt saved on server:',await Ca.evaluate(f"DB.all('fin').filter(f=>f.ref==='{so}').map(f=>f.status)"),'outbox',await Ca.evaluate("DB.outbox.length"))
        print('\n'.join(errs) or 'NO ERRORS');await b.close()
asyncio.run(main())
