-- =====================================================================
-- 华宝进销存 · ChinaPaw Stock v1.1 — 云端数据库（Supabase / PostgreSQL）
-- 用法：Supabase 后台 → SQL Editor → 粘贴全文 → Run。可重复执行（只新增、不破坏数据）。
-- 安全原则（与 ChinaPaw 相同）：所有表开启 RLS 且不开放直接读写，
-- 网页只能通过下面的 security definer 函数（RPC）读写，函数内校验登录和部门权限。
-- 登录只用密码：密码在全公司唯一，用 bcrypt 摘要保存，本文件不含任何真实密码。
-- =====================================================================
create extension if not exists pgcrypto;

-- ---------- 表 ----------
create table if not exists jxc_users(
  id text primary key default 'U'||substr(md5(random()::text),1,10),
  code text,
  name text not null,
  role text not null,
  wh text default 'W1',
  active boolean default true,
  pw_hash text not null,
  created_at timestamptz default now()
);
-- 从 v1.0（手机号登录）升级：增加账号代码，手机号不再必填，部门改为 6 个
alter table jxc_users add column if not exists code text;
alter table jxc_users add column if not exists is_admin boolean default false;   -- 总经理授权使用后台
alter table jxc_users add column if not exists seq bigint;
alter table jxc_users add column if not exists pos text;                          -- 部门里新增的职位（权限仍按 role）                        -- 账号有变化时更新，手机端只在变化时下载账号列表
do $$ begin
  if exists(select 1 from information_schema.columns where table_name='jxc_users' and column_name='phone') then
    alter table jxc_users alter column phone drop not null;
  end if;
  alter table jxc_users drop constraint if exists jxc_users_role_check;
  update jxc_users set role='gm' where role='admin';
  update jxc_users set code='U'||id where code is null;
  alter table jxc_users add constraint jxc_users_role_check check (role in ('chair','gm','ops','buyer','sales','field','keeper','acct','cashier','clerk'));
end $$;
create unique index if not exists jxc_users_code on jxc_users(code);

create table if not exists jxc_sessions(
  token text primary key default encode(gen_random_bytes(24),'hex'),
  user_id text references jxc_users(id) on delete cascade,
  device text,
  created_at timestamptz default now(),
  last_seen timestamptz default now()
);
create sequence if not exists jxc_seq;
-- 全部业务数据：k = 类型（products / moves / po / grn / pr / so / sr / counts / ships / svc / fin / partners / wh / settings）
create table if not exists jxc_docs(
  k text not null,
  id text not null,
  d jsonb not null,
  u bigint not null default 0,
  by_user text,
  seq bigint not null default nextval('jxc_seq'),
  updated_at timestamptz default now(),
  primary key(k,id)
);
create index if not exists jxc_docs_seq on jxc_docs(seq);
update jxc_users set seq=nextval('jxc_seq') where seq is null;
create or replace function jxc_users_touch() returns trigger language plpgsql as $$ begin new.seq := nextval('jxc_seq'); return new; end $$;
drop trigger if exists jxc_users_touch on jxc_users;
create trigger jxc_users_touch before insert or update on jxc_users for each row execute function jxc_users_touch();
-- 门店开通码：付款后由平台发给客户，每个码增加 1 个门店名额，只能用一次
create table if not exists jxc_codes(code text primary key, created_at timestamptz default now(), used_at timestamptz, used_by text);
alter table jxc_codes enable row level security;
create table if not exists jxc_audit(
  id bigserial primary key, at timestamptz default now(), user_id text, action text, k text, doc_id text, detail jsonb
);
-- 平台（软件运营方）密码：只用于开通 VIP、调整门店数量
create table if not exists jxc_platform(id int primary key default 1 check (id=1), pw_hash text not null);
-- 连续输错密码 5 次锁定 1 分钟
create table if not exists jxc_fail(device text primary key, n int default 0, until timestamptz);
alter table jxc_users enable row level security;
alter table jxc_sessions enable row level security;
alter table jxc_docs enable row level security;
alter table jxc_audit enable row level security;
alter table jxc_platform enable row level security;
alter table jxc_fail enable row level security;

-- ---------- 内部函数 ----------
create or replace function jxc_me_row(p_token text) returns jxc_users
language plpgsql security definer set search_path=public, extensions as $$
declare v jxc_users;
begin
  select usr.* into v from jxc_sessions s join jxc_users usr on usr.id=s.user_id
   where s.token=p_token and s.last_seen > now()-interval '30 days' and usr.active;
  if v.id is null then raise exception '登录已过期，请重新登录 / Session expired, please sign in again'; end if;
  update jxc_sessions set last_seen=now() where token=p_token;
  return v;
end $$;

create or replace function jxc_user_json(u jxc_users) returns jsonb language sql immutable as $$
  select jsonb_build_object('id',u.id,'code',u.code,'name',u.name,'role',u.role,'wh',u.wh,'active',u.active,'admin',coalesce(u.is_admin,false),'pos',u.pos) $$;

-- 账号代码 → 部门：111111 总经理 / 222222 采购主管 / 333333 销售经理 / 444444 仓库主管 / 555555 会计 / 666666 出纳；可带“-序号”
create or replace function jxc_role_of(p_code text) returns text language sql immutable as $$
  select case when p_code ~ '^\d{6}(-\d{1,3})?$' then case split_part(p_code,'-',1) when '111111' then 'chair' when '111112' then 'gm' when '222222' then 'buyer' when '333333' then 'sales'
    when '444444' then 'keeper' when '555555' then 'acct' when '666666' then 'cashier' when '777777' then 'field' when '888888' then 'ops' when '999999' then 'clerk' end end $$;

-- 密码是否已被其他账号使用（密码全公司唯一，登录才能识别账号）
create or replace function jxc_pw_taken(p_pw text, p_except text) returns boolean
language sql security definer set search_path=public, extensions as $$
  select exists(select 1 from jxc_users where id is distinct from p_except and pw_hash = crypt(p_pw, pw_hash)) $$;

