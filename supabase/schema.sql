-- =====================================================================
-- 华宝进销存 · ChinaPaw Stock — 云端数据库（Supabase / PostgreSQL）
-- 用法：Supabase 后台 → SQL Editor → 粘贴全文 → Run。可重复执行（只新增、不破坏数据）。
-- 安全原则（与 ChinaPaw 相同）：所有表开启 RLS 且不开放直接读写，
-- 网页只能通过下面的 security definer 函数（RPC）读写，函数内校验登录和角色权限。
-- 密码只以 bcrypt 摘要保存；本文件不含任何真实密码。
-- =====================================================================
create extension if not exists pgcrypto;

-- ---------- 表 ----------
create table if not exists jxc_users(
  id text primary key default 'U'||substr(md5(random()::text),1,10),
  phone text unique not null,
  name text not null,
  role text not null check (role in ('admin','buyer','sales','keeper','viewer')),
  wh text default 'W1',
  active boolean default true,
  pw_hash text not null,
  created_at timestamptz default now()
);
create table if not exists jxc_sessions(
  token text primary key default encode(gen_random_bytes(24),'hex'),
  user_id text references jxc_users(id) on delete cascade,
  device text,
  created_at timestamptz default now(),
  last_seen timestamptz default now()
);
create sequence if not exists jxc_seq;
-- 全部业务数据：k = 类型（products / moves / po / grn / pr / so / sr / counts / ships / svc / partners / wh / settings）
create table if not exists jxc_docs(
  k text not null,
  id text not null,
  d jsonb not null,
  u bigint not null default 0,            -- 客户端修改时间（毫秒），较新者优先
  by_user text,
  seq bigint not null default nextval('jxc_seq'),
  updated_at timestamptz default now(),
  primary key(k,id)
);
create index if not exists jxc_docs_seq on jxc_docs(seq);
create table if not exists jxc_audit(
  id bigserial primary key,
  at timestamptz default now(),
  user_id text,
  action text,
  k text,
  doc_id text,
  detail jsonb
);
alter table jxc_users enable row level security;
alter table jxc_sessions enable row level security;
alter table jxc_docs enable row level security;
alter table jxc_audit enable row level security;

-- ---------- 内部：凭令牌取当前用户 ----------
create or replace function jxc_me_row(p_token text) returns jxc_users
language plpgsql security definer set search_path=public as $$
declare u jxc_users;
begin
  select usr.* into u from jxc_sessions s join jxc_users usr on usr.id=s.user_id
   where s.token=p_token and s.last_seen > now()-interval '30 days' and usr.active;
  if u.id is null then raise exception '登录已过期，请重新登录 / Session expired, please sign in again'; end if;
  update jxc_sessions set last_seen=now() where token=p_token;
  return u;
end $$;

create or replace function jxc_user_json(u jxc_users) returns jsonb language sql immutable as $$
  select jsonb_build_object('id',u.id,'name',u.name,'phone',u.phone,'role',u.role,'wh',u.wh,'active',u.active) $$;

-- ---------- 角色权限：谁能写哪类数据 ----------
create or replace function jxc_can_write(p_role text, p_k text, p_d jsonb) returns boolean
language sql immutable as $$
  select case
    when p_role='admin' then p_k <> 'users'
    when p_k='counts' and coalesce(p_d->>'status','') in ('approved','rejected') then false   -- 盘点审核只能管理员
    when p_k in ('settings','wh','users') then false
    when p_role='buyer'  then p_k in ('po','pr','grn','partners','products','ships','svc') or (p_k='moves' and p_d->>'type'='po_ret')
    when p_role='sales'  then p_k in ('so','sr','partners','ships','svc') or (p_k='moves' and p_d->>'type'='so_ret')
    when p_role='keeper' then p_k in ('po','grn','pr','so','sr','counts','ships','svc') or (p_k='moves' and p_d->>'type' in ('po_in','po_ret','so_out','so_ret'))
    else false end $$;

