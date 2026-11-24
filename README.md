# 华宝进销存 · ChinaPaw Stock

非洲 54 国通用的移动端进销存，与 ChinaPaw（华宝）同一套架构。

- 网页版 / 手机桌面版：https://debaoqi.github.io/chinapaw-stock/
- 网站端（电脑）：https://debaoqi.github.io/chinapaw-stock/web.html
- 后台管理：已并入网站端（总经理可授权其他账号使用），旧地址 /admin/ 会自动转到网站端
- 安卓 APK：https://debaoqi.github.io/chinapaw-stock/app/ChinaPawStock.apk

## 登录
先选择职位（总经理、采购主管、销售经理、仓库主管、会计、出纳），再输入该职位的密码。密码只在后台查看和修改；同部门新增岗位账号用“部门代码-序号”。

## 代码结构
- `src/`：源码（i18n.js 54 国语言与货币、core.js 数据与同步、app.js 全部页面、app.css 样式）
- `python3 build.py` → `www/index.html`（手机）、`www/web.html`（网站端单文件）、`www/admin/index.html`（后台）
- `www/config.js`：填 Supabase 地址与 anon 公钥 = 云端多人模式；留空 = 本机演示模式
- `supabase/schema.sql`：数据库（表 + RPC + 部门权限），可重复执行
- `.github/workflows/`：自动发布网页、自动打包安卓 App
- `tests/`：自动化测试（Playwright）