-- ---------- 部门权限：谁能写哪类数据（互不越界） ----------
create or replace function jxc_can_write(p_role text, p_k text, p_d jsonb) returns boolean
language sql immutable as $$
  select case
    when p_k='users' then false
    when p_k in ('chat','msg','exp') then true                       -- 沟通、费用：人人可用，具体步骤由 jxc_flow_ok 检查
    when p_k='att' then p_role in ('field','sales','gm','buyer','keeper','acct','cashier','ops','clerk')   -- 考勤打卡：所有岗位
    when p_role in ('chair','gm') then true
    when p_k in ('settings','wh') then false
    when p_role='ops'    then p_k in ('fin','counts','ships','svc') or (p_k='moves' and p_d->>'type'='adj')
    when p_role='clerk' then p_k='grn'
    when p_role='buyer'  then p_k in ('grn','po','partners','products','ships','svc') or (p_k='pr' and coalesce(p_d->>'status','')='pending')
    when p_role in ('sales','field') then p_k in ('so','partners','ships','svc') or (p_k='sr' and coalesce(p_d->>'status','')='pending')
    when p_role='keeper' then p_k in ('po','grn','so','pr','sr','counts','ships','svc') or (p_k='moves' and p_d->>'type' in ('po_in','po_ret','so_out','so_ret','init'))
    when p_role='acct'   then p_k in ('grn','so','counts') or (p_k='fin' and ((p_d->>'type'='rcv' and p_d->>'status'='verified') or (p_d->>'type'='pay' and p_d->>'status' in ('req','void'))))
    when p_role='cashier' then p_k='so' or (p_k='fin' and ((p_d->>'type'='rcv' and p_d->>'status' in ('recorded','verified')) or (p_d->>'type'='pay' and p_d->>'status'='paid')))
    else false end $$;

-- 审批流程：每一步只能由对应职位、在上一步完成后操作（互相制约）。总经理可以做任何一步
create or replace function jxc_flow_ok(p_me jxc_users, p_k text, p_d jsonb, p_has boolean, p_od jsonb) returns boolean
language plpgsql stable as $$
declare r text := p_me.role; ns text := coalesce(p_d->>'status',''); os text := p_od->>'status';
begin
  if p_k='msg' then return not p_has or p_od->>'by'=p_me.id; end if;                       -- 只有发送人能撤回
  if p_k='chat' then return not p_has or jsonb_typeof(p_od->'mem')<>'array' or (p_od->'mem') ? p_me.id; end if;
  if p_k='att' then return not p_has and r<>'chair' and nullif(trim(p_d->>'photo'),'') is not null and p_d->>'type' in ('in','out','visit'); end if;                                               -- 打卡记录不能修改
  -- Receipt payload cannot change during approval. Legacy completed receipts remain read-only.
  if p_k='grn' then
    if not p_has then return r in ('buyer','clerk','keeper','gm') and ns='submitted'
      and nullif(trim(p_d->>'batch'),'') is not null and jsonb_array_length(p_d->'items')>0
      and not exists(select 1 from jsonb_array_elements(p_d->'items') i where coalesce((i->>'qty')::numeric,0)<=0 or nullif(trim(i->>'batch'),'') is null); end if;
    if (p_d - array['status','fin','check','received','reject','u','_q']) is distinct from (p_od - array['status','fin','check','received','reject','u','_q']) then return false; end if;
    if r='acct' then return os='submitted' and ns in ('fin_ok','rejected'); end if;
    if r='clerk' then return os='fin_ok' and ns in ('ready','rejected') and p_d->'fin'=p_od->'fin'; end if;
    if r='keeper' then return os='ready' and ns='done' and p_d->'fin'=p_od->'fin' and p_d->'check'=p_od->'check'; end if;
    return false;
  end if;
  -- Stock movements must reference a document released for this exact step.
  if p_k='moves' and p_d->>'type'='so_out' then
    return r in ('keeper','gm') and exists(select 1 from jxc_docs d where d.k='so' and d.id=p_d->>'ref' and d.d->>'status'='approved');
  end if;
  if p_k='moves' and p_d->>'type'='po_in' then
    return r='keeper' and exists(select 1 from jxc_docs d where d.k='grn' and d.id=p_d->>'ref' and d.d->>'status'='ready');
  end if;
  if p_k='po' and r='keeper' then return p_has and os='ordered' and ns in ('ordered','received'); end if;
  -- Every expense and every payment must pass operations; above 2000 also requires GM.
  if p_k='exp' then
    if not p_has then return ns='submitted' and coalesce((p_d->>'amt')::numeric,0)>0 and p_d->'op' is null and p_d->'gm' is null; end if;
    if (p_d - array['status','op','gm','bk','bt','pd','rj','seen','u','_q']) is distinct from (p_od - array['status','op','gm','bk','bt','pd','rj','seen','u','_q']) then return false; end if;
    if p_od->>'by'=p_me.id and ((os='submitted' and ns='void') or (os='rejected' and ns='rejected')) then return true; end if;
    if r='ops' then return os='submitted' and (ns='rejected' or (p_d->'op'->>'by'=p_me.id and ns=case when (p_od->>'amt')::numeric>2000 then 'gm_pending' else 'approved' end)); end if;
    if p_d->'op' is distinct from p_od->'op' then return false; end if;
    if r='gm' then return os='gm_pending' and p_od->'op'->>'by' is not null and (ns='rejected' or (ns='approved' and p_d->'gm'->>'by'=p_me.id)); end if;
    if p_d->'gm' is distinct from p_od->'gm' then return false; end if;
    if p_od->'op'->>'by' is null or ((p_od->>'amt')::numeric>2000 and p_od->'gm'->>'by' is null) then return false; end if;
    if r='acct' then return os='approved' and ns in ('booked','rejected'); end if;
    if r='cashier' then return os='booked' and ns='paid'; end if;
    return false;
  end if;
  if p_k='fin' and p_d->>'type'='pay' then
    if not p_has then return r in ('acct','gm') and ns='req' and coalesce((p_d->>'amount')::numeric,0)>0 and p_d->>'oby' is null and p_d->>'gby' is null; end if;
    if r in ('acct','gm') and ns='req' and os in ('req','rejected') then return coalesce((p_d->>'amount')::numeric,0)>0 and p_d->>'oby' is null and p_d->>'gby' is null; end if;
    if (p_d - array['status','oby','ot','onote','gby','gt','gnote','pby','pt','pref','method','u','_q']) is distinct from (p_od - array['status','oby','ot','onote','gby','gt','gnote','pby','pt','pref','method','u','_q']) then return false; end if;
    if r in ('gm','ops') and os='approved' and ns='req' then return p_d->>'oby' is null and p_d->>'gby' is null; end if;
    if r='ops' then return os='req' and (ns='rejected' or (p_d->>'oby'=p_me.id and ns=case when (p_od->>'amount')::numeric>2000 then 'gm_pending' else 'approved' end)); end if;
    if p_d->>'oby' is distinct from p_od->>'oby' then return false; end if;
    if r='gm' then return os='gm_pending' and p_od->>'oby' is not null and (ns='rejected' or (ns='approved' and p_d->>'gby'=p_me.id)); end if;
    if p_d->>'gby' is distinct from p_od->>'gby' then return false; end if;
    if r='acct' then return ns='void' and os in ('req','rejected'); end if;
    if r='cashier' then return os='approved' and ns='paid' and p_od->>'oby' is not null and ((p_od->>'amount')::numeric<=2000 or p_od->>'gby' is not null); end if;
    return false;
  end if;
  if r in ('chair','gm') then return true; end if;
  if p_k='so' then                -- 销售：业务员提交 → 财务（现款确认收款 / 赊账初审）→ 总经理（赊账）→ 仓库出库
    if r in ('sales','field') then return (ns in ('draft','submitted') and coalesce(os,'draft') in ('draft','submitted','rejected')) or (ns='done' and os='shipped') or (ns='cancel' and coalesce(os,'draft') in ('draft','rejected')); end if;
    if r in ('acct','cashier') then return os='submitted' and (ns='rejected' or (ns='approved' and coalesce(p_d->>'pay','cash')<>'credit') or (ns='credit_gm' and p_d->>'pay'='credit')); end if;
    if r='keeper' then return (os='approved' and ns='shipped') or (os='shipped' and ns='done'); end if;
    return false;
  end if;
  if p_k='counts' then            -- 盘点：库管 → 财务复核 → 运营经理 / 总经理终审
    if r='keeper' then return ns='pending' and coalesce(os,'pending') in ('pending','rejected'); end if;
    if r='acct' then return os='pending' and ns in ('fin_ok','rejected'); end if;
    if r='ops' then return os='fin_ok' and ns in ('approved','rejected'); end if;
    return false;
  end if;
  if p_k='exp' then               -- 费用：提交 →（特殊）总经理 / 运营经理审批 → 会计入账 → 出纳付款
    if not p_has then return ns='submitted'; end if;
    if p_od->>'by'=p_me.id and ((os='submitted' and ns='void') or (os='rejected' and ns='rejected')) then return true; end if;
    if r='ops' then return os='submitted' and ns in ('approved','rejected'); end if;
    if r='acct' then return (os='approved' or (os='submitted' and not coalesce((p_od->>'special')::boolean,false))) and ns in ('booked','rejected'); end if;
    if r='cashier' then return os='booked' and ns='paid'; end if;
    return false;
  end if;
  return true;
