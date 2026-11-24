# v1.1.1：登录页先选职位再输密码；不显示密码；网站端+后台合一；总经理授权他人使用后台
import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
        ctx=await b.new_context(viewport={'width':390,'height':844},locale='zh-CN',timezone_id='Africa/Accra');errs=[]
        pg=await ctx.new_page();pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto('http://localhost:8765/');await pg.wait_for_timeout(1500)
        txt=await pg.evaluate("document.querySelector('#screen').innerText")
        print('passwords shown on login?', any(x in txt for x in ['111111','222222','333333','444444','555555','666666']),'| roles shown:',await pg.evaluate("[...document.querySelectorAll('.rolebtn')].map(b=>b.textContent).join(',')"))
        await pg.screenshot(path='shots/v3_login.png')
        await pg.fill('#lgPw','222222');await pg.click('button.bigbtn:has-text("登录")');await pg.wait_for_timeout(400)
        print('no position chosen:',await pg.evaluate("$('#lgErr').textContent"))
        await pg.click('.rolebtn:has-text("销售经理")');await pg.fill('#lgPw','222222');await pg.click('button.bigbtn:has-text("登录")');await pg.wait_for_timeout(500)
        print('sales + buyer password:',await pg.evaluate("S.me?'LOGGED IN':$('#lgErr').textContent"))
        await pg.click('.rolebtn:has-text("采购主管")');await pg.screenshot(path='shots/v3_login_sel.png');await pg.fill('#lgPw','222222');await pg.click('button.bigbtn:has-text("登录")');await pg.wait_for_timeout(600)
        print('buyer + buyer password:',await pg.evaluate("S.me&&S.me.role"),'| can mgmt?',await pg.evaluate("can('mgmt')"))
        await pg.evaluate("logout();S.view='login';render(true)");await pg.click('.rolebtn:has-text("总经理")');await pg.fill('#lgPw','111111');await pg.click('button.bigbtn:has-text("登录")');await pg.wait_for_timeout(600)
        await pg.evaluate("go('m_users');acctSheet('U5')");await pg.wait_for_timeout(300)
        await pg.evaluate("S.eu.admin=true;acctSave()");await pg.wait_for_timeout(300);print('GM granted accountant backend:',await pg.evaluate("DB.get('users','U5').admin"))
        await pg.evaluate("logout();S.view='login';render(true)");await pg.click('.rolebtn:has-text("会计")');await pg.fill('#lgPw','555555');await pg.click('button.bigbtn:has-text("登录")');await pg.wait_for_timeout(600)
        print('accountant can mgmt:',await pg.evaluate("can('mgmt')"),'| opens m_users:',await pg.evaluate("go('m_users');S.view"))
        print('accountant edits GM:',await pg.evaluate("acctSheet('U1');document.querySelector('#toast').innerText"))
        print('grant toggle visible to accountant:',await pg.evaluate("acctSheet('U2');document.querySelector('#sheet').innerText.includes('授权使用后台')"))
        await pg.evaluate("closeSheet();acctSheet(null,'444444-2')");await pg.evaluate("S.eu.name='新库管';acctSave()");await pg.wait_for_timeout(300)
        print('accountant created 444444-2:',await pg.evaluate("!!DB.all('users').find(u=>u.code==='444444-2')"),'admin flag:',await pg.evaluate("DB.all('users').find(u=>u.code==='444444-2').admin"))
        # website: single address, admin redirects
        w=await (await b.new_context(viewport={'width':1366,'height':820},locale='zh-CN')).new_page();w.on('pageerror',lambda e:errs.append('W '+str(e)))
        await w.goto('http://localhost:8765/admin/');await w.wait_for_timeout(1500);print('old /admin/ ->',w.url.split('/')[-1])
        await fillpw(w,'111111');await w.click('button.bigbtn:has-text("登录")');await w.wait_for_timeout(800)
        print('web after login:',await w.evaluate("S.view"),'| sidebar has 后台管理:',await w.evaluate("document.querySelector('nav').innerText.includes('后台管理')"))
        await w.screenshot(path='shots/v3_web_mgmt.png')
        await w.evaluate("logout();S.view='login';render(true)");await w.wait_for_timeout(300);await w.screenshot(path='shots/v3_web_login.png')
        print('\n'.join(errs) or 'NO ERRORS');await b.close()
async def fillpw(pg,pw):
    await pg.evaluate("p=>{const r=roleOfCode(p);if(r){S.lgRole=r}}",pw);await pg.fill('#lgPw',pw)
asyncio.run(main())
