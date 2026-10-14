-- Plataforma: rol superadmin + estado de tenant + auditoría.
-- Idempotente: el migrador (packages/db/scripts/migrate.ts) la aplica una vez,
-- pero los statements usan IF NOT EXISTS por seguridad.
alter table organizations add column if not exists status text not null default 'active';
alter table users add column if not exists platform_role text;
create table if not exists platform_audit (
  id uuid primary key default gen_random_uuid(),
  actor_email text not null,
  action text not null,
  target_type text not null,
  target_id text,
  meta jsonb,
  created_at timestamptz not null default now()
);
create index if not exists platform_audit_created_idx on platform_audit (created_at desc);