end $$;

-- ---------- 登录（只用密码）/ 退出 / 改密码 ----------
-- 先删除旧版本的登录函数（v1.0 手机号登录、v1.1.0 只有密码），再创建新版：先选职位，再输入密码
do $$ declare r record; begin
  for r in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.proname='jxc_login' and n.nspname='public' loop
    execute 'drop function '||r.sig; end loop;
end $$;
create or replace function jxc_login(p_pw text, p_role text default null, p_device text default null, p_uid text default null) returns jsonb
language plpgsql security definer set search_path=public, extensions as $$
declare v jxc_users; t text; f jxc_fail; dev text := left(coalesce(p_device,'?'),120);
begin
  select * into f from jxc_fail where device=dev;
  -- 出错时返回 error（不抛异常），这样失败次数能保存下来，用于锁定
  if f.until is not null and f.until > now() then return jsonb_build_object('error','尝试次数过多，请 1 分钟后再试 / Too many attempts, try again in a minute'); end if;
  -- 密码可以相同：同一职位有多人时，登录页让本人选择姓名（p_uid）
  select * into v from jxc_users where active and (p_role is null or role=p_role) and (p_uid is null or id=p_uid) and pw_hash = crypt(p_pw, pw_hash) order by created_at limit 1;
  if v.id is null then
    insert into jxc_fail(device,n) values(dev,1) on conflict(device) do update set n=jxc_fail.n+1,
      until=case when jxc_fail.n+1>=5 then now()+interval '1 minute' else null end;
    perform pg_sleep(0.5);
    return jsonb_build_object('error','职位或密码不正确，或账号已停用 / Wrong position or password, or account disabled');
  end if;
  delete from jxc_fail where device=dev;
  insert into jxc_sessions(user_id,device) values(v.id,dev) returning token into t;
  insert into jxc_audit(user_id,action) values(v.id,'login');
  return jsonb_build_object('token',t,'user',jxc_user_json(v));
end $$;

create or replace function jxc_logout(p_token text) returns void
language sql security definer set search_path=public, extensions as $$ delete from jxc_sessions where token=p_token $$;

create or replace function jxc_change_pw(p_token text, p_old text, p_new text) returns void
language plpgsql security definer set search_path=public, extensions as $$
declare v jxc_users;
begin
  v := jxc_me_row(p_token);
  if v.pw_hash <> crypt(p_old,v.pw_hash) then raise exception '原密码不正确 / Current password is wrong'; end if;
  if length(p_new) < 6 then raise exception '新密码至少 6 位 / At least 6 characters'; end if;
  update jxc_users set pw_hash=crypt(p_new,gen_salt('bf')) where id=v.id;
  delete from jxc_sessions where user_id=v.id and token<>p_token;
  insert into jxc_audit(user_id,action) values(v.id,'change_pw');
end $$;