-- ---------- 登录 / 退出 / 改密码 ----------
create or replace function jxc_login(p_phone text, p_pw text, p_device text default null) returns jsonb
language plpgsql security definer set search_path=public as $$
declare u jxc_users; t text;
begin
  select * into u from jxc_users where phone=regexp_replace(p_phone,'\s','','g') and active;
  if u.id is null or u.pw_hash <> crypt(p_pw, u.pw_hash) then
    perform pg_sleep(0.6);
    raise exception '手机号或密码错误 / Wrong phone or password';
  end if;
  insert into jxc_sessions(user_id,device) values(u.id,left(p_device,120)) returning token into t;
  insert into jxc_audit(user_id,action) values(u.id,'login');
  return jsonb_build_object('token',t,'user',jxc_user_json(u));
end $$;

create or replace function jxc_logout(p_token text) returns void
language sql security definer set search_path=public as $$ delete from jxc_sessions where token=p_token $$;

create or replace function jxc_change_pw(p_token text, p_old text, p_new text) returns void
language plpgsql security definer set search_path=public as $$
declare u jxc_users;
begin
  u := jxc_me_row(p_token);
  if u.pw_hash <> crypt(p_old,u.pw_hash) then raise exception '原密码不正确 / Current password is wrong'; end if;
  if length(p_new) < 6 then raise exception '新密码至少 6 位 / At least 6 characters'; end if;
  update jxc_users set pw_hash=crypt(p_new,gen_salt('bf')) where id=u.id;
  delete from jxc_sessions where user_id=u.id and token<>p_token;   -- 其他设备需要重新登录
  insert into jxc_audit(user_id,action) values(u.id,'change_pw');
end $$;

