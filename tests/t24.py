# 模拟安卓 App 的原生插件：GPS 关着 → 一键打开；权限弹窗；打印走系统打印；搜索打印机
import asyncio
from playwright.async_api import async_playwright
MOCK="""window._calls=[];window.Capacitor={isNativePlatform:()=>true,Plugins:{App:{getInfo:async()=>({build:'3'}),addListener:async()=>({remove(){}})},addListener:async()=>({remove(){}}),JxcNative:{
 checkPerms:async()=>({location:window._perm||'prompt',camera:'granted',microphone:'prompt'}),
 requestPerms:async o=>{_calls.push('req:'+o.list.join(','));window._perm='granted';return {location:'granted',camera:'granted',microphone:'granted'}},
 getLocation:async()=>{_calls.push('loc');if(window._gpsOff){const e=new Error('位置信息开关已关闭');e.code='OFF';throw e}return {lat:5.6,lng:-0.18,acc:8}},
 openLocationSettings:async()=>_calls.push('gps-settings'),openAppSettings:async()=>_calls.push('app-settings'),
 printHtml:async o=>_calls.push('print:'+o.name),findPrinters:async()=>({printers:[{name:'HP LaserJet MFP M140w',type:'IPP / RAW 9100'}]})}}};"""
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox']);errs=[]
        c=await b.new_context(viewport={'width':360,'height':760},locale='zh-CN');await c.add_init_script(MOCK);pg=await c.new_page();pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.route("**/nominatim.openstreetmap.org/**",lambda r:r.fulfill(status=200,content_type='application/json',body='{"display_name":"Adum, Kumasi"}'))
        await pg.goto('http://localhost:8765/?demo=1');await pg.wait_for_timeout(2500)
        print('users:',await pg.evaluate("DB.all('users').length"),await pg.evaluate("S.view"),errs)
        await pg.evaluate("S.me=(({pw,...u})=>u)(DB.all('users').find(u=>u.code==='777777'));LS.set('permAsked',0);afterLogin()");await pg.wait_for_timeout(2000)
        print('first-run permission sheet:',await pg.evaluate("$('#sheet.on .sh')&&$('#sheet .sh').innerText"))
        await pg.click("#sheet .bigbtn");await pg.wait_for_timeout(300);print('calls:',await pg.evaluate("_calls"))
        await pg.evaluate("window._gpsOff=true;attGo('in')");await pg.wait_for_timeout(500)
        print('GPS off sheet:',await pg.evaluate("$('#sheet .note-r').innerText"),'| buttons',await pg.evaluate("$$('#sheet .bigbtn').map(b=>b.innerText.trim())"))
        await pg.click("#sheet .bigbtn >> nth=0");print('calls:',await pg.evaluate("_calls.slice(-2)"))
        await pg.evaluate("closeSheet(true);window._gpsOff=false;attGo('in')");await pg.wait_for_timeout(800)
        print('GPS on sheet:',await pg.evaluate("$('#sheet .note-g')&&$('#sheet .note-g').innerText"))
        await pg.evaluate("closeSheet(true);printDoc('so',DB.all('so')[0].id)");await pg.wait_for_timeout(300);await pg.evaluate("pvPrint()");await pg.wait_for_timeout(200)
        await pg.evaluate("closeSheet(true);go('printers')");await pg.evaluate("prnScan()");await pg.wait_for_timeout(300)
        print('printers found:',await pg.evaluate("$('#screen').innerText.includes('HP LaserJet')"),'calls:',await pg.evaluate("_calls.slice(-3)"))
        await pg.evaluate("permSheet()");await pg.wait_for_timeout(200);print('perm sheet badges:',await pg.evaluate("$$('#sheet .li').map(l=>l.innerText.replace(/\\n/g,' '))"))
        print('NO ERRORS' if not errs else errs);await b.close()
asyncio.run(main())
