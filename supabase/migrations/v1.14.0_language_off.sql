-- User canceled OpenAI and Azure language integration. No paid provider is enabled.
begin;
update jxc_language_settings set enabled=false where id;
do $$begin if to_regclass('public.jxc_azure_settings') is not null then execute 'update jxc_azure_settings set enabled=false where id';end if;end $$;
commit;