create or replace function jxc_update_me(p_token text, p_name text, p_wh text) returns jsonb
language plpgsql security definer set search_path=public, extensions as $$
declare v jxc_users;
begin
  v := jxc_me_row(p_token);
  update jxc_users set name=coalesce(nullif(trim(p_name),''),name), wh=coalesce(p_wh,wh) where id=v.id returning * into v;
  return jxc_user_json(v);
end $$;

-- ---------- 同步：拉取（增量）/ 提交 ----------
create or replace function jxc_pull(p_token text, p_since bigint) returns jsonb
language plpgsql security definer set search_path=public, extensions as $$
declare v_me jxc_users; v_rows jsonb; v_max bigint;
begin
  v_me := jxc_me_row(p_token);
  -- 群聊 / 私聊只发给成员（mem 为空 = 全公司群）
  select coalesce(jsonb_agg(jsonb_build_object('k',x.k,'d',x.d) order by x.seq) filter (where x.k not in ('chat','msg') or jsonb_typeof(x.d->'mem')<>'array' or (x.d->'mem') ? v_me.id),'[]'::jsonb), coalesce(max(x.seq),p_since)
    into v_rows, v_max from (select t.k,t.d,t.seq from jxc_docs t where t.seq > p_since order by t.seq limit 2000) x;
  -- 账号列表只在有变化时返回（与华宝相同：没变化就不重复下载）
  if p_since = 0 or exists(select 1 from jxc_users where seq > p_since) then
    v_max := greatest(v_max, coalesce((select max(seq) from jxc_users),0));
    return jsonb_build_object('seq',v_max,'rows',v_rows,'users',(select coalesce(jsonb_agg(jxc_user_json(y) order by y.created_at),'[]'::jsonb) from jxc_users y));
  end if;
  return jsonb_build_object('seq',v_max,'rows',v_rows);
end $$;

create or replace function jxc_push(p_token text, p_ops jsonb) returns jsonb
language plpgsql security definer set search_path=public, extensions as $$
declare v_me jxc_users; op jsonb; v_k text; v_id text; v_d jsonb; v_u bigint; n_ok int:=0; rej jsonb:='[]'::jsonb; v_old bigint; v_has boolean; v_plan jsonb; v_ost text; v_od jsonb;
begin
  v_me := jxc_me_row(p_token);
  -- Serialize business commits so simultaneous warehouse confirmations cannot post stock twice.
  perform pg_advisory_xact_lock(hashtext('jxc_push_business'));
  for op in select * from jsonb_array_elements(p_ops) loop
    v_k := op->>'k'; v_id := op->>'id'; v_d := op->'d'; v_u := coalesce((v_d->>'u')::bigint,0);
    if v_k is null or v_id is null or v_d is null or not (jxc_can_write(v_me.role,v_k,v_d) or (coalesce(v_me.is_admin,false) and v_k in ('products','partners','wh','settings'))) then
      rej := rej || jsonb_build_array(v_id); continue;
    end if;
    if v_k='settings' and v_id<>'app' then rej := rej || jsonb_build_array(v_id); continue; end if;
    if v_k='settings' then   -- VIP 与门店数量只能由平台修改：公司提交的设置保留云端已有的 plan
      v_plan := null;
      select t.d->'plan' into v_plan from jxc_docs t where t.k='settings' and t.id=v_id;
      v_d := (v_d - 'plan') || jsonb_build_object('plan',coalesce(v_plan,'{"limit":1}'::jsonb));
    end if;
    v_has := null;
    v_od := null;
    select true, t.u, t.d->>'status', t.d into v_has, v_old, v_ost, v_od from jxc_docs t where t.k=v_k and t.id=v_id;
    if not coalesce(v_has,false) and v_k in ('msg','exp','att') then v_d := jsonb_set(v_d,'{by}',to_jsonb(v_me.id)); end if;   -- 发送人 / 申请人以登录账号为准
    if not coalesce(jxc_flow_ok(v_me,v_k,v_d,coalesce(v_has,false),v_od),false) then rej := rej || jsonb_build_array(v_id); continue; end if;
    if coalesce(v_has,false) then
      if v_k='moves' then n_ok:=n_ok+1; continue; end if;            -- 库存流水只增不改
      if v_old > v_u then n_ok:=n_ok+1; continue; end if;           -- 保留较新的
      update jxc_docs t set d=v_d, u=v_u, by_user=v_me.id, seq=nextval('jxc_seq'), updated_at=now() where t.k=v_k and t.id=v_id;
    else
      insert into jxc_docs(k,id,d,u,by_user) values(v_k,v_id,v_d,v_u,v_me.id);
    end if;
    insert into jxc_audit(user_id,action,k,doc_id,detail) values(v_me.id,'put',v_k,v_id,jsonb_build_object('status',v_d->>'status','no',v_d->>'no'));
    n_ok := n_ok+1;
  end loop;
  if jsonb_array_length(rej)>0 then raise exception '审批状态已变化或没有权限，请同步后重试 / Approval changed or permission denied: %',rej; end if;
  return jsonb_build_object('ok',n_ok,'rejected',rej);
end $$;