create or replace function jxc_update_me(p_token text, p_name text, p_wh text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare u jxc_users;
begin
  u := jxc_me_row(p_token);
  update jxc_users set name=coalesce(nullif(trim(p_name),''),name), wh=coalesce(p_wh,wh) where id=u.id returning * into u;
  return jxc_user_json(u);
end $$;

-- ---------- 同步：拉取（增量）/ 提交 ----------
create or replace function jxc_pull(p_token text, p_since bigint) returns jsonb
language plpgsql security definer set search_path=public as $$
declare v_me jxc_users; v_rows jsonb; v_max bigint;
begin
  v_me := jxc_me_row(p_token);
  select coalesce(jsonb_agg(jsonb_build_object('k',x.k,'d',x.d) order by x.seq),'[]'::jsonb), coalesce(max(x.seq),p_since)
    into v_rows, v_max from (select t.k,t.d,t.seq from jxc_docs t where t.seq > p_since order by t.seq limit 2000) x;
  return jsonb_build_object('seq',v_max,'rows',v_rows,
    'users',(select coalesce(jsonb_agg(jxc_user_json(y) order by y.created_at),'[]'::jsonb) from jxc_users y));
end $$;

create or replace function jxc_push(p_token text, p_ops jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare v_me jxc_users; op jsonb; v_k text; v_id text; v_d jsonb; v_u bigint; n_ok int:=0; rej jsonb:='[]'::jsonb; v_old bigint; v_has boolean;
begin
  v_me := jxc_me_row(p_token);
  for op in select * from jsonb_array_elements(p_ops) loop
    v_k := op->>'k'; v_id := op->>'id'; v_d := op->'d'; v_u := coalesce((v_d->>'u')::bigint,0);
    if v_k is null or v_id is null or v_d is null or not jxc_can_write(v_me.role,v_k,v_d) then
      rej := rej || jsonb_build_array(v_id); continue;
    end if;
    select true, t.u into v_has, v_old from jxc_docs t where t.k=v_k and t.id=v_id;
    if coalesce(v_has,false) then
      if v_k='moves' then n_ok:=n_ok+1; v_has:=null; continue; end if;   -- 库存流水只增不改（防止多人同时操作算错库存）
      if v_old > v_u then n_ok:=n_ok+1; v_has:=null; continue; end if;   -- 云端的更新，保留较新的
      update jxc_docs t set d=v_d, u=v_u, by_user=v_me.id, seq=nextval('jxc_seq'), updated_at=now() where t.k=v_k and t.id=v_id;
    else
      insert into jxc_docs(k,id,d,u,by_user) values(v_k,v_id,v_d,v_u,v_me.id);
    end if;
    v_has:=null;
    insert into jxc_audit(user_id,action,k,doc_id,detail) values(v_me.id,'put',v_k,v_id,jsonb_build_object('status',v_d->>'status','no',v_d->>'no'));
    n_ok := n_ok+1;
  end loop;
  return jsonb_build_object('ok',n_ok,'rejected',rej);
end $$;

-- ---------- 管理员：账号管理 ----------
create or replace function jxc_admin_user(p_token text, p_user jsonb, p_pw text default null) returns jsonb
language plpgsql security definer set search_path=public as $$
declare a jxc_users; uid text := nullif(p_user->>'id','');
begin
  a := jxc_me_row(p_token);
  if a.role <> 'admin' then raise exception '只有管理员可以管理账号 / Admins only'; end if;
  if p_pw is not null and length(p_pw) < 6 then raise exception '密码至少 6 位 / At least 6 characters'; end if;
  if uid is null then
    if p_pw is null then raise exception '请设置初始密码 / Initial password required'; end if;
    insert into jxc_users(phone,name,role,wh,active,pw_hash)
      values(p_user->>'phone',p_user->>'name',p_user->>'role',coalesce(p_user->>'wh','W1'),coalesce((p_user->>'active')::boolean,true),crypt(p_pw,gen_salt('bf')));
  else
    if uid=a.id and (p_user->>'role'<>'admin' or not coalesce((p_user->>'active')::boolean,true)) then raise exception '不能停用或降级自己 / You cannot demote or disable yourself'; end if;
    update jxc_users set name=p_user->>'name', role=p_user->>'role', wh=coalesce(p_user->>'wh',wh), active=coalesce((p_user->>'active')::boolean,true),
      pw_hash=case when p_pw is null then pw_hash else crypt(p_pw,gen_salt('bf')) end where id=uid;
    if p_pw is not null or not coalesce((p_user->>'active')::boolean,true) then delete from jxc_sessions where user_id=uid; end if;
  end if;
  insert into jxc_audit(user_id,action,detail) values(a.id,'admin_user',p_user - 'pw');
  return jsonb_build_object('users',(select jsonb_agg(jxc_user_json(x) order by x.created_at) from jxc_users x));
end $$;

-- ---------- 首次使用：创建第一个管理员（已有管理员时不会执行） ----------
create or replace function jxc_bootstrap_admin(p_phone text, p_name text, p_pw text) returns text
language plpgsql security definer set search_path=public as $$
begin
  if exists(select 1 from jxc_users where role='admin') then return '已存在管理员，未做改动 / Admin already exists'; end if;
  if length(p_pw) < 6 then raise exception '密码至少 6 位'; end if;
  insert into jxc_users(phone,name,role,pw_hash) values(p_phone,p_name,'admin',crypt(p_pw,gen_salt('bf')));
  return '管理员已创建 / Admin created';
end $$;
revoke execute on function jxc_bootstrap_admin(text,text,text) from public, anon, authenticated;   -- 只能在 SQL Editor 里执行

-- 网页（anon）只能调用这些函数
grant execute on function jxc_login(text,text,text), jxc_logout(text), jxc_change_pw(text,text,text), jxc_update_me(text,text,text),
  jxc_pull(text,bigint), jxc_push(text,jsonb), jxc_admin_user(text,jsonb,text) to anon, authenticated;
revoke execute on function jxc_me_row(text) from public, anon, authenticated;

-- ---------- 图片存储（商品图片、签收单照片）：公开读取，网页可上传到 jxc/ 目录 ----------
insert into storage.buckets(id,name,public) values('media','media',true) on conflict (id) do nothing;
do $$ begin
  if not exists(select 1 from pg_policies where tablename='objects' and policyname='jxc media upload') then
    create policy "jxc media upload" on storage.objects for insert to anon, authenticated with check (bucket_id='media' and name like 'jxc/%');
  end if;
end $$;

-- =====================================================================
-- 最后一步（只做一次）：在下面填入你自己的手机号、姓名和密码，单独选中这一行运行。
-- 密码由你本人设定，不要发给任何人（包括 AI）。
-- select jxc_bootstrap_admin('你的手机号', '你的姓名', '你自己设定的密码');
-- =====================================================================
