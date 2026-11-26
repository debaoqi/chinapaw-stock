## v1.14.6 / build29：微信式消息界面

- 消息列表采用浅灰导航栏、搜索、48px方形圆角头像、76px会话行、头像角标未读数、细分隔线。搜索过滤聊天与同事，不改成员权限。
- 聊天窗口采用灰底、40px头像、白/浅绿气泡、紧凑语音条、40px输入框、27px图标、文字发送按钮。阅读状态改成小字按钮，避免通用控件样式产生大白框。
- 文本消息长按或右键/键盘可打开菜单；滚动移动超过10px取消长按。语音单击播放。业务导航、请假审批与历史折叠、聊天隐藏保留。
- 延续v1.14.5：语音仅原声发送播放，不转文字、不翻译、不加载识别模型；输入文字正常Google翻译。未修改业务单据或数据库。
- 样式参考：公开微信列表截图 https://mydown.yesky.com/sjsoft/11799799.html ，公开聊天截图 https://www.nfnews.com/content/xovxr4Lp3J.html 。未分发其截图、用户头像或微信商标。新增volume-2/ellipsis/circle-plus/audio-lines图标来自Lucide（ISC，https://lucide.dev/license）。
- 验证：隔离浏览器检查消息搜索、请假折叠、语音播放、消息菜单、输入栏；130视图与原声/文字翻译回归通过。不等同于红米Turbo3的真机验收。

## v1.14.5 / build28：语音仅保留原声

- 用户最新决定：移除语音自动转写与翻译。按住录音、松开发送、上滑取消、播放原声保留；普通输入文字仍正常Google翻译。
- 语音模式不预热模型、发送不排转写任务；本地识别入口已停用；语音消息隐藏历史转写/译文及校对、转写和翻译重试按钮。历史数据库内容未删除。
- 翻译入口与结果写回均拒绝语音消息，避免后台或旧转写结果触发翻译。无需数据库迁移、重装APK或新增付费API。

## v1.14.4 / build27：免费本地转写优化

- 当前交互：微信式按住录音、松开发送语音、上滑取消；语音下方异步显示本地转写文字和Google译文。用户已重新明确需要语音消息，覆盖下方v1.14.2的历史方案。
- 根因：Whisper tiny q8在设备WASM单线程上推理；首次按需下载/初始化；原转写队列把最长30秒的云端同步也串行等待；独立语言设置互相覆盖、重试未固定消息语言。
- 本次修复：只串行模型推理，云端同步不占转写队列；切换语音模式提前准备模型；保存实际说话语言，统一语言设置；显示排队、加载和识别阶段；静音边界保留250毫秒，不切内部停顿；拒绝重复循环乱码；worker失败清理所有挂起任务。输入消息提示文字水平和垂直居中。
- 未默认启用GPU：公开样本实测GPU q8输出不可靠，已移除试验路径。没有接入付费服务，不上传原声给ASR服务。Google仅接收待翻译文字。
- 实测边界：这台电脑对公开JFK英语样本使用WASM，缓存模型加载4.3秒，转写2524毫秒，样本文字一致；不代表红米Turbo3速度，不足以估计中文或员工语音错误率。tiny模型本身准确率上限未改变。
- 验证：`node tests/speech_perf_v1144.mjs`验证挂起同步不阻塞下一条转写/翻译、消息语言、乱码和静音处理；voice_leave_v1141、language_client_v112、google_v114及130组页面渲染通过。真机仍需验收。

## v1.14.2 / build25：语音仅输入文字