-- ---------- 总经理：账号管理（新增“部门代码-序号”账号、改密码、停用登录） ----------
create or replace function jxc_admin_user(p_token text, p_user jsonb, p_pw text default null) returns jsonb
language plpgsql security definer set search_path=public, extensions as $$
declare a jxc_users; v_id text := nullif(p_user->>'id',''); v_code text := trim(p_user->>'code'); v_role text; v_pw text;
begin
  a := jxc_me_row(p_token);
  if a.role not in ('chair','gm') and not coalesce(a.is_admin,false) then raise exception '没有后台权限 / No backend access'; end if;
  v_role := coalesce(nullif(p_user->>'role',''), case when v_id is null then jxc_role_of(v_code) else (select role from jxc_users where id=v_id) end);
  if v_role not in ('chair','gm','ops','buyer','sales','field','keeper','acct','cashier','clerk') then raise exception '请选择职位 / Choose a position'; end if;
  if a.role <> 'chair' and (v_role='chair' or exists(select 1 from jxc_users where id=v_id and role='chair')) then raise exception '董事长账号只能由董事长修改 / Only the chairman can edit chairman accounts'; end if;
  if v_id = a.id and v_role <> a.role then raise exception '不能修改自己的职位 / You cannot change your own position'; end if;
  if exists(select 1 from jxc_users where id=v_id and role='chair') and (v_role<>'chair' or not coalesce((p_user->>'active')::boolean,true))
     and not exists(select 1 from jxc_users where id<>v_id and role='chair' and active) then raise exception '至少要保留一个可登录的董事长 / Keep at least one active chairman'; end if;
  if v_id is null then
    if jxc_role_of(v_code) is null then raise exception '账号代码格式：部门代码或“部门代码-序号”，如 444444-1'; end if;
    if exists(select 1 from jxc_users where code=v_code) then raise exception '这个账号代码已存在 / Code already exists'; end if;
    v_pw := coalesce(nullif(p_pw,''), '666666');
    if length(v_pw) < 6 then raise exception '密码至少 6 位 / At least 6 characters'; end if;
    insert into jxc_users(code,name,role,pos,wh,active,pw_hash,is_admin)
      values(v_code,p_user->>'name',v_role,nullif(p_user->>'pos',''),coalesce(p_user->>'wh','W1'),coalesce((p_user->>'active')::boolean,true),crypt(v_pw,gen_salt('bf')),
        a.role='chair' and v_role not in ('chair','gm') and coalesce((p_user->>'admin')::boolean,false));
  else
    if v_id=a.id and not coalesce((p_user->>'active')::boolean,true) then raise exception '不能停用自己的账号 / You cannot disable yourself'; end if;
    if p_pw is not null and length(p_pw) < 6 then raise exception '密码至少 6 位 / At least 6 characters'; end if;
    update jxc_users set name=coalesce(p_user->>'name',name), role=v_role, pos=case when v_id=a.id then pos else nullif(p_user->>'pos','') end, wh=coalesce(p_user->>'wh',wh), active=coalesce((p_user->>'active')::boolean,true),
      pw_hash=case when p_pw is null then pw_hash else crypt(p_pw,gen_salt('bf')) end,
      is_admin=case when v_role in ('chair','gm') then false when a.role='chair' then coalesce((p_user->>'admin')::boolean,false) else is_admin end where id=v_id;
    if p_pw is not null or not coalesce((p_user->>'active')::boolean,true) then delete from jxc_sessions where user_id=v_id; end if;
  end if;
  insert into jxc_audit(user_id,action,detail) values(a.id,'admin_user',jsonb_build_object('code',coalesce(v_code,v_id)));
  return jsonb_build_object('users',(select jsonb_agg(jxc_user_json(x) order by x.created_at) from jxc_users x));
end $$;

-- ---------- 平台：开通 VIP / 调整门店数量（需要平台密码） ----------
create or replace function jxc_set_plan(p_token text, p_platform_pw text, p_plan jsonb) returns jsonb
language plpgsql security definer set search_path=public, extensions as $$
declare a jxc_users; h text; v_plan jsonb; v_d jsonb;
begin
  a := jxc_me_row(p_token);
  select pw_hash into h from jxc_platform where id=1;
  if h is null or h <> crypt(p_platform_pw,h) then perform pg_sleep(0.5); raise exception '平台密码不正确 / Wrong platform password'; end if;
  v_plan := jsonb_build_object('limit',greatest(1,least(99,coalesce((p_plan->>'limit')::int,1))));
  select d into v_d from jxc_docs where k='settings' and id='app';
  v_d := coalesce(v_d,'{"id":"app"}'::jsonb) || jsonb_build_object('plan',v_plan,'u',(extract(epoch from now())*1000)::bigint);
  insert into jxc_docs(k,id,d,u,by_user) values('settings','app',v_d,(v_d->>'u')::bigint,a.id)
    on conflict(k,id) do update set d=excluded.d,u=excluded.u,by_user=excluded.by_user,seq=nextval('jxc_seq'),updated_at=now();
  insert into jxc_audit(user_id,action,detail) values(a.id,'set_plan',v_plan);
  return v_plan;
end $$;

-- ---------- 总经理：清空业务数据，开始正式使用（账号、门店、公司设置保留）。各手机通过同步收到“已删除”标记 ----------
create or replace function jxc_reset(p_token text, p_confirm text) returns jsonb
language plpgsql security definer set search_path=public, extensions as $$
declare a jxc_users; n int; v_u bigint := (extract(epoch from now())*1000)::bigint;
begin
  a := jxc_me_row(p_token);
  if a.role <> 'chair' then raise exception '只有董事长可以清空数据 / Only the GM can clear data'; end if;
  if p_confirm <> '清空' then raise exception '请输入“清空”确认 / Type the confirmation'; end if;
  update jxc_docs set d=jsonb_build_object('id',id,'del',true,'u',v_u), u=v_u, by_user=a.id, seq=nextval('jxc_seq'), updated_at=now()
    where k not in ('settings','wh') and coalesce(d->>'del','false')<>'true';
  get diagnostics n = row_count;
  update jxc_docs set d=(d - 'cats') || jsonb_build_object('cats','[]'::jsonb,'u',v_u), u=v_u, seq=nextval('jxc_seq') where k='settings' and id='app';
  insert into jxc_audit(user_id,action,detail) values(a.id,'reset',jsonb_build_object('docs',n));
  return jsonb_build_object('cleared',n);
end $$;

-- ---------- 实时同步：手机每 3 秒问一次“最新编号”，有变化才下载（请求很小，省流量、省电） ----------
create or replace function jxc_head(p_token text) returns bigint language sql stable security definer set search_path=public, extensions as $$
  select case when exists(select 1 from jxc_sessions s join jxc_users u on u.id=s.user_id where s.token=p_token and u.active and s.last_seen > now()-interval '30 days')
    then greatest(coalesce((select max(seq) from jxc_docs),0),coalesce((select max(seq) from jxc_users),0)) else -1 end $$;

