/* 云端配置（Supabase，与华宝招聘同一个项目）。云端数据库脚本运行前，软件自动用本机模式；运行后自动切换到云端。
   留空 = 本机演示模式（数据存于本机，自带演示账号）。
   填写后 = 多人实时同步：在 Supabase 后台「Project Settings → API」复制 Project URL 和 anon public key 填入即可。
   anon key 是公开密钥，可以放在网页里；所有写操作都由数据库函数（RPC）校验登录与角色权限。 */
window.JXC_CONFIG = {
  supabaseUrl: 'https://vctokfjzgjtvsqftadeh.supabase.co',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZjdG9rZmp6Z2p0dnNxZnRhZGVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ0ODU3NjAsImV4cCI6MjExMDA2MTc2MH0.4yA4ijyvz9F60W2yOCaVLi-tJmCLHHLslx5TbYo-ASA'
};
