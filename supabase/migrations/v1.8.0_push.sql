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
