begin;
create table if not exists public.notion_sync_events (
  seq bigint generated always as identity primary key,
  event_id text not null unique,
  page_id text not null,
  kind text not null,
  occurred_at timestamptz not null,
  payload jsonb not null,
  received_at timestamptz not null default now()
);
create table if not exists public.notion_sync_snapshots (
  project_id text primary key,
  checkpoint bigint not null default 0,
  state jsonb not null,
  updated_at timestamptz not null default now()
);
create table if not exists public.notion_sync_settings (
  key text primary key,
  value text not null
);
alter table public.notion_sync_events enable row level security;
alter table public.notion_sync_snapshots enable row level security;
alter table public.notion_sync_settings enable row level security;
revoke all on public.notion_sync_events, public.notion_sync_snapshots, public.notion_sync_settings from anon, authenticated;
grant all on public.notion_sync_events, public.notion_sync_snapshots, public.notion_sync_settings to service_role;
grant usage, select on sequence public.notion_sync_events_seq_seq to service_role;
-- Serialize event allocation and watermark reads through transaction commit.
-- An event whose transaction has not committed cannot be skipped by a checkpoint.
create or replace function public.record_notion_sync_event(event jsonb)
returns void language plpgsql security invoker set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtext('notion-sync-events'));
  insert into public.notion_sync_events(event_id, page_id, kind, occurred_at, payload)
  values(event->>'event_id', event->>'page_id', event->>'kind', (event->>'occurred_at')::timestamptz, event->'payload')
  on conflict(event_id) do nothing;
end;
$$;
create or replace function public.notion_sync_watermark()
returns bigint language plpgsql security invoker set search_path = public as $$
declare watermark bigint;
begin
  perform pg_advisory_xact_lock(hashtext('notion-sync-events'));
  select coalesce(max(seq), 0) into watermark from public.notion_sync_events;
  return watermark;
end;
$$;
revoke all on function public.record_notion_sync_event(jsonb), public.notion_sync_watermark() from public, anon, authenticated;
grant execute on function public.record_notion_sync_event(jsonb), public.notion_sync_watermark() to service_role;
commit;
