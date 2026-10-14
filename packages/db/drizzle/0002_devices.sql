-- Dispositivos provisionados por el superadmin (tablets POS/KDS/carta).
-- Reemplaza la auth de demo por header X-Org-Slug cuando DEVICE_AUTH=true:
-- cada tablet presenta X-Device-Token; el API resuelve tenant+dispositivo.
create table if not exists devices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  kind text not null default 'pos',
  token_hash text not null,
  last_seen_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists devices_org_idx on devices (organization_id);
create index if not exists devices_token_idx on devices (token_hash);
