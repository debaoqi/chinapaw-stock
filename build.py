#!/usr/bin/env python3
"""把 src/ 合并成单文件网页（与 ChinaPaw 相同：一个 HTML 包含全部页面，便于热更新）。
用法：python3 build.py → 生成
  www/index.html        手机端（PWA / 安卓 App 内容）
  www/web.html          网站端（电脑宽屏，单文件，图标内嵌，双击即可打开）
  www/admin/index.html  旧后台地址，自动转到网站端（后台已并入网站端）"""
import re, pathlib, base64
R = pathlib.Path(__file__).parent
css = (R/'src/app.css').read_text(encoding='utf-8')
core = (R/'src/core.js').read_text(encoding='utf-8').replace('/*I18N*/', (R/'src/i18n.js').read_text(encoding='utf-8'))
app = (R/'src/app.js').read_text(encoding='utf-8')
# 预先收集全部界面英文句子：切换到其他语言时一次翻译完，避免先英文后外文的闪动
en = set()
for src in (core, app):
    en.update(m.group(2) for m in re.finditer(r"L\('((?:[^'\\]|\\.)*)','((?:[^'\\]|\\.)*)'\)", src))
    en.update(m.group(2) for m in re.finditer(r"\['([^'\n]*[一-鿿][^'\n]*)','([^'\n]+)'", src))
    en.update(m.group(1) for m in re.finditer(r"en:'((?:[^'\\]|\\.)*)'", src))
en = sorted(x.replace("\\'", "'") for x in en if re.search('[A-Za-z]', x) and '${' not in x)
import json
tr_all = 'window.TR_ALL=' + json.dumps(en, ensure_ascii=False) + ';'
shell = (R/'src/shell.html').read_text(encoding='utf-8')
logo = (R/'www/logo.svg').read_bytes()
def build(out, body, config, extra=''):
    s = shell.replace('/*BODY*/', body).replace('/*CSS*/', css).replace('<!--CONFIG-->', config)
    s = s.replace('/*CORE*/', tr_all + '\n' + extra + core).replace('/*APP*/', app)
    (R/out).write_text(s, encoding='utf-8'); print(out, len(s.encode('utf-8')), 'bytes')
build('www/index.html', '', '<script src="config.js"></script>')
# 网站端：图标内嵌、不依赖其他文件（config.js 存在就用云端，不存在就是本机演示）
logo_uri = 'data:image/svg+xml;base64,' + base64.b64encode(logo).decode()
web = 'window.LOGO_DATA="' + logo_uri + '";'
build('www/web.html', 'web', '<script src="config.js" onerror="void 0"></script>', web)
s = (R/'www/web.html').read_text(encoding='utf-8').replace('<link rel="manifest" href="manifest.webmanifest">','').replace('href="icon-192.png"', 'href="'+logo_uri+'"')
(R/'www/web.html').write_text(s, encoding='utf-8')
# 后台已并入网站端：旧的 /admin/ 地址（以及后台安卓 App）自动转到网站端的“后台管理”
(R/'www/admin/index.html').write_text("""<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>华宝进销存</title>
<script>location.replace('../web.html#mgmt')</script></head><body style="font-family:sans-serif;text-align:center;padding:40px"><a href="../web.html#mgmt">华宝进销存 · 网站端 / Website</a></body></html>""", encoding='utf-8')
v = re.search(r"APP_VER='([\d.]+)',APP_BUILD=(\d+)", core).groups()
print('界面句子', len(en), '| APP_VER', v[0], 'APP_BUILD', v[1])
