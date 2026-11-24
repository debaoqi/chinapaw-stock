import asyncio
from playwright.async_api import async_playwright
U='http://localhost:8766/'
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
        errs=[]
        def hook(pg,tag):
            pg.on('pageerror',lambda e:errs.append(tag+' PAGEERR '+str(e)));pg.on('console',lambda m:errs.append(tag+' '+m.text) if m.type=='error' else None)
        # 管理员：导入演示数据
        ca=await b.new_context(viewport={'width':1280,'height':800},locale='zh-CN');ad=await ca.new_page();hook(ad,'ADMIN')
        ad.on('dialog',lambda d:asyncio.ensure_future(d.accept()))
        await ad.goto(U+'admin/');await ad.wait_for_timeout(1000)
        await ad.fill('#lgPhone','0240000001');await ad.fill('#lgPw','test-pw-1');await ad.click('button.bigbtn');await ad.wait_for_timeout(1200)
        print('admin view',await ad.evaluate('S.view'),'users',await ad.evaluate("DB.all('users').length"))
        await ad.evaluate("go('backup')");await ad.evaluate("bkDemo()");await ad.wait_for_timeout(6000)
        print('admin outbox left',await ad.evaluate('DB.outbox.length'),'seq',await ad.evaluate('DB.seq'))
        # 设备 A：销售员；设备 B：库管（不同浏览器环境 = 不同手机）
        cA=await b.new_context(viewport={'width':390,'height':844},locale='zh-CN');A=await cA.new_page();hook(A,'A')
        cB=await b.new_context(viewport={'width':390,'height':844},locale='zh-CN');B=await cB.new_page();hook(B,'B')
        for pg,ph,pw in ((A,'0240000003','newpass1'),(B,'0240000004','keeper-pw')):
            await pg.goto(U);await pg.wait_for_timeout(900);await pg.fill('#lgPhone',ph);await pg.fill('#lgPw',pw);await pg.click('button.bigbtn');await pg.wait_for_timeout(2500)
        print('A role',await A.evaluate('S.me.role'),'products',await A.evaluate("DB.all('products').length"),'moves',await A.evaluate("DB.all('moves').length"))
        print('B stock P1/W2',await B.evaluate("qtyOf('P1','W2')"))
        await A.evaluate("S.form=null;go('so_new',{add:'P1'})");await A.wait_for_timeout(300)
        await A.select_option('select.inp >> nth=0','C1');await A.select_option('select.inp >> nth=1','W2');await A.evaluate("S.form.items[0].qty=12")
        await A.click(".bbar button:has-text('提交') >> nth=-1");await A.wait_for_timeout(1500)
        so=await A.evaluate('S.params.id');print('A outbox',await A.evaluate('DB.outbox.length'))
        for i in range(12):
            await B.wait_for_timeout(1000)
            if await B.evaluate(f"!!DB.get('so','{so}')"):break
        print('B got SO after ~',i+1,'s; banner:',await B.evaluate("document.querySelector('#banner').innerText.replace(/\\n/g,' ')"))
        await B.evaluate(f"go('so_view',{{id:'{so}'}})");await B.wait_for_timeout(300);await B.click(".bbar button:has-text('确认发货')");await B.wait_for_timeout(300)
        await B.click("text=确认出库，扣减库存");await B.wait_for_timeout(2000)
        for i in range(12):
            await A.wait_for_timeout(1000)
            if await A.evaluate(f"DB.get('so','{so}').status")=='shipped':break
        print('A sees shipped after ~',i+1,'s; A stock P1/W2',await A.evaluate("qtyOf('P1','W2')"))
        # 离线开单
        await cA.set_offline(True);await A.wait_for_timeout(300)
        await A.evaluate("S.form=null;go('so_new',{add:'P8'})");await A.wait_for_timeout(300);await A.select_option('select.inp >> nth=0','C2')
        await A.click(".bbar button:has-text('提交') >> nth=-1");await A.wait_for_timeout(800);so2=await A.evaluate('S.params.id')
        print('offline: outbox',await A.evaluate('DB.outbox.length'))
        await A.wait_for_timeout(3000);print('B has offline SO yet?',await B.evaluate(f"!!DB.get('so','{so2}')"))
        await cA.set_offline(False);await A.wait_for_timeout(2500)
        print('online: A outbox',await A.evaluate('DB.outbox.length'))
        for i in range(12):
            await B.wait_for_timeout(1000)
            if await B.evaluate(f"!!DB.get('so','{so2}')"):break
        print('B got offline SO after ~',i+1,'s')
        # 权限：销售员不能写入库流水（伪造）
        await A.evaluate("DB.put('moves',{pid:'P1',wh:'W1',qty:999,type:'po_in',t:Date.now()})");await A.wait_for_timeout(2500)
        print('server rejected forged move; toast:',await A.evaluate("document.querySelector('#toast').innerText"),'| local P1/W1 restored:',await A.evaluate("qtyOf('P1','W1')")==await B.evaluate("qtyOf('P1','W1')"))
        await A.screenshot(path='shots/cloud_A.png');await B.screenshot(path='shots/cloud_B.png')
        print('\n'.join(e for e in errs if 'favicon' not in e) or 'NO ERRORS');await b.close()
asyncio.run(main())
