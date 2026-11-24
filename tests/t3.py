import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
        ctx=await b.new_context(viewport={'width':390,'height':844},locale='zh-CN')
        a=await ctx.new_page();k=await ctx.new_page();errs=[]
        for pg in (a,k): pg.on('console',lambda m:errs.append(m.type+' '+m.text))
        await a.goto('http://localhost:8765/');await a.wait_for_timeout(1200)
        await k.goto('http://localhost:8765/');await k.wait_for_timeout(1000)
        await k.evaluate("S.me=(({pw,...u})=>u)(DB.get('users','U4'));tab('home');window._got=[];BC.addEventListener('message',e=>_got.push(e.data.type+':'+(e.data.rows||[]).map(r=>r.k).join(',')))")
        await a.evaluate("S.me=(({pw,...u})=>u)(DB.get('users','U3'));DB.put('so',{no:'SOX',cus:'C1',wh:'W2',items:[{pid:'P1',qty:1,price:9}],status:'submitted',t:Date.now()})")
        await k.wait_for_timeout(800)
        print(await k.evaluate("_got"),await k.evaluate("Alerts.list().slice(0,2).map(n=>n.zh)"),await k.evaluate("document.querySelector('#banner').className"))
        print(errs)
        await b.close()
asyncio.run(main())
