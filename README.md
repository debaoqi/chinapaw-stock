# 华宝进销存 · ChinaPaw Stock

当前网页版本 v1.9.0，Android 原生版本 v1.9.0 / build 8，沿用现有网站与下载地址。

本次启用：董事长操作权限、08:30–17:00考勤与照片草稿恢复、请假审批、聊天已读、拍照手写签收、分批出库、服务器库存数量校验、基础信用与价格控制。收入展示按实际出库流水；旧成本缺失时不阻断出库，但相关利润暂停展示。

从v1.8升级须先执行 `supabase/migrations/v1.9.0_live.sql`，再执行 `supabase/migrations/v1.9.0_services.sql`，然后配套发布网页和APK。脚本已在当前项目执行，勿重新运行旧角色脚本或载入演示数据。升级保留业务数据与账号密码。

每日02:00（UTC/加纳时间）在项目内生成私有业务、账号和审计快照。此功能不代替异地数据库及媒体备份。

总账、资金分账户及期初财务导入扩展尚未启用，需要完成旧账和期初核对；勿把未启用的候选财务迁移直接用于生产。真实手机语音、相机和通知仍需按设备验收。

本批隔离回归：`node tests/sql_live190.mjs`、`node tests/ui_v190.mjs`。真实浏览器已核验线上登录与工作台；测试不会提交真实销售、付款或客户签名。

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


## v1.7.0 升级

先执行 `supabase/migrations/v1.7.0.sql`，再发布 www/ 并安装新版原生 APK。升级脚本保留业务数据和已付款历史，把不符合新规则的未付款审批退回运营经理，同时留存旧审批快照。不要使用“清空业务数据”或“载入演示数据”。

- 现款：出纳登记收款、会计核对全额后，销售单自动转“待出库”。
- 赊销：财务应收页可以拒绝或直接报总经理；总经理待办支持通过和拒绝。
- 采购：登记到货 → 财务审批 → 独立内勤确认 → 库管入库。前两步不增加库存；入库单和商品行都有批号。
- 新增独立“内勤”基础职位，位于采购部；由总经理在账号管理中创建实际人员账号，不自动给线上系统创建默认账号。
- 每笔费用报销和采购付款申请都先由运营经理审批；大于 2000（系统结算货币）再交总经理。2000 整无需追加总经理。
- 安卓按住录音使用 AAC/M4A；网页录音转单声道 16kHz PCM WAV。聊天加号中的“语音识别 → 翻译 → 朗读”调用系统识别服务，确认文字后发送并翻译；译文旁可直接朗读。纯录音与语音翻译是两个入口，纯录音没有自动转写时不会凭空生成译文。
- 安卓手机需具备语音识别服务和目标语言 TTS 语音包；缺少时会给出明确提示。

本地构建：`npm install`、`python build.py`、`npx cap add android`、`npx cap sync android`、`python prepare_android.py`、`python make_icons.py android`，最后在 android/ 执行 Gradle assembleDebug。Java 21、Android SDK 36、Pillow 必需。

回归：`pip install playwright`，Windows 已安装 Edge 时运行 `python tests/regression_v170.py`、`python tests/voice_v170.py`；`npm install` 后运行 `node tests/sql_v170.mjs`。全部测试都使用隔离数据，不登录生产服务。

原生接口依据：[Capacitor Android Plugin Guide](https://capacitorjs.com/docs/plugins/android)、[Android TextToSpeech](https://developer.android.com/reference/android/speech/tts/TextToSpeech)。


## v1.8.0 系统推送部署

- Android 客户端包名 `com.chinapaw.stock`。将对应 Firebase Android 配置放到 `android/app/google-services.json`；文件不要提交到公开仓库。GitHub Actions 用 `FIREBASE_ANDROID_CONFIG` secret 注入，缺少时阻止后台推送版本发布。
- Supabase Edge Function: `jxc-push`，环境密钥 `FCM_SERVICE_ACCOUNT`、`PUSH_WEBHOOK_SECRET`；服务账户只授予 Firebase Cloud Messaging 发送所需权限，私钥不能进入客户端或仓库。
- `supabase/configure_push.sql` 填入现有公开 anon JWT 后在 SQL Editor 执行；共享密钥由数据库生成，写入函数 Secrets。保留函数 JWT 验证，并由调度同时携带 JWT 和共享密钥。它安装 pg_net、pg_cron，并创建提交触发和每分钟重试任务。
- FCM 只接收用户 ID、通知事件 ID 和通用提醒，不发送单据金额、人员打卡照片或群聊原文。
- `node tests/sql_v180.mjs` 验证迁移、权限和路由；`node tests/push_relay_v180.mjs` 验证转发；`python tests/roles_att_badge_v180.py` 验证职位、拍照和未读。测试不会连接生产服务。
- 真机验收需实际登录 APP，允许通知、发送由用户发起的测试群消息，并分别检查前台、后台、划掉 APP 和已读清除。

实现依据：[Android 通知角标](https://developer.android.com/develop/ui/views/notifications/badges)、[FCM Android 接收](https://firebase.google.com/docs/cloud-messaging/android/receive-messages)、[Supabase 推送函数](https://supabase.com/docs/guides/functions/examples/push-notifications?platform=fcm)、[Supabase Cron 安装](https://supabase.com/docs/guides/cron/install)。