- 最新需求取消录音发送入口：聊天麦克风切换后仅显示“语音转文字”，移除“点击录音”。不新增音频消息，不上传新录音。
- 设备系统识别 → 人工核对文字 → Google翻译 → 人工核对译文 → 确认发送文字。识别失败显示可编辑输入框，允许输入法语音或手工补充；不自动发送错误识别结果。
- 翻译失败或部分失败不允许确认发送；原文保留，可重试。已识别的译文随消息一起发送。
- Google基础文字中转沿用v1.14.1，无新增付费API或数据库变更。旧语音消息仍可播放，不删除历史数据。
- 红米Turbo3系统语音引擎仍需要用户在手机授权；若不可用，使用输入法麦克风输入。不保证识别和机器翻译零误差，发送前必须核对。无USB真机连接，本地回归不等同真机验收。
- 验证：`node tests/text_only_v1142.mjs`、`node tests/google_v114.mjs`、`node tests/language_client_v112.mjs`、构建和130组页面逻辑检查。

## v1.14.1 / web build24

本次热修复：按住说话仅使用独立录音，不同时打开系统识别，避免系统引擎授权/网络故障影响原声。
新增点击录音/结束发送，首次麦克风授权后需重新按住；过短录音明确提示。
录音转文字仍使用设备本地模型，按所选说话语言识别，过滤纯听不清/背景声标记，提供原声校对入口。
Google基础文字翻译优先走已登录的Supabase中转，失败回到直接通道；不启用OpenAI/Azure或收费语音API。
待审批请假独立展示；已批准/已驳回默认折叠，按账号保存展开状态。
本次无需数据库迁移或重装现有Android APK。红米Turbo 3用户需重开应用加载网页更新，并手动确认录音/播放/转写效果；浏览器测试不等同该手机实测。

## v1.14.0 / build 23（已发布）

当前语音方案以本段为准：Google 基础翻译 + 设备系统语音识别；OpenAI 和 Azure 付费语言接口停用。
基础翻译沿用无需密钥的 Google 网页通道，并非 Google Cloud 官方 API，会受到网络、浏览器 CORS 和限流影响。
录音可先发原声，系统识别不可用时可使用本地模型；设置中可以单独选择实际说话语言。
公司暂未注册 VAT，本版不自动补税，不将销售单标作 VAT 税务发票。

服务器与网页须配套升级。按顺序执行 v1.13.0_finance_po.sql、v1.13.0_finance_arap.sql、
v1.13.0_chat_leave.sql、v1.14.0_language_off.sql、v1.14.0_integrity.sql、
v1.14.1_settlement.sql、v1.14.2_invoices.sql、v1.14.3_fx_credit.sql、v1.14.4_payment_caps.sql。
发布包提供合并为一个事务的脚本；脚本不删除已有单据、不追改历史金额。
部署 jxc-language 的停用实现，然后发布 www/ 页面。本版无需新建 API 密钥。

正式单号由服务器按类型和年月连续分配；手机离线号仅是临时编号。
新盘点必须先由服务器冻结仓库并建立快照，终审或驳回后才解冻；旧快照不能直接终审。
同一商品同价重复行合并，不同价需先确认一行价格；旧批准单如有重复行，先受控纠正再出库。
新货款付款需采购单、真实入库流水和供应商发票匹配；定金通过预付款审批。
既有已批准货款在执行付款时也要补齐三单匹配。日汇率由会计/总经理/董事长发布，
未配置汇率时暂停外币采购。原币报价和付款汇率分开留痕，并记录已实现汇兑损益。
总账与期初资金扩展仍保持关闭，需另行核对历史成本、旧币种与期初余额。

真实手机的麦克风、系统识别语言包和播放能力仍须在设备上验收。
本地测试通过不等于线上已部署；以发布核验记录为准。


## v1.12.0 / web build22

统一按钮边框与触控外观，修复标签/入库表单间距及长按钮文字换行；根据底部导航和固定操作栏实测高度增加真实滚动留白，最后一行工作台色块不再遮挡。减少无变化的聊天DOM重绘，保留soft刷新参数。

v1.12.0曾准备付费语言接口，现已按最新要求停用。当前方案见上方版本说明。

新增检查：`node tests/language_v112.mjs`、`node tests/language_client_v112.mjs`；既有SQL、页面、Web Push与FCM检查继续运行。

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


