车辆铭牌 AI 识别（v1.11.0 / web build21）：前端不含识别密钥，服务端 `jxc-vehicle-ocr` 校验现有会话和职位；`v1.11.0_vehicle_ai.sql` 仅创建识别日志和额度函数，不修改库存、单据或账号。Google 免费项目不绑定结算，额度用完停止调用；上游临时故障最多重试两次，不切换收费服务。每账号每天最多30次，全项目每天最多100次（系统保护上限，以Google实际额度为准）。上传照片会交给Google识别，免费层可能用于改进Google产品。原图与草稿保留，换图清空旧车字段，重新识别保留手工修正；AI结果必须人工核对后归档，入库仍需审批。Google服务繁忙或额度不足时，页面保留草稿并提供基础离线OCR。真实图片准确率以发布验证记录为准，不承诺所有图片均正确。

本次为网页及服务端更新；现有Android build9加载同一网站，继续使用原安装包。

# 华宝进销存 · ChinaPaw Stock

本次修复：网页安装版采用标准 Web Push，在系统允许时支持后台通知及桌面角标；安卓 APK 增加通知/渠道/角标诊断、系统设置入口和原生提示音。iPhone 需要 iOS 16.4+、Safari 添加到主屏幕后打开并允许通知；安卓角标点/数字由桌面支持决定，强行停止、断网、勿扰或系统禁用不能由软件绕过。

聊天录音优先使用系统识别；没有文字时用本地 Whisper tiny 多语种 q8 模型兜底，识别完补充文字再翻译。首次从 Hugging Face 下载固定版本模型，并缓存到本机；不会把录音上传给识别服务。首次模型/运行组件约100MB，旧手机较慢；通用兜底在录音结束后运行，不保证逐字实时显示。翻译服务仍需网络。历史语音可点击重试；低音量/识别失败保留原声并提示。

请假提交与审批等待云端确认；工作台显示待审数量。0.5–2天运营经理审批，超过2天总经理审批；运营经理本人请假转交总经理，禁止自批。已批准请假显示在考勤及CSV中，保留实际打卡；上午批准请假不算早上迟到。

工作台 → 车辆铭牌识别：相机/上传 → 服务端Gemini图片识别及本机草稿 → 人工核对七项字段 → 归档 → 生成CODE128及结构化QR标签（PNG/打印）。可关联已有采购单生成1台待审批入库，或按实际成本提出期初库存申请。识别/归档不会直接改库存。服务器限制唯一VIN和重复入库，所有号码以原图复核结果为准。

销售单完成及物流送达都不能绕过客户照片和手写签名。批量同步校验失败会回滚批次，客户端恢复服务器状态。

升级顺序：在已经完成 v1.9.0 的项目依次执行 `v1.9.2_sync.sql`、`v1.9.2_leave.sql`、`v1.9.2_vehicles.sql`、`v1.9.2_webpush.sql`，更新 `jxc-push` 函数、网页和APK。Web Push私钥仅生成于服务端并保存在私有RLS表，不进入源码、网页或APK。后续勿重跑旧版本角色/权限升级。

本地核验：`node tests/sql_live190.mjs`、`node tests/ui_v190.mjs`、`node tests/web_push_v192.mjs`、`node tests/push_relay_v180.mjs`。真实手机的系统推送、音量、节电和录音质量仍须按设备验收。


当前网页版本 v1.11.0，Android 原生版本 v1.10.0 / build 9，沿用现有网站与下载地址。

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
