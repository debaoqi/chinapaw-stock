# 华宝进销存 · ChinaPaw Stock

非洲 54 国通用的移动端进销存，与 ChinaPaw（华宝）同一套架构。

- 网页版 / 手机桌面版：https://debaoqi.github.io/chinapaw-stock/
- 网站端（电脑）：https://debaoqi.github.io/chinapaw-stock/web.html
- 后台管理（总经理）：https://debaoqi.github.io/chinapaw-stock/admin/
- 安卓 APK：https://debaoqi.github.io/chinapaw-stock/app/ChinaPawStock.apk

## 登录（只输入密码）
| 部门 | 初始密码 |
|---|---|
| 总经理 | 111111 |
| 采购主管 | 222222 |
| 销售经理 | 333333 |
| 仓库主管 | 444444 |
| 会计 | 555555 |
| 出纳 | 666666 |

同部门新增账号：总经理在后台输入“部门代码-序号”（如 444444-1），初始密码就是这个代码；密码可修改、账号可停用。

## 代码结构
- `src/`：源码（i18n.js 54 国语言与货币、core.js 数据与同步、app.js 全部页面、app.css 样式）
- `python3 build.py` → `www/index.html`（手机）、`www/web.html`（网站端单文件）、`www/admin/index.html`（后台）
- `www/config.js`：填 Supabase 地址与 anon 公钥 = 云端多人模式；留空 = 本机演示模式
- `supabase/schema.sql`：数据库（表 + RPC + 部门权限），可重复执行
- `.github/workflows/`：自动发布网页、自动打包安卓 App
- `tests/`：自动化测试（Playwright）
