create table if not exists public.shared_walls (
  id text primary key,
  revision bigint not null check (revision > 0),
  state jsonb not null,
  updated_at timestamptz not null default now()
);
create table if not exists public.shared_wall_versions (
  wall_id text not null references public.shared_walls(id),
  revision bigint not null,
  state jsonb not null,
  updated_at timestamptz not null,
  primary key (wall_id, revision)
);
alter table public.shared_walls enable row level security;
alter table public.shared_wall_versions enable row level security;
revoke all on public.shared_walls, public.shared_wall_versions from anon, authenticated;
grant all on public.shared_walls, public.shared_wall_versions to service_role;
create or replace function public.archive_shared_wall() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.shared_wall_versions(wall_id,revision,state,updated_at)
  values(new.id,new.revision,new.state,new.updated_at);
  return new;
end;
$$;
drop trigger if exists shared_wall_archive on public.shared_walls;
create trigger shared_wall_archive after insert or update on public.shared_walls
for each row execute function public.archive_shared_wall();
