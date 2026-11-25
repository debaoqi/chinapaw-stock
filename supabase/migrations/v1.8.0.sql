-- v1.8.0: complete upgrade from v1.6/v1.7; run before publishing the client.
BEGIN;
ALTER TABLE jxc_users DROP CONSTRAINT IF EXISTS jxc_users_role_check;
ALTER TABLE jxc_users ADD CONSTRAINT jxc_users_role_check CHECK (role IN ('chair','gm','ops','buyer','sales','field','keeper','acct','cashier','clerk'));
CREATE TABLE IF NOT EXISTS jxc_schema_migrations(version text primary key, applied_at timestamptz default now());
ALTER TABLE jxc_schema_migrations ENABLE ROW LEVEL SECURITY;
-- One-time conversion only: do not convert newly created GMs when rerun.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM jxc_schema_migrations WHERE version='1.8.0-roles') THEN
    UPDATE jxc_users SET role='chair' WHERE role='gm';
    UPDATE jxc_docs SET d=jsonb_set(d,'{positions}',(
      SELECT coalesce(jsonb_agg(CASE WHEN x->>'role'='gm' THEN jsonb_set(x,'{role}','"chair"'::jsonb) ELSE x END),'[]'::jsonb)
      FROM jsonb_array_elements(coalesce(d->'positions','[]'::jsonb)) x
    )),u=(extract(epoch from clock_timestamp())*1000)::bigint,seq=nextval('jxc_seq'),updated_at=now()
    WHERE k='settings' AND id='app' AND jsonb_typeof(d->'positions')='array';
    INSERT INTO jxc_schema_migrations(version) VALUES('1.8.0-roles');
  END IF;
END $$;




create or replace function jxc_role_of(p_code text) returns text language sql immutable as $$
  select case when p_code ~ '^\d{6}(-\d{1,3})?$' then case split_part(p_code,'-',1) when '111111' then 'chair' when '111112' then 'gm' when '222222' then 'buyer' when '333333' then 'sales'
    when '444444' then 'keeper' when '555555' then 'acct' when '666666' then 'cashier' when '777777' then 'field' when '888888' then 'ops' when '999999' then 'clerk' end end $$;

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

-- Unpaid approvals from the old policy return to operations review; preserve their previous state.
UPDATE jxc_docs SET d=d || jsonb_build_object('legacyApproval',d,'status','submitted','u',(extract(epoch from clock_timestamp())*1000)::bigint), u=(extract(epoch from clock_timestamp())*1000)::bigint, seq=nextval('jxc_seq'), updated_at=now()
WHERE k='exp' AND d->>'status' IN ('approved','booked') AND (d->'op'->>'by' IS NULL OR ((d->>'amt')::numeric>2000 AND d->'gm'->>'by' IS NULL));
UPDATE jxc_docs SET d=(d - ARRAY['oby','ot','onote','gby','gt','gnote']) || jsonb_build_object('legacyApproval',d,'status','req','u',(extract(epoch from clock_timestamp())*1000)::bigint), u=(extract(epoch from clock_timestamp())*1000)::bigint, seq=nextval('jxc_seq'), updated_at=now()
WHERE k='fin' AND d->>'type'='pay' AND d->>'status'='approved' AND (d->>'oby' IS NULL OR ((d->>'amount')::numeric>2000 AND d->>'gby' IS NULL));


-- Permit portable PCM WAV alongside native AAC recordings.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES ('jxc-voice','jxc-voice',true,2500000,ARRAY['audio/webm','audio/ogg','audio/mp4','audio/mpeg','audio/aac','audio/x-m4a','audio/wav'])
ON CONFLICT (id) DO UPDATE SET file_size_limit=EXCLUDED.file_size_limit,allowed_mime_types=EXCLUDED.allowed_mime_types;
DROP POLICY IF EXISTS "jxc voice upload" ON storage.objects;
CREATE POLICY "jxc voice upload" ON storage.objects FOR INSERT TO anon,authenticated
WITH CHECK (bucket_id='jxc-voice' AND (storage.foldername(name))[1]='a' AND lower(storage.extension(name)) IN ('webm','ogg','m4a','mp3','aac','wav'));


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

COMMIT;