-- ---------- 登录页显示各部门新增的职位（只有名称，不含任何账号信息） ----------
create or replace function jxc_positions() returns jsonb language sql stable security definer set search_path=public, extensions as $$
  select coalesce((select jsonb_agg(jsonb_build_object('id',x->>'id','dept',x->>'dept','role',x->>'role','n',x->'n')) from jxc_docs t, jsonb_array_elements(coalesce(t.d->'positions','[]'::jsonb)) x where t.k='settings' and t.id='app'),'[]'::jsonb) $$;

-- ---------- 门店开通码：生成（平台）/ 使用（总经理或被授权的人） ----------
create or replace function jxc_gen_codes(p_platform_pw text, p_n int default 1) returns jsonb
language plpgsql security definer set search_path=public, extensions as $$
declare h text; out jsonb := '[]'::jsonb; c text; k int;
begin
  select pw_hash into h from jxc_platform where id=1;
  if h is null or h <> crypt(p_platform_pw,h) then perform pg_sleep(0.5); raise exception '平台密码不正确 / Wrong platform password'; end if;
  for k in 1..greatest(1,least(50,coalesce(p_n,1))) loop
    c := 'MD'||upper(substr(translate(encode(gen_random_bytes(12),'base64'),'+/=01OIl',''),1,8));
    insert into jxc_codes(code) values(c) on conflict do nothing; out := out || to_jsonb(c);
  end loop;
  return out;
end $$;
create or replace function jxc_redeem_code(p_token text, p_code text) returns jsonb
language plpgsql security definer set search_path=public, extensions as $$
declare a jxc_users; c jxc_codes; v_d jsonb; v_lim int;
begin
  a := jxc_me_row(p_token);
  if a.role not in ('chair','gm') and not coalesce(a.is_admin,false) then raise exception '没有后台权限 / No backend access'; end if;
  select * into c from jxc_codes where code=upper(trim(p_code)) for update;
  if c.code is null then perform pg_sleep(0.5); raise exception '开通码不正确 / Invalid activation code'; end if;
  if c.used_at is not null then raise exception '这个开通码已经用过了 / This code has already been used'; end if;
  update jxc_codes set used_at=now(), used_by=a.id where code=c.code;
  select d into v_d from jxc_docs where k='settings' and id='app';
  v_lim := greatest(1,coalesce((v_d->'plan'->>'limit')::int,1)) + 1;
  v_d := coalesce(v_d,'{"id":"app"}'::jsonb) || jsonb_build_object('plan',jsonb_build_object('limit',v_lim),'u',(extract(epoch from now())*1000)::bigint);
  insert into jxc_docs(k,id,d,u,by_user) values('settings','app',v_d,(v_d->>'u')::bigint,a.id)
    on conflict(k,id) do update set d=excluded.d,u=excluded.u,by_user=excluded.by_user,seq=nextval('jxc_seq'),updated_at=now();
  insert into jxc_audit(user_id,action,detail) values(a.id,'redeem_code',jsonb_build_object('code',c.code,'limit',v_lim));
  return jsonb_build_object('limit',v_lim);
end $$;

-- ---------- 首次使用：创建 8 个部门账号（初始密码 = 部门代码）。已有账号时不会重复创建 ----------
create or replace function jxc_bootstrap() returns text
language plpgsql security definer set search_path=public, extensions as $$
declare r record;
begin
  if exists(select 1 from jxc_users) then return '已有账号，未做改动 / Accounts already exist'; end if;
  for r in select * from (values ('111111','董事长','chair'),('111112','总经理','gm'),('222222','采购主管','buyer'),('333333','销售经理','sales'),
      ('444444','仓库主管','keeper'),('555555','会计','acct'),('666666','出纳','cashier'),('777777','外勤人员','field'),('888888','运营经理','ops')) v(code,name,role) loop
    insert into jxc_users(code,name,role,pw_hash) values(r.code,r.name,r.role,crypt('666666',gen_salt('bf')));
  end loop;
  -- 公司设置与第 1 个门店（初始只有 1 个门店名额）
  insert into jxc_docs(k,id,d,u) values('settings','app',jsonb_build_object('id','app','base','GHS','plan',jsonb_build_object('limit',1),'u',(extract(epoch from now())*1000)::bigint),(extract(epoch from now())*1000)::bigint) on conflict do nothing;
  insert into jxc_docs(k,id,d,u) values('wh','W1',jsonb_build_object('id','W1','n',jsonb_build_object('zh','总店','en','Main store'),'city',jsonb_build_object('zh','','en',''),'u',(extract(epoch from now())*1000)::bigint),(extract(epoch from now())*1000)::bigint) on conflict do nothing;
  return '已创建 8 个部门账号，请登录后立即修改初始密码 / 8 department accounts created — change the starting passwords';
end $$;
create or replace function jxc_set_platform_pw(p_pw text) returns text
language plpgsql security definer set search_path=public, extensions as $$
begin
  if length(p_pw) < 8 then raise exception '平台密码至少 8 位'; end if;
  insert into jxc_platform(id,pw_hash) values(1,crypt(p_pw,gen_salt('bf'))) on conflict(id) do update set pw_hash=excluded.pw_hash;
  return '平台密码已设置 / Platform password set';
end $$;
-- 已在使用的公司：补建“外勤人员”“运营经理”账号（初始密码 = 部门代码，登录后请修改）
create or replace function jxc_add_roles() returns int language plpgsql security definer set search_path=public, extensions as $$
declare n int;
begin
  if not exists(select 1 from jxc_users) then return 0; end if;
  insert into jxc_users(code,name,role,pw_hash) select v.code,v.name,v.role,crypt('666666',gen_salt('bf')) from (values('777777','外勤人员','field'),('888888','运营经理','ops')) v(code,name,role)
    where not exists(select 1 from jxc_users u where u.code=v.code);
  get diagnostics n = row_count; return n;
