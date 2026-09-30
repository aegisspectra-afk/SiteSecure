-- Cold archive schema (created operationally) + admin read views for service_role.
create schema if not exists archive;

revoke all on schema archive from public, anon, authenticated;
grant usage on schema archive to postgres, service_role;

create table if not exists archive.workspace_index (
  id uuid primary key,
  name text not null,
  archived_at timestamptz not null default now(),
  archive_batch text not null,
  note text
);

create table if not exists archive.profile_snapshots (
  id uuid primary key,
  email text,
  full_name text,
  recognition_badges jsonb,
  is_platform_admin boolean,
  created_at timestamptz,
  snapshot jsonb not null,
  archived_at timestamptz not null default now(),
  archive_batch text not null
);

create index if not exists archive_workspace_index_batch_idx on archive.workspace_index (archive_batch);
create index if not exists archive_profile_snapshots_batch_idx on archive.profile_snapshots (archive_batch);
create index if not exists archive_profile_snapshots_email_idx on archive.profile_snapshots (email);

create or replace view public.archive_workspaces
with (security_invoker = true) as
select
  id,
  name,
  archived_at,
  archive_batch,
  note
from archive.workspace_index;

create or replace view public.archive_profiles
with (security_invoker = true) as
select
  id,
  email,
  full_name,
  recognition_badges,
  is_platform_admin,
  created_at,
  snapshot,
  archived_at,
  archive_batch
from archive.profile_snapshots;

revoke all on public.archive_workspaces from public, anon, authenticated;
revoke all on public.archive_profiles from public, anon, authenticated;
grant select on public.archive_workspaces to service_role;
grant select on public.archive_profiles to service_role;
grant select on archive.workspace_index to service_role;
grant select on archive.profile_snapshots to service_role;

create or replace function public.archive_consume_profile(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = archive, public
as $$
declare
  deleted_count integer;
begin
  delete from archive.profile_snapshots where id = p_id;
  get diagnostics deleted_count = row_count;
  return deleted_count > 0;
end;
$$;

revoke all on function public.archive_consume_profile(uuid) from public, anon, authenticated;
grant execute on function public.archive_consume_profile(uuid) to service_role;
