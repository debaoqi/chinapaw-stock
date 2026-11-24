import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox']);errs=[]
        ctx=await b.new_context(viewport={'width':360,'height':780},device_scale_factor=2,locale='zh-CN',timezone_id='Africa/Accra')
        await ctx.route("**/open.er-api.com/**",lambda r:r.fulfill(status=200,content_type='application/json',body='{"result":"success","rates":{"GHS":1.65,"CNY":1}}'))
        pg=await ctx.new_page();pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto('http://localhost:8765/?demo=1');await pg.wait_for_timeout(1500)
        await pg.evaluate("LS.del('fc');LS.del('fxCNY');LS.del('fxCNYman');S.lgDept='gmo';S.lgRole='gm';S.lgPos=null");await pg.fill('#lgPw','111111');await pg.click('button.bigbtn');await pg.wait_for_timeout(800)
        await pg.evaluate("go('logi_svc')");await pg.wait_for_timeout(1200)
        print('defaults:',await pg.evaluate("[S.fc.mode,S.fc.p,S.fc.cur,fxCNY()]"))
        await pg.evaluate("S.fc.cbm=3;S.fc.clr=[{q:5,u:'台',p:50,cur:'GHS'}];S.fc.oth=[{n:'提货费',a:200,cur:'GHS'}];render(false)");await pg.wait_for_timeout(400)
        print(await pg.evaluate("$('#fcOut').innerText.replace(/\\n+/g,' | ')"))
        await pg.screenshot(path='/tmp/d1.png',full_page=False)
        await pg.evaluate("document.querySelector('#fcOut').scrollIntoView({block:'end'})");await pg.wait_for_timeout(200);await pg.screenshot(path='/tmp/d2.png')
        await pg.evaluate("setFxMan(1.7)");await pg.wait_for_timeout(300);print('manual fx total:',await pg.evaluate("$('#fcOut').innerText.split('合计')[1].trim().split('\\n')[0]"))
        await pg.evaluate("setFxMan(0)");
        # shipment auto cost converted
        await pg.evaluate("tab('logi');go('ship_new')");await pg.wait_for_timeout(300)
        r=await pg.evaluate("S.form.mode='sea';S.form.cbm=3;render(false);[S.form.cost,shCostHint()]");print('shipment cost:',r)
        # payment reference
        fid=await pg.evaluate("(DB.all('fin').find(f=>f.type==='pay'&&f.status==='approved')||{}).id")
        await pg.evaluate("logout()");await pg.evaluate("S.view='login';S.lgDept='fin';S.lgRole='cashier';S.lgPos=null;render(true)");await pg.fill('#lgPw','666666');await pg.click('button.bigbtn');await pg.wait_for_timeout(700)
        await pg.evaluate(f"finPaySheet('{fid}')");await pg.wait_for_timeout(200)
        out=[]
        for m in ['cash','bank','momo']:
            await pg.click(f"#sheet .chip[data-m='{m}']");out.append(await pg.evaluate("$('#pyN').placeholder"))
        print('pay placeholders:',out)
        await pg.click("#sheet .chip[data-m='cash']");await pg.evaluate(f"finPay('{fid}')");await pg.wait_for_timeout(200);print('toast:',await pg.evaluate("($('.toast')||{}).textContent||''"))
        print('ERRORS' if errs else 'NO ERRORS',errs[:3]);await b.close()
asyncio.run(main())
