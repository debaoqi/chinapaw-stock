import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
        pg=await (await b.new_context(viewport={'width':390,'height':844},locale='zh-CN')).new_page()
        await pg.goto('http://localhost:8765/');await pg.wait_for_timeout(1000)
        await pg.fill('#lgPhone','0240000003');await pg.fill('#lgPw','123456');await pg.click('button.bigbtn');await pg.wait_for_timeout(600)
        await pg.evaluate("checkUpdate(false)");await pg.wait_for_timeout(800);await pg.screenshot(path='shots/upd.png')
        print('sheet:',await pg.evaluate("document.querySelector('#sheet').innerText.replace(/\\n/g,' | ')"))
        await pg.evaluate("closeSheet();tab('me')");await pg.wait_for_timeout(300);print('update bar:',await pg.evaluate("(document.querySelector('.updbar')||{}).innerText"))
        await pg.evaluate("doUpdate()");await pg.wait_for_timeout(1500);print('reloaded url',pg.url)
        await b.close()
asyncio.run(main())
