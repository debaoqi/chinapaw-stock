import asyncio,sys
from playwright.async_api import async_playwright
VIEWS=['home','stock','docs','logi','me','report','msgs','logi_svc','recv_pick','take','po_new','so_new','ship_new','pr_new','sr_new']
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
        ctx=await b.new_context(viewport={'width':390,'height':844},locale='zh-CN')
        pg=await ctx.new_page();errs=[]
        pg.on('pageerror',lambda e:errs.append('PAGEERR '+str(e)))
        pg.on('console',lambda m:errs.append('CONSOLE '+m.text) if m.type=='error' else None)
        await pg.goto('http://localhost:8765/');await pg.wait_for_timeout(1500)
        await pg.screenshot(path='shots/login.png')
        await pg.fill('#lgPhone','0240000001');await pg.fill('#lgPw','123456');await pg.click('button.bigbtn');await pg.wait_for_timeout(1200);print('VIEW',await pg.evaluate('S.view'),await pg.evaluate('document.querySelector("#lgErr")&&document.querySelector("#lgErr").textContent'))
        for lang in ['zh','en']:
            await pg.evaluate(f"setLang('{lang}')")
            for v in VIEWS:
                await pg.evaluate(f"S.form=null;tab('home');go('{v}')" if v not in ('home','stock','docs','logi','me') else f"tab('{v}')")
                await pg.wait_for_timeout(250)
                await pg.screenshot(path=f'shots/{lang}_{v}.png')
                if lang=='en':
                    txt=await pg.evaluate("(()=>{const w=document.createTreeWalker(document.querySelector('.phone'),NodeFilter.SHOW_TEXT);let n,o=[];while(n=w.nextNode()){if(n.parentElement.closest('[data-notr]'))continue;if(/[\\u4e00-\\u9fff]/.test(n.nodeValue))o.push(n.nodeValue.trim().slice(0,40))}return o})()")
                    if txt: errs.append(f'ZH-IN-EN {v}: {txt[:6]}')
                else:
                    txt=await pg.evaluate("(()=>{const w=document.createTreeWalker(document.querySelector('#screen'),NodeFilter.SHOW_TEXT);let n,o=[];while(n=w.nextNode()){if(n.parentElement.closest('[data-notr],script,style'))continue;const t=n.nodeValue.trim();if(/[A-Za-z]{3,}/.test(t))o.push(t.slice(0,40))}return o})()")
                    if txt: errs.append(f'EN-IN-ZH {v}: {txt[:8]}')
        print('\n'.join(errs) or 'NO ERRORS')
        await b.close()
asyncio.run(main())
