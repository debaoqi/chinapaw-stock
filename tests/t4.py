import asyncio
from playwright.async_api import async_playwright
async def fillpw(pg,pw):
    await pg.evaluate("p=>{const r=roleOfCode(p);if(r){S.lgRole=r;S.lgPos=null;S.lgDept=deptOf(r).id;LS.set('lgRole',r)}}",pw)
    await pg.fill('#lgPw',pw)

async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
        ctx=await b.new_context(viewport={'width':1280,'height':820},locale='zh-CN');pg=await ctx.new_page();errs=[]
        pg.on('pageerror',lambda e:errs.append('PAGEERR '+str(e)));pg.on('console',lambda m:errs.append('CONSOLE '+m.text) if m.type=='error' else None)
        await pg.goto('http://localhost:8765/admin/');await pg.wait_for_timeout(1500)
        await pg.screenshot(path='shots/a_login.png')
        await pg.fill('#lgPhone','0240000001');await fillpw(pg,'123456');await pg.click('button.bigbtn');await pg.wait_for_timeout(800)
        for lang in ['zh','en']:
            await pg.evaluate(f"setLang('{lang}')")
            for v in ['dash','products','stock','users','partners','wh','counts','ships','log','settings','backup','release']:
                await pg.evaluate(f"go('{v}')");await pg.wait_for_timeout(250)
                if lang=='zh' and v in ('dash','products','users','ships'):await pg.screenshot(path=f'shots/a_{v}.png')
                if lang=='en':
                    t=await pg.evaluate("(()=>{const w=document.createTreeWalker(document.querySelector('.phone'),NodeFilter.SHOW_TEXT);let n,o=[];while(n=w.nextNode()){if(n.parentElement.closest('[data-notr]'))continue;if(/[\\u4e00-\\u9fff]/.test(n.nodeValue))o.push(n.nodeValue.trim().slice(0,30))}return o})()")
                    if t: errs.append(f'ZH-IN-EN {v}: {t[:5]}')
        # product edit + user create
        await pg.evaluate("setLang('zh');go('products');prodEdit()");await pg.wait_for_timeout(300)
        await pg.evaluate("S.ep.n.zh='测试商品';S.ep.code='T-1';S.ep.price=10;prodSave()");print('product added',await pg.evaluate("!!DB.all('products').find(p=>p.code==='T-1')"))
        await pg.evaluate("go('users');userEdit()");await pg.wait_for_timeout(300);await pg.evaluate("S.eu.name='新员工';S.eu.phone='0240000009'");await pg.fill('#euPw','abcdef');await pg.evaluate("userSave()");await pg.wait_for_timeout(300)
        print('user added',await pg.evaluate("!!DB.all('users').find(u=>u.phone==='0240000009')"))
        # new user logs in on app
        app=await ctx.new_page();await app.goto('http://localhost:8765/?demo=1');await app.wait_for_timeout(1200)
        await app.fill('#lgPhone','0240000009');await fillpw(app,'abcdef');await app.click('button.bigbtn');await app.wait_for_timeout(800)
        print('app login as',await app.evaluate("S.me&&S.me.role"),'admin still',await pg.evaluate("S.me.role"))
        print('\n'.join(errs) or 'NO ERRORS');await b.close()
asyncio.run(main())
