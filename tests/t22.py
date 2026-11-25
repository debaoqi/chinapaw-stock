# v1.6：全员考勤打卡（总经办除外）、应用内相机、定位兜底、总经办看全员汇总、打印机页面、全额收款提醒、云端允许所有岗位打卡
import asyncio,json
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream'])
        errs=[]
        ctx=await b.new_context(viewport={'width':360,'height':760},locale='zh-CN',timezone_id='Africa/Accra',geolocation={'latitude':5.6037,'longitude':-0.187,'accuracy':12},permissions=['geolocation','camera','microphone'])
        pg=await ctx.new_page();pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.route("**/nominatim.openstreetmap.org/**",lambda r:r.fulfill(status=200,content_type='application/json',body=json.dumps({'display_name':'Osu, Accra, Ghana'})))
        await pg.route("**/ipwho.is/**",lambda r:r.fulfill(status=200,content_type='application/json',headers={'access-control-allow-origin':'*'},body=json.dumps({'success':True,'latitude':5.55,'longitude':-0.2,'city':'Accra'})))
        await pg.route("**/translate.googleapis.com/**",lambda r:r.abort())
        await pg.goto('http://localhost:8765/?demo=1');await pg.wait_for_timeout(1200)
        su=lambda code:f"S.me=(({{pw,...u}})=>u)(DB.all('users').find(u=>u.code==='{code}'));S.hist=[];S.view='work';render(true)"
        res={}
        for code in ['111111','888888','222222','333333','777777','444444','555555','666666']:
            await pg.evaluate(su(code))
            res[code]=await pg.evaluate("[S.me.role,own('att'),!!$$('.wtile').find(t=>t.innerText.includes('考勤打卡')),!!$$('.wtile').find(t=>t.innerText.includes('考勤统计'))]")
        print('roles [role, can clock in, check-in tile, stats tile]:',res)
        # 仓库主管打卡：首页提醒 → 打卡页 → 定位 → 相机拍照 → 保存
        await pg.evaluate(su('444444').replace("S.view='work'","S.view='home'"))
        print('keeper home todo:',await pg.evaluate("!!$$('#screen *').find(e=>e.children.length===0&&e.textContent.includes('今天还没有上班打卡'))"))
        await pg.evaluate("go('att')");await pg.wait_for_timeout(200)
        print('keeper att page: header',await pg.evaluate("!!$('#screen .hdr, #screen header, #screen .top')"),'buttons',await pg.evaluate("$$('#screen .bigbtn').map(b=>b.innerText.trim())"))
        await pg.evaluate("attGo('in')");await pg.wait_for_timeout(1500)
        print('att sheet:',await pg.evaluate("$('#sheet.on')?$('#sheet .note-g,#sheet .note-r').innerText.slice(0,60):'none'"))
        await pg.evaluate("attPhoto()");await pg.wait_for_timeout(1500)
        print('in-app camera open:',await pg.evaluate("!!$('#camOv')"),'video size',await pg.evaluate("$('#camV').videoWidth"))
        await pg.click('#camS');await pg.wait_for_timeout(1500)
        print('photo set:',await pg.evaluate("!!S.att.photo"),'camera closed',await pg.evaluate("!$('#camOv')"))
        await pg.screenshot(path='/tmp/att_sheet.png')
        await pg.evaluate("attSave()");await pg.wait_for_timeout(300)
        print('saved:',await pg.evaluate("DB.all('att').filter(a=>a.by===S.me.id).map(a=>[a.type,a.addr,a.approx])"),'todo gone',await pg.evaluate("attTodayDone()"))
        # 定位被拒绝 → 网络大致位置（标记）；发送位置必须精确
        await ctx.clear_permissions();await ctx.grant_permissions(['camera','microphone'])
        await pg.evaluate("attGo('out')");await pg.wait_for_timeout(14000)
        print('denied -> help sheet:',await pg.evaluate("$('#sheet.on .note-r')&&$('#sheet .note-r').innerText"),await pg.evaluate("$$('#sheet .bigbtn').map(b=>b.innerText.trim())"))
        await pg.click("#sheet .bigbtn >> nth=-1");await pg.wait_for_timeout(1500)
        print('denied -> approx:',await pg.evaluate("S.att&&[S.att.approx,S.locKind]"),await pg.evaluate("$('#sheet.on .note-r')?$('#sheet .note-r').innerText.slice(0,40):''"))
        await pg.evaluate("closeSheet(true);chLoc()");await pg.wait_for_timeout(1500)
        print('chat location denied -> help:',await pg.evaluate("$('#sheet.on')?$('#sheet .sh').innerText+' | '+$('#sheet .note-r').innerText:''"))
        await pg.evaluate("closeSheet(true)")
        # 总经理看全员；销售经理只看销售部
        await pg.evaluate(su('111111'));await pg.evaluate("go('att_stats')");await pg.wait_for_timeout(200)
        gm=await pg.evaluate("$$('#screen .li .b.sm').map(e=>e.innerText.split(' ')[0])");print('GM stats staff:',len(gm),gm)
        await pg.evaluate(su('333333'));await pg.evaluate("go('att_stats')");await pg.wait_for_timeout(200)
        print('sales mgr stats staff:',await pg.evaluate("$$('#screen .li .b.sm').map(e=>e.innerText)"))
        # 打印机页面 + 手机权限（网页版）
        await pg.evaluate("go('printers')");await pg.wait_for_timeout(200)
        print('printers page:',await pg.evaluate("$('#screen').innerText.slice(0,40).replace(/\\n/g,' ')"),'| buttons',await pg.evaluate("$$('#screen .bigbtn').map(b=>b.innerText.trim())"))
        await pg.evaluate("permSheet()");print('perm sheet (web):',await pg.evaluate("$('#sheet .sh').innerText"))
        await pg.evaluate("closeSheet(true);micHelp()");print('mic help has keyboard tip:',await pg.evaluate("$('#sheet').innerText.includes('键盘')"))
        await pg.evaluate("closeSheet(true)")
        # 我的页面有打印机、手机权限
        await pg.evaluate("tab('me')");print('me rows:',await pg.evaluate("['打印机','手机权限'].map(t=>$('#screen').innerText.includes(t))"))
        print('NO ERRORS' if not errs else errs)
        await b.close()
asyncio.run(main())