end $$;
select jxc_add_roles();
revoke execute on function jxc_add_roles() from public, anon, authenticated;
-- 登录页：各职位的人员姓名（只有姓名和职位，不含密码等信息），同一职位多人时用来选择
create or replace function jxc_staff() returns jsonb language sql stable security definer set search_path=public, extensions as $$
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'role',role,'pos',pos) order by created_at),'[]'::jsonb) from jxc_users where active $$;
-- 总经理：把所有账号的密码统一重设
create or replace function jxc_reset_all_pw(p_token text, p_pw text) returns jsonb language plpgsql security definer set search_path=public, extensions as $$
declare a jxc_users;
begin
  a := jxc_me_row(p_token);
  if a.role <> 'chair' then raise exception '只有董事长可以统一重设密码 / Only the GM can do this'; end if;
  if length(coalesce(p_pw,'')) < 6 then raise exception '密码至少 6 位 / At least 6 characters'; end if;
  update jxc_users set pw_hash=crypt(p_pw,gen_salt('bf'));
  insert into jxc_audit(user_id,action) values(a.id,'reset_all_pw');
  return jsonb_build_object('users',(select jsonb_agg(jxc_user_json(x) order by x.created_at) from jxc_users x));
end $$;
-- 一次性：按总经理要求，把现有所有账号密码设为 666666（只执行一次，以后重复运行脚本不会再改）
create table if not exists jxc_flags(k text primary key, at timestamptz default now());
alter table jxc_flags enable row level security;
create or replace function jxc_once_pw() returns text language plpgsql security definer set search_path=public, extensions as $$
begin
  if exists(select 1 from jxc_flags where k='pw666666') then return '已执行过 / already done'; end if;
  update jxc_users set pw_hash=crypt('666666',gen_salt('bf'));
  insert into jxc_flags(k) values('pw666666');
  return '所有账号密码已设为 666666 / all passwords set to 666666';
end $$;
select jxc_once_pw();
revoke execute on function jxc_once_pw() from public, anon, authenticated;
-- 这些只能在 SQL Editor 里执行，网页调用不了
revoke execute on function jxc_bootstrap() from public, anon, authenticated;
revoke execute on function jxc_set_platform_pw(text) from public, anon, authenticated;
revoke execute on function jxc_me_row(text) from public, anon, authenticated;
revoke execute on function jxc_pw_taken(text,text) from public, anon, authenticated;
do $$ begin
  if exists(select 1 from pg_proc where proname='jxc_bootstrap_admin') then
    execute 'revoke execute on function jxc_bootstrap_admin(text,text,text) from public, anon, authenticated'; end if;
end $$;

-- 网页（anon）只能调用这些函数
grant execute on function jxc_login(text,text,text,text), jxc_logout(text), jxc_change_pw(text,text,text), jxc_update_me(text,text,text),
  jxc_pull(text,bigint), jxc_push(text,jsonb), jxc_admin_user(text,jsonb,text), jxc_set_plan(text,text,jsonb),
  jxc_gen_codes(text,int), jxc_redeem_code(text,text), jxc_positions(), jxc_head(text), jxc_reset(text,text), jxc_staff(), jxc_reset_all_pw(text,text) to anon, authenticated;

-- ---------- 图片存储：与华宝招聘相同（media/p/<sha1>，同一张图只存一份）。华宝项目里已有上传规则时，这条不会重复创建 ----------
insert into storage.buckets(id,name,public) values('media','media',true) on conflict (id) do nothing;
do $$ begin
  if not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and cmd='INSERT' and coalesce(with_check,'') like '%media%') then
    create policy "jxc media upload" on storage.objects for insert to anon, authenticated with check (bucket_id='media' and name like 'p/%');
  end if;
end $$;

-- ---------- 语音消息存储：进销存自己的语音空间 jxc-voice（只允许音频，单个不超过 2.5 MB）。不改动华宝招聘的图片空间 ----------
do $$ begin
  insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
    values('jxc-voice','jxc-voice',true,2500000,array['audio/webm','audio/ogg','audio/mp4','audio/mpeg','audio/aac','audio/x-m4a','audio/wav'])
    on conflict (id) do update set public=true,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
  drop policy if exists "jxc voice upload" on storage.objects;
  if not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='jxc voice upload') then
    create policy "jxc voice upload" on storage.objects for insert to anon, authenticated
      with check (bucket_id='jxc-voice' and (storage.foldername(name))[1]='a' and lower(storage.extension(name)) in ('webm','ogg','m4a','mp3','aac','wav'));
  end if;
exception when undefined_column or undefined_function then raise notice 'voice bucket skipped (local test db)';
end $$;

-- =====================================================================
-- 最后两步（只做一次，在 SQL Editor 里单独选中运行）：
-- 1) 创建 8 个部门账号（初始密码 111111 / 222222 / 333333 / 444444 / 555555 / 666666 / 777777 / 888888），登录后请立即修改：
--    select jxc_bootstrap();
-- 2) 设置平台密码（用于生成门店开通码、调整门店名额；由软件运营方本人设定，至少 8 位，不要发给任何人）：
--    select jxc_set_platform_pw('你自己设定的平台密码');
-- =====================================================================


-- Persistent FCM device registry and transactional notification queue.
CREATE TABLE IF NOT EXISTS jxc_push_tokens(
  device_token text primary key,user_id text not null references jxc_users(id) on delete cascade,
  updated_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '30 days'
);
CREATE TABLE IF NOT EXISTS jxc_push_events(
  id bigserial primary key,event_key text unique not null,recipients text[] not null,
  body text not null default '您有新的群消息或业务提交，请打开查看',
  created_at timestamptz not null default now(),sent_at timestamptz,last_error text,
  leased_until timestamptz,attempts int not null default 0
);
CREATE TABLE IF NOT EXISTS jxc_push_config(id int primary key check(id=1),endpoint text not null,webhook_secret text not null);
ALTER TABLE jxc_push_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE jxc_push_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE jxc_push_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON jxc_push_tokens,jxc_push_events,jxc_push_config FROM anon,authenticated;
GRANT ALL ON jxc_push_tokens,jxc_push_events,jxc_push_config TO service_role;
GRANT USAGE,SELECT ON SEQUENCE jxc_push_events_id_seq TO service_role;
ALTER TABLE jxc_push_events ADD COLUMN IF NOT EXISTS leased_until timestamptz;
ALTER TABLE jxc_push_events ADD COLUMN IF NOT EXISTS attempts int not null default 0;
CREATE OR REPLACE FUNCTION jxc_claim_push(p_limit int default 10) RETURNS SETOF jxc_push_events
LANGUAGE sql SECURITY DEFINER SET search_path=public,extensions AS $$
  WITH picked AS (SELECT id FROM jxc_push_events WHERE sent_at IS NULL AND (leased_until IS NULL OR leased_until<now()) ORDER BY id LIMIT greatest(1,least(30,p_limit)) FOR UPDATE SKIP LOCKED)
  UPDATE jxc_push_events e SET leased_until=now()+interval '90 seconds',attempts=e.attempts+1 FROM picked WHERE e.id=picked.id RETURNING e.*
