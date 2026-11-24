# 华宝进销存 · ChinaPaw Stock

移动端进销存（库存 / 采购 / 销售 / 退货 / 盘点 / 物流 / 报表），与 ChinaPaw 同一套架构：

- `src/`：源码（core.js 公共核心、app.js 用户端、admin.js 管理后台、app.css 样式）
- `python3 build.py` → 合并成单文件 `www/index.html` 与 `www/admin/index.html`
- `www/`：线上网站（Cloudflare Pages 输出目录 www；PWA 由 pages.yml 发布到 GitHub Pages）
- `www/config.js`：填 Supabase 地址与 anon 公钥 = 云端多人模式；留空 = 本机演示模式
- `supabase/schema.sql`：数据库（表 + RPC + 权限），可重复执行
- `.github/workflows/`：自动打包安卓 App（用户端 / 管理端）与发布 PWA
- `tests/`：自动化测试（Playwright）

本地预览：`python3 -m http.server 8765 --directory www`，打开 http://localhost:8765/ 与 /admin/
