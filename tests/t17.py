import asyncio
from playwright.async_api import async_playwright
async def fillpw(pg,pw):
    await pg.evaluate("p=>{const r=roleOfCode(p);if(r){S.lgRole=r;S.lgPos=null;S.lgDept=deptOf(r).id;LS.set('lgRole',r)}}",pw)
    await pg.fill('#lgPw',pw)

async def as_(pg,pw):
    await pg.evaluate("logout();S.view='login';render(true)");await fillpw(pg,pw);await pg.click('button.bigbtn');await pg.wait_for_timeout(500)
    return await pg.evaluate("S.me?S.me.role+'/'+S.me.code:document.querySelector('#lgErr').textContent")
async def login(A,code):
    await A.evaluate("logout();S.view='login';render(true)");await A.wait_for_timeout(150);return await as_(A,code)
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
        ctx=await b.new_context(viewport={'width':390,'height':844},locale='zh-CN',timezone_id='Africa/Accra',geolocation={'latitude':6.6885,'longitude':-1.6244,'accuracy':12},permissions=['geolocation'])
        await ctx.route("**/nominatim.openstreetmap.org/**",lambda r:r.fulfill(status=200,content_type='application/json',body='{"display_name":"Adum, Kumasi, Ashanti, Ghana"}'))
        await ctx.route("**/translate.googleapis.com/**",lambda r:r.fulfill(status=200,content_type='application/json',body='[[["Hello, has the order shipped?","你好，订单发货了吗？",null,null,1]],null,"zh-CN"]'))
        A=await ctx.new_page();errs=[];A.on('pageerror',lambda e:errs.append(str(e)))
        await A.goto('http://localhost:8765/?demo=1');await A.wait_for_timeout(1500)
        # ---- chat
        print('sales:',await login(A,'333333'));print('tabs:',await A.evaluate("TABS().map(t=>t[2]).join(' | ')"))
        await A.evaluate("tab('chat')");await A.wait_for_timeout(200);print('chat list:',await A.evaluate("$$('#screen .box')[0].innerText.split('\\n')[0]"))
        await A.evaluate("go('chat_room',{ch:CH_ALL})");await A.wait_for_timeout(200);await A.fill('#cIn','你好，订单发货了吗？');await A.evaluate("chSend()");await A.wait_for_timeout(300)
        await A.evaluate("openDm('U4')");await A.wait_for_timeout(200);await A.fill('#cIn','私聊：明天几点送货？');await A.evaluate("chSend()");dm=await A.evaluate("S.chId")
        print('dm channel:',dm,'| members:',await A.evaluate("chGet(S.chId).mem"))
        await A.evaluate("go('chat_room',{ch:CH_ALL})");await A.wait_for_timeout(200)
        mid=await A.evaluate("chMsgs(CH_ALL).slice(-1)[0].id");await A.evaluate(f"msgMenu('{mid}')");print('menu:',await A.evaluate("$('#sheet').innerText.replace(/\\n/g,' / ')"))
        await A.click("#sheet .li:has-text('撤回')");await A.wait_for_timeout(200);print('recalled:',await A.evaluate(f"DB.get('msg','{mid}').rc"),'|',await A.evaluate("$('#msgs').innerText.slice(-20)"))
        print('keeper:',await login(A,'444444'));await A.evaluate("setLang('en',true)");print('keeper unread:',await A.evaluate("chatUnread()"))
        await A.evaluate(f"go('chat_room',{{ch:'{dm}'}})");await A.wait_for_timeout(700);print('keeper sees DM + translation:',await A.evaluate("$('#msgs').innerText.replace(/\\n/g,' / ')"))
        print('unread after open:',await A.evaluate("chatUnread()"));await A.evaluate("setLang('zh',true)")
        print('acct:',await login(A,'555555'));print('acct sees DM channel?',await A.evaluate(f"chList().some(c=>c.id==='{dm}')"))
        # ---- attendance
        print('field:',await login(A,'777777'));print('tabs:',await A.evaluate("TABS().map(t=>t[2]).join(' | ')"))
        await A.evaluate("tab('att')");await A.wait_for_timeout(200);await A.evaluate("attGo('in')");await A.wait_for_timeout(1200)
        print('location:',await A.evaluate("[S.att.lat,S.att.lng,S.att.addr]"))
        async with A.expect_file_chooser() as fc:
            await A.evaluate("attPhoto()")
        ch=await fc.value;await ch.set_files('/tmp/site_photo.jpg');await A.wait_for_timeout(1500)
        print('photo watermarked:',await A.evaluate("S.att.photo.slice(0,23)"),len(await A.evaluate("S.att.photo")))
        await A.evaluate("attSave()");await A.wait_for_timeout(300);a=await A.evaluate("DB.all('att').slice(-1)[0]");print('check-in saved:',a['type'],a['addr'],a['lat'])
        await A.evaluate("attView(DB.all('att').slice(-1)[0].id)");await A.wait_for_timeout(300);await A.screenshot(path='/tmp/e_att.png')
        # watermark pixels: bottom band dark
        dark=await A.evaluate("""new Promise(r=>{const im=new Image();im.onload=()=>{const c=document.createElement('canvas');c.width=im.width;c.height=im.height;const x=c.getContext('2d');x.drawImage(im,0,0);const d=x.getImageData(im.width/2,im.height-5,1,1).data,t=x.getImageData(im.width/2,5,1,1).data;r([d[0]+d[1]+d[2],t[0]+t[1]+t[2]])};im.src=S.att.photo})""");print('bottom band darker than top:',dark[0]<dark[1],dark)
        await A.evaluate("closeSheet(true)")
        # field expense claim special
        await A.evaluate("expNew();S.ex.amt=1500;S.ex.note='库马西客户拜访租车';expSave()");await A.wait_for_timeout(200);ex=await A.evaluate("DB.all('exp').slice(-1)[0]");print('claim:',ex['status'],'special',ex['special'])
        print('sales mgr:',await login(A,'333333'));print('sales sees attendance:',await A.evaluate("can('att_view')"));await A.evaluate("go('att_stats')");await A.wait_for_timeout(300)
        print('stats:',await A.evaluate("$$('#screen .box .li')[0].innerText.replace(/\\n/g,' ')"))
        print('acct:',await login(A,'555555'));print('acct can book special before approval?',await A.evaluate(f"expAct(DB.get('exp','{ex['id']}'))"))
        print('ops:',await login(A,'888888'));print('ops action:',await A.evaluate(f"expAct(DB.get('exp','{ex['id']}'))"))
        await A.evaluate(f"go('exp');expView('{ex['id']}')");await A.wait_for_timeout(200);await A.click("#sheet button:has-text('批准')");await A.wait_for_timeout(200)
        print('acct:',await login(A,'555555'));await A.evaluate(f"go('exp');expView('{ex['id']}')");await A.wait_for_timeout(200);await A.click("#sheet button:has-text('入账')");await A.wait_for_timeout(200)
        print('cashier:',await login(A,'666666'));await A.evaluate(f"go('exp');expView('{ex['id']}')");await A.wait_for_timeout(200);await A.fill('#exN','R-778');await A.click("#sheet button:has-text('确认已付款')");await A.wait_for_timeout(200)
        print('claim final:',await A.evaluate(f"DB.get('exp','{ex['id']}').status"))
        # ---- credit sale chain
        print('field:',await login(A,'777777'));await A.evaluate("S.form=null;go('so_new',{add:'P1'})");await A.wait_for_timeout(200)
        await A.evaluate("S.form.cus='C1';S.form.pay='credit';S.form.frt={payer:'cus',amt:150};S.form.items[0].qty=2");await A.evaluate("saveSO('submitted')");await A.wait_for_timeout(300)
        so=await A.evaluate("DB.all('so').sort((a,b)=>b.t-a.t)[0]");print('credit SO:',so['status'],so['pay'],'total incl freight',await A.evaluate(f"docTotal(DB.get('so','{so['id']}'))"))
        print('keeper:',await login(A,'444444'));print('keeper ship button?',await A.evaluate(f"go('so_view',{{id:'{so['id']}'}});!!$$('.bbar button').find(b=>b.textContent.includes('确认发货'))"))
        print('acct:',await login(A,'555555'));await A.evaluate(f"soFin('{so['id']}')");await A.wait_for_timeout(200);await A.fill('#sfN','信用良好');await A.evaluate(f"soFinOk('{so['id']}')");print('->',await A.evaluate(f"DB.get('so','{so['id']}').status"))
        print('GM:',await login(A,'111111'));print('GM todo:',await A.evaluate("V.home().includes('赊账销售单待您审批')"));await A.evaluate(f"soGm('{so['id']}')");await A.wait_for_timeout(200);await A.evaluate(f"soGmOk('{so['id']}')");print('->',await A.evaluate(f"DB.get('so','{so['id']}').status"))
        print('GM can do finance step himself?',await A.evaluate("own('so_fin')"))
        # print
        await A.evaluate(f"printDoc('so','{so['id']}')");await A.wait_for_timeout(500);h=await A.evaluate("window._pvH");print('print SO:',all(x in h for x in ['销售单','SALES ORDER','运费','合计','客户确认']))
        await A.evaluate("closeSheet(true)")
        # ---- PO fees landed cost
        print('buyer:',await login(A,'222222'));await A.evaluate("S.form=null;go('po_new',{add:'P2'})");await A.wait_for_timeout(200)
        await A.evaluate("S.form.sup=DB.all('partners').find(p=>p.type==='sup').id;S.form.items[0].qty=10;S.form.items[0].price=100;S.form.fees=[{k:'freight',n:'海运',amt:200},{k:'clear',n:'5 台',amt:300}]");
        await A.evaluate("savePO('ordered')");await A.wait_for_timeout(300);po=await A.evaluate("DB.all('po').sort((a,b)=>b.t-a.t)[0]");print('PO total incl fees:',await A.evaluate(f"docTotal(DB.get('po','{po['id']}'))"),'k',await A.evaluate(f"landK(DB.get('po','{po['id']}'))"))
        print('keeper:',await login(A,'444444'));await A.evaluate(f"S.form=null;go('recv',{{id:'{po['id']}'}})");await A.wait_for_timeout(300);await A.evaluate("doRecv()");await A.wait_for_timeout(500)
        mv=await A.evaluate(f"DB.all('moves').filter(m=>m.type==='po_in'&&m.pid==='P2').sort((a,b)=>b.t-a.t)[0]");print('landed unit cost on GRN move:',mv.get('uc'),'(100 x 1.5 = 150)')
        g=await A.evaluate(f"DB.all('grn').filter(g=>g.po==='{po['id']}')[0].id");await A.evaluate(f"printDoc('grn','{g}')");await A.wait_for_timeout(300);h=await A.evaluate("window._pvH");print('print GRN:','入库单' in h and '150.00' in h);await A.evaluate("closeSheet(true)")
        # ---- counts two-level
        await A.evaluate("go('take')");await A.wait_for_timeout(200);await A.evaluate("S.form.items=S.form.items||[]")
        ct=await A.evaluate("DB.put('counts',{no:genNo('ST'),wh:'W1',status:'pending',t:Date.now(),items:[{pid:'P1',sys:qtyOf('P1','W1'),real:qtyOf('P1','W1')-2}]}).id")
        print('keeper can approve own count?',await A.evaluate(f"go('take_view',{{id:'{ct}'}});!!$$('.bbar button').length"))
        print('GM:',await login(A,'111111'));print('GM approves before finance?',await A.evaluate(f"go('take_view',{{id:'{ct}'}});!!$$('.bbar button').length"))
        print('acct:',await login(A,'555555'));q0=await A.evaluate("qtyOf('P1','W1')");await A.evaluate(f"tkReview('{ct}',true)");print('->',await A.evaluate(f"DB.get('counts','{ct}').status"),'stock unchanged',await A.evaluate("qtyOf('P1','W1')")==q0)
        print('ops:',await login(A,'888888'));await A.evaluate(f"tkReview('{ct}',true)");print('->',await A.evaluate(f"DB.get('counts','{ct}').status"),'stock',q0,'->',await A.evaluate("qtyOf('P1','W1')"))
        # report
        await A.evaluate("go('report')");await A.wait_for_timeout(300);print('report has net profit:',await A.evaluate("$('#screen').innerText.includes('净利润')"))
        await A.evaluate("tab('work')");await A.wait_for_timeout(200);await A.screenshot(path='/tmp/e_work.png')
        print('ERRORS' if errs else 'NO ERRORS',errs[:3]);await b.close()
asyncio.run(main())
