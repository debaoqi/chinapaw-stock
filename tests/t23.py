import asyncio
from playwright.async_api import async_playwright
U='http://localhost:8766/'
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox']);out={}
        for code,role in [('444444','keeper'),('222222','buyer'),('666666','cashier'),('555555','acct')]:
            c=await b.new_context(locale='zh-CN');pg=await c.new_page();await pg.goto(U);await pg.wait_for_timeout(1000)
            await pg.evaluate("r=>{S.lgRole=r;S.lgDept=deptOf(r).id;S.lgPos=null;S.lgUid=null}",role);await pg.fill('#lgPw','666666');await pg.click('button.bigbtn');await pg.wait_for_timeout(2500)
            await pg.evaluate("DB.put('att',{type:'in',t:Date.now(),lat:5.6,lng:-0.18,acc:10,addr:'x',photo:'',thumb:'',cus:'',note:'',wh:S.me.wh})");await pg.wait_for_timeout(500)
            await pg.evaluate("Sync.run(true)");await pg.wait_for_timeout(2500)
            out[role]=await pg.evaluate("[S.me&&S.me.role,DB.outbox.length,DB.all('att').filter(a=>a.by===S.me.id).length]");await c.close()
        c=await b.new_context(locale='zh-CN');pg=await c.new_page();await pg.goto(U);await pg.wait_for_timeout(1000)
        await pg.evaluate("r=>{S.lgRole=r;S.lgDept=deptOf(r).id;S.lgPos=null;S.lgUid=null}",'ops');await pg.fill('#lgPw','666666');await pg.click('button.bigbtn');await pg.wait_for_timeout(3000)
        print('saved on server per role [role,outbox,mine]:',out);print('ops sees att records:',await pg.evaluate("DB.all('att').length"))
        await b.close()
asyncio.run(main())
