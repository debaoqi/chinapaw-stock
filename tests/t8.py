# 54 国语言 + 货币：模拟翻译接口与汇率接口，检查切换国家 / 语言 / 货币
import asyncio,json,urllib.parse
from playwright.async_api import async_playwright
RATES={'result':'success','time_last_update_unix':1795500000,'rates':{'USD':1,'GHS':10.8,'XOF':566.2,'NGN':1540,'EGP':48.9,'KES':129.3,'ZAR':17.9}}
async def tr(route):
    u=urllib.parse.urlparse(route.request.url);q=urllib.parse.parse_qs(u.query);tl=q['tl'][0];lines=q['q'][0].split('\n')
    out=[[f'«{tl}» '+l,l] for l in ['\n'.join(lines)]]  # 整段返回，保留换行
    await route.fulfill(status=200,content_type='application/json',body=json.dumps([[[ '\n'.join(f'«{tl}» '+l for l in lines),'x']]]))
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
        # 模拟一部在阿比让（科特迪瓦）、手机语言为法语的手机
        ctx=await b.new_context(viewport={'width':390,'height':844},locale='fr-CI',timezone_id='Africa/Abidjan')
        await ctx.route('https://translate.googleapis.com/**',tr)
        await ctx.route('https://open.er-api.com/**',lambda r:r.fulfill(status=200,content_type='application/json',body=json.dumps(RATES)))
        pg=await ctx.new_page();errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto('http://localhost:8765/');await pg.wait_for_timeout(3500)
        print('auto country/lang/currency:',await pg.evaluate("[S.country,S.lang,dispIso(),langsOf(S.country).join('/'),fxLive()]"))
        print('login title:',await pg.evaluate("document.querySelector('.fld label').textContent"),'| button:',await pg.evaluate("document.querySelector('.langbtn').textContent"))
        await pg.fill('#lgPw','111111');await pg.click('button.bigbtn');await pg.wait_for_timeout(1500)
        await pg.screenshot(path='shots/v2_fr_home.png')
        print('fr hero:',await pg.evaluate("document.querySelector('.hero').innerText"),'| tab:',await pg.evaluate("document.querySelector('.tnav .tl').textContent"))
        print('money XOF:',await pg.evaluate("[money(1000),moneyBase(1000),usd(1000)]"))
        print('number placeholders:',await pg.evaluate("L('','In transit 3 · Exceptions 12')"))
        await pg.evaluate("S.curMode='USD';render(false)");print('USD mode:',await pg.evaluate("money(1000)"))
        await pg.evaluate("S.curMode='local';setCountry('EG')");await pg.wait_for_timeout(2500)
        print('Egypt:',await pg.evaluate("[S.lang,document.documentElement.dir,dispIso(),money(1000)]"))
        await pg.screenshot(path='shots/v2_ar_home.png')
        await pg.evaluate("setCountry('GH')");await pg.wait_for_timeout(800);await pg.evaluate("setLang('zh')");await pg.wait_for_timeout(500)
        print('back to Ghana zh:',await pg.evaluate("[S.lang,document.documentElement.dir,money(1000)]"))
        n=await pg.evaluate("Object.keys(LS.get('tr_fr',{})).length");print('cached fr strings:',n)
        print('\n'.join(errs) or 'NO ERRORS');await b.close()
asyncio.run(main())
