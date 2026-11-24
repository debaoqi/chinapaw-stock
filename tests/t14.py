import asyncio
from playwright.async_api import async_playwright
async def fillpw(pg,pw):
    await pg.evaluate("p=>{const r=roleOfCode(p);if(r){S.lgRole=r;LS.set('lgRole',r)}}",pw)
    await pg.fill('#lgPw',pw)

async def as_(pg,pw):
    await pg.evaluate("logout();S.view='login';render(true)");await fillpw(pg,pw);await pg.click('button.bigbtn');await pg.wait_for_timeout(500)
    return await pg.evaluate("S.me?S.me.role+'/'+S.me.code:document.querySelector('#lgErr').textContent")
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
        ctx=await b.new_context(viewport={'width':390,'height':844},locale='zh-CN',timezone_id='Africa/Accra');errs=[]
        A=await ctx.new_page();A.on('pageerror',lambda e:errs.append(str(e)))
        await A.goto('http://localhost:8765/');await A.wait_for_timeout(1200)
        print('GM:',await as_(A,'111111'));await A.evaluate("go('m_users')");await A.wait_for_timeout(200)
        print('departments:',await A.evaluate("$$('#screen .sec-h .badge').map(e=>e.textContent)"))
        # new position in 采购部
        await A.evaluate("S.eu=null;posSheet('pur')");await A.wait_for_timeout(150);await A.fill("#sheet input >> nth=0",'采购员');await A.evaluate("posSave(false)");await A.wait_for_timeout(200)
        await A.evaluate("S.eu=null;posSheet('fin')");await A.wait_for_timeout(150);await A.fill("#sheet input >> nth=0",'收银员');await A.click("#ep2R .chip:has-text('出纳')");await A.evaluate("posSave(false)");await A.wait_for_timeout(200)
        print('positions:',await A.evaluate("positions().map(p=>p.n.zh+'/'+p.role)"))
        # new account: choose 采购部 -> 采购员
        await A.evaluate("acctSheet(null,'pur')");await A.wait_for_timeout(150)
        print('position chips:',await A.evaluate("$$('#euRoles .chip').map(c=>c.textContent.trim())"))
        await A.click("#euRoles .chip:has-text('采购员')");await A.wait_for_timeout(150)
        print('auto code:',await A.evaluate("S.eu.code"),'| role:',await A.evaluate("S.eu.role"))
        # change department/position in the new dialog -> code follows
        await A.click("#sheet .chip:has-text('财务部')");await A.wait_for_timeout(100);await A.click("#euRoles .chip:has-text('收银员')");await A.wait_for_timeout(100)
        print('changed to 收银员: code',await A.evaluate("S.eu.code"),'role',await A.evaluate("S.eu.role"))
        await A.click("#sheet .chip:has-text('采购部')");await A.wait_for_timeout(100);await A.click("#euRoles .chip:has-text('采购员')");await A.wait_for_timeout(100)
        await A.fill("#sheet input >> nth=1",'阿杰');await A.fill('#euPw','buy888');await A.evaluate("acctSave()");await A.wait_for_timeout(400)
        u=await A.evaluate("DB.all('users').find(u=>u.name==='阿杰')");print('saved:',u['code'],u['role'],await A.evaluate("userTitle(DB.all('users').find(u=>u.name==='阿杰'))"))
        print('list shows title:',await A.evaluate("$('#screen').innerText.includes('采购员')"))
        # edit existing: change keeper to 采购员
        await A.evaluate("acctSheet('U4')");await A.wait_for_timeout(150);await A.click("#sheet .chip:has-text('采购部')");await A.wait_for_timeout(100);await A.click("#euRoles .chip:has-text('采购员')");await A.evaluate("acctSave()");await A.wait_for_timeout(300)
        print('U4 now:',await A.evaluate("[DB.get('users','U4').role,userTitle(DB.get('users','U4')),DB.get('users','U4').code]"))
        await A.evaluate("logout();S.view='login';S.lgRole=undefined;render(true)");await A.wait_for_timeout(200)
        print('login buttons:',await A.evaluate("$$('.rolebtn').map(b=>b.textContent)"))
        await A.click(".rolebtn:has-text('采购员')");await A.fill('#lgPw','buy888');await A.click('button.bigbtn');await A.wait_for_timeout(500)
        print('signed in as:',await A.evaluate("[S.me.role,userTitle(S.me)]"),'| home badge:',await A.evaluate("$('#screen').innerText.includes('采购员')"))
        print('ERRORS' if errs else 'NO ERRORS',errs[:3]);await b.close()
asyncio.run(main())
