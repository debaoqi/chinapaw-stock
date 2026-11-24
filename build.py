#!/usr/bin/env python3
"""把 src/ 下的源码合并成单文件网页（与 ChinaPaw 相同：一个 index.html 包含全部页面，便于热更新）。
用法：python3 build.py   → 生成 www/index.html 和 www/admin/index.html"""
import re, pathlib
R = pathlib.Path(__file__).parent
css = (R/'src/app.css').read_text(encoding='utf-8')
core = (R/'src/core.js').read_text(encoding='utf-8')
def build(shell, app, out, extra_css=''):
    s = (R/'src'/shell).read_text(encoding='utf-8')
    s = s.replace('/*CSS*/', css + extra_css).replace('/*CORE*/', core).replace('/*APP*/', (R/'src'/app).read_text(encoding='utf-8'))
    (R/out).write_text(s, encoding='utf-8')
    print(out, len(s.encode('utf-8')), 'bytes')
build('shell.html', 'app.js', 'www/index.html')
if (R/'src/admin.js').exists():
    build('admin_shell.html', 'admin.js', 'www/admin/index.html', (R/'src/admin.css').read_text(encoding='utf-8'))
v = re.search(r"APP_VER='([\d.]+)',APP_BUILD=(\d+)", core).groups()
print('APP_VER', v[0], 'APP_BUILD', v[1])
