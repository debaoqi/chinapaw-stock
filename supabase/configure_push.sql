-- Server deployment: generates a random shared secret once; keeps it on rerun.
-- Set PUSH_WEBHOOK_SECRET to the generated value using the private dashboard.
-- Replace REPLACE_WITH_PUBLIC_ANON_KEY with the existing public anon JWT.
-- The SAME value must be set as the edge function's PUSH_WEBHOOK_SECRET.
-- Firebase service-account JSON belongs ONLY in edge-function secret FCM_SERVICE_ACCOUNT.
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
ALTER TABLE jxc_push_config ADD COLUMN IF NOT EXISTS gateway_anon_key text;
INSERT INTO jxc_push_config(id,endpoint,webhook_secret,gateway_anon_key)
VALUES(1,'https://vctokfjzgjtvsqftadeh.supabase.co/functions/v1/jxc-push',encode(gen_random_bytes(32),'hex'),'REPLACE_WITH_PUBLIC_ANON_KEY')
ON CONFLICT(id) DO UPDATE SET endpoint=excluded.endpoint,gateway_anon_key=excluded.gateway_anon_key;

CREATE OR REPLACE FUNCTION jxc_kick_push() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$
DECLARE c jxc_push_config;
BEGIN
  SELECT * INTO c FROM jxc_push_config WHERE id=1;
  IF c.endpoint IS NULL OR c.webhook_secret IS NULL OR c.gateway_anon_key IS NULL OR c.gateway_anon_key LIKE 'REPLACE_%' THEN RETURN;END IF;
  IF NOT EXISTS(SELECT 1 FROM jxc_push_events WHERE sent_at IS NULL) THEN RETURN;END IF;
  PERFORM net.http_post(url:=c.endpoint,body:='{}'::jsonb,headers:=jsonb_build_object('Content-Type','application/json','x-jxc-push-secret',c.webhook_secret,'Authorization','Bearer '||c.gateway_anon_key,'apikey',c.gateway_anon_key),timeout_milliseconds:=30000);
END $$;
REVOKE ALL ON FUNCTION jxc_kick_push() FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION jxc_kick_push_trigger() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$
BEGIN PERFORM jxc_kick_push();RETURN NEW;
EXCEPTION WHEN OTHERS THEN RAISE WARNING 'Push dispatcher unavailable; event retained for retry';RETURN NEW;END $$;
DROP TRIGGER IF EXISTS jxc_dispatch_push ON jxc_push_events;
CREATE TRIGGER jxc_dispatch_push AFTER INSERT ON jxc_push_events FOR EACH ROW EXECUTE FUNCTION jxc_kick_push_trigger();
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM cron.job WHERE jobname='jxc-push-retry') THEN
    PERFORM cron.schedule('jxc-push-retry','* * * * *','SELECT public.jxc_kick_push();');
  END IF;
END $$;
SELECT jxc_kick_push();
