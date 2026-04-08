-- Security hardening for threadbot-ieumnarae Supabase project.
-- Intended to resolve Security Advisor issues such as:
-- - rls_disabled_in_public
-- - sensitive_columns_exposed (if triggered in the future)
--
-- This app reads/writes data from server-side routes using the service role key.
-- Browser-side Supabase usage is limited to auth/session flows.

alter table if exists public.sources enable row level security;
alter table if exists public.app_settings enable row level security;
alter table if exists public.signals enable row level security;
alter table if exists public.drafts enable row level security;
alter table if exists public.posts enable row level security;
alter table if exists public.cron_runs enable row level security;

revoke all on table public.sources from anon, authenticated;
revoke all on table public.app_settings from anon, authenticated;
revoke all on table public.signals from anon, authenticated;
revoke all on table public.drafts from anon, authenticated;
revoke all on table public.posts from anon, authenticated;
revoke all on table public.cron_runs from anon, authenticated;

create or replace function public.rls_auto_enable()
returns event_trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  cmd record;
begin
  for cmd in
    select *
    from pg_event_trigger_ddl_commands()
    where command_tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      and object_type in ('table', 'partitioned table')
  loop
    if cmd.schema_name = 'public' then
      begin
        execute format(
          'alter table if exists %s enable row level security',
          cmd.object_identity
        );
        raise log 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      exception
        when others then
          raise log 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      end;
    end if;
  end loop;
end;
$$;

drop event trigger if exists ensure_rls;

create event trigger ensure_rls
on ddl_command_end
when tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
execute function public.rls_auto_enable();
