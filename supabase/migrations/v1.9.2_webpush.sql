-- Web Push subscriptions are private; credentials are generated and stored by the server only.
CREATE TABLE IF NOT EXISTS jxc_web_push_keys(id int primary key check(id=1),public_key text not null,private_key text not null);
CREATE TABLE IF NOT EXISTS jxc_web_push_subscriptions(endpoint text primary key,user_id text not null references jxc_users(id) on delete cascade,subscription jsonb not null,expires_at timestamptz not null default now()+interval '90 days');
ALTER TABLE jxc_web_push_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE jxc_web_push_subscriptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON jxc_web_push_keys,jxc_web_push_subscriptions FROM PUBLIC,anon,authenticated;
GRANT ALL ON jxc_web_push_keys,jxc_web_push_subscriptions TO service_role;
CREATE OR REPLACE FUNCTION jxc_web_push_identity(p_token text) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$
DECLARE u jxc_users;BEGIN u:=jxc_me_row(p_token);RETURN u.id;END $$;
CREATE OR REPLACE FUNCTION jxc_register_web_push(p_token text,p_subscription jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$
DECLARE u jxc_users;e text:=p_subscription->>'endpoint';h text;
BEGIN
 u:=jxc_me_row(p_token);
 h:=lower(split_part(split_part(e,'://',2),'/',1));
 IF length(e)>4096 OR e NOT LIKE 'https://%' OR NOT(h='fcm.googleapis.com' OR h='updates.push.services.mozilla.com' OR h='web.push.apple.com' OR h LIKE '%.push.apple.com' OR h LIKE '%.notify.windows.com') OR length(coalesce(p_subscription#>>'{keys,p256dh}','')) NOT BETWEEN 80 AND 100 OR length(coalesce(p_subscription#>>'{keys,auth}','')) NOT BETWEEN 20 AND 30 THEN RAISE EXCEPTION 'Invalid push subscription';END IF;
 INSERT INTO jxc_web_push_subscriptions(endpoint,user_id,subscription) VALUES(e,u.id,p_subscription) ON CONFLICT(endpoint) DO UPDATE SET user_id=u.id,subscription=excluded.subscription,expires_at=now()+interval '90 days';
END $$;
CREATE OR REPLACE FUNCTION jxc_unregister_web_push(p_token text,p_endpoint text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$
DECLARE u jxc_users;BEGIN u:=jxc_me_row(p_token);DELETE FROM jxc_web_push_subscriptions WHERE endpoint=p_endpoint AND user_id=u.id;END $$;
REVOKE ALL ON FUNCTION jxc_web_push_identity(text),jxc_register_web_push(text,jsonb),jxc_unregister_web_push(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION jxc_web_push_identity(text),jxc_register_web_push(text,jsonb),jxc_unregister_web_push(text,text) TO anon,authenticated,service_role;
SELECT 'web_push_schema_ready' AS status;