$$;
REVOKE ALL ON FUNCTION jxc_claim_push(int) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION jxc_claim_push(int) TO service_role;

CREATE OR REPLACE FUNCTION jxc_register_push(p_token text,p_device_token text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$
DECLARE u jxc_users;
BEGIN
  u:=jxc_me_row(p_token);
  IF length(p_device_token)<30 OR length(p_device_token)>4096 THEN RAISE EXCEPTION 'Invalid device token'; END IF;
  INSERT INTO jxc_push_tokens(device_token,user_id) VALUES(p_device_token,u.id)
  ON CONFLICT(device_token) DO UPDATE SET user_id=u.id,updated_at=now(),expires_at=now()+interval '30 days';
END $$;
CREATE OR REPLACE FUNCTION jxc_unregister_push(p_token text,p_device_token text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$
DECLARE u jxc_users;
BEGIN u:=jxc_me_row(p_token);DELETE FROM jxc_push_tokens WHERE device_token=p_device_token AND user_id=u.id;END $$;

CREATE OR REPLACE FUNCTION jxc_queue_push() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$
DECLARE roles text[]:=ARRAY[]::text[];targets text[];own_id text;st text:=NEW.d->>'status';mem jsonb;
BEGIN
  IF NEW.k='msg' THEN
    IF TG_OP<>'INSERT' OR coalesce((NEW.d->>'rc')::boolean,false) THEN RETURN NEW; END IF;
    IF NEW.d->>'ch'='C_all' THEN mem:=null;
    ELSE
      SELECT d->'mem' INTO mem FROM jxc_docs WHERE k='chat' AND id=NEW.d->>'ch';
      IF mem IS NULL OR jsonb_typeof(mem)<>'array' OR NOT(mem ? (NEW.d->>'by')) THEN RETURN NEW; END IF;
    END IF;
    SELECT array_agg(id) INTO targets FROM jxc_users WHERE active AND id<>coalesce(NEW.d->>'by','') AND (mem IS NULL OR mem ? id);
  ELSE
    IF NEW.k NOT IN ('so','po','grn','counts','fin','exp','att','pr','sr') THEN RETURN NEW; END IF;
    IF TG_OP='UPDATE' AND NEW.d->>'status' IS NOT DISTINCT FROM OLD.d->>'status' THEN RETURN NEW; END IF;
    CASE NEW.k
      WHEN 'so' THEN
        roles:=CASE st WHEN 'submitted' THEN ARRAY['acct','cashier'] WHEN 'credit_gm' THEN ARRAY['gm'] WHEN 'approved' THEN ARRAY['keeper'] ELSE ARRAY[]::text[] END;
        IF st IN ('approved','rejected','shipped') THEN own_id:=NEW.d->>'by';END IF;
      WHEN 'po' THEN IF st='ordered' THEN roles:=ARRAY['buyer','clerk','keeper'];END IF;
      WHEN 'grn' THEN roles:=CASE st WHEN 'submitted' THEN ARRAY['acct'] WHEN 'fin_ok' THEN ARRAY['clerk'] WHEN 'ready' THEN ARRAY['keeper'] ELSE ARRAY[]::text[] END;
        IF st IN ('rejected','done') THEN own_id:=NEW.d->>'by';END IF;
      WHEN 'counts' THEN roles:=CASE st WHEN 'pending' THEN ARRAY['acct'] WHEN 'fin_ok' THEN ARRAY['gm','ops'] ELSE ARRAY[]::text[] END;
      WHEN 'exp' THEN roles:=CASE st WHEN 'submitted' THEN ARRAY['ops'] WHEN 'gm_pending' THEN ARRAY['gm'] WHEN 'approved' THEN ARRAY['acct'] WHEN 'booked' THEN ARRAY['cashier'] ELSE ARRAY[]::text[] END;
        IF st IN ('rejected','paid') THEN own_id:=NEW.d->>'by';END IF;
      WHEN 'fin' THEN IF NEW.d->>'type'='pay' THEN roles:=CASE st WHEN 'req' THEN ARRAY['ops'] WHEN 'gm_pending' THEN ARRAY['gm'] WHEN 'approved' THEN ARRAY['cashier'] WHEN 'rejected' THEN ARRAY['acct'] ELSE ARRAY[]::text[] END;
        ELSIF st='recorded' THEN roles:=ARRAY['acct'];END IF;
      WHEN 'att' THEN roles:=ARRAY['chair','gm','ops'];
      WHEN 'pr' THEN IF st='pending' THEN roles:=ARRAY['keeper'];END IF;
      WHEN 'sr' THEN IF st='pending' THEN roles:=ARRAY['keeper'];END IF;
      ELSE NULL;
    END CASE;
    SELECT array_agg(id) INTO targets FROM jxc_users WHERE active AND id IS DISTINCT FROM NEW.by_user AND (role=ANY(roles) OR id=own_id);
  END IF;
  IF coalesce(array_length(targets,1),0)>0 THEN
    INSERT INTO jxc_push_events(event_key,recipients) VALUES(NEW.k||':'||NEW.id||':'||NEW.seq,targets) ON CONFLICT(event_key) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS jxc_queue_push ON jxc_docs;
CREATE TRIGGER jxc_queue_push AFTER INSERT OR UPDATE ON jxc_docs FOR EACH ROW EXECUTE FUNCTION jxc_queue_push();

-- Run configure_push.sql only after the edge function and its server secrets are installed.
