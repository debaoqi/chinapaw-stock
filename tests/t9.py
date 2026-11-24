# 网站端 web.html 与后台 admin/：电脑宽屏
import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
        ctx=await b.new_context(viewport={'width':1366,'height':820},locale='zh-CN',timezone_id='Africa/Accra',accept_downloads=True)
        pg=await ctx.new_page();errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto('http://localhost:8765/web.html');await pg.wait_for_timeout(1500);await pg.screenshot(path='shots/web_login.png')
        await pg.fill('#lgPw','111111');await pg.click('button.bigbtn');await pg.wait_for_timeout(1200)
        for v in ['home','stock','docs','fin','logi','report','m_users','m_stores']:
            await pg.evaluate(f"S.hist=[];S.view='{v}';render(true)");await pg.wait_for_timeout(300);await pg.screenshot(path=f'shots/web_{v}.png')
            ov=await pg.evaluate("[...document.querySelectorAll('#screen *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1&&!e.closest('.chips')).length")
            if ov: errs.append(f'overflow {v} {ov}')
        await pg.evaluate("arSheet(arDocs()[0].id)");await pg.wait_for_timeout(400);await pg.screenshot(path='shots/web_sheet.png')
        async with pg.expect_download() as dl: await pg.evaluate("closeSheet();exportReport('ar')")
        d=await dl.value;await d.save_as('/tmp/ar.xlsx');print('download',d.suggested_filename)
        # admin: non-GM refused
        ad=await ctx.new_page();ad.on('pageerror',lambda e:errs.append('ADMIN '+str(e)))
        await ad.goto('http://localhost:8765/admin/');await ad.wait_for_timeout(1200)
        await ad.fill('#lgPw','222222');await ad.click('button.bigbtn');await ad.wait_for_timeout(800)
        print('admin with 222222:',await ad.evaluate("[S.view,document.querySelector('#lgErr').textContent]"))
        await ad.fill('#lgPw','111111');await ad.click('button.bigbtn');await ad.wait_for_timeout(800)
        print('admin with 111111:',await ad.evaluate("S.view"));await ad.screenshot(path='shots/admin_mgmt.png')
        print('\n'.join(errs) or 'NO ERRORS');await b.close()
asyncio.run(main())
