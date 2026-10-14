-- 0000_rls.sql — Aislamiento multi-tenant con Row Level Security.
-- Ver docs/03-arquitectura.md §Multi-tenancy.
--
-- Estrategia: la app ejecuta cada query de dominio dentro de una transacción con
--   SELECT set_config('app.tenant_id', '<uuid>', true);
--   SET LOCAL ROLE app_runtime;
-- `app_runtime` NO es superuser ni dueño de las tablas → RLS se aplica siempre.
-- Sin tenant_id → 0 filas (fail-closed).
-- Las tablas de auth (users, organizations) no llevan RLS: el login necesita
-- buscar por email antes de conocer el tenant; el acceso se resuelve por membresía.

-- ═══ Rol de runtime (no superuser → RLS obligatorio) ═══════════════════════

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_runtime') THEN
    CREATE ROLE app_runtime NOLOGIN;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_runtime;

-- ═══ Tablas con organization_id directo ═══════════════════════════════════

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'locations', 'categories', 'products', 'modifier_groups', 'orders',
    'payments', 'sync_events', 'reservations', 'customers', 'audit_log'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I
       USING (organization_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid)
       WITH CHECK (organization_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid)',
      t
    );
  END LOOP;
END $$;

-- ═══ Tablas anidadas bajo location ═════════════════════════════════════════
-- staff, dining_tables: aisladas vía location.organization_id

ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON staff;
CREATE POLICY tenant_isolation ON staff
  USING (location_id IN (
    SELECT id FROM locations
    WHERE organization_id = current_setting('app.tenant_id', true)::uuid
  ));

ALTER TABLE dining_tables ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON dining_tables;
CREATE POLICY tenant_isolation ON dining_tables
  USING (location_id IN (
    SELECT id FROM locations
    WHERE organization_id = current_setting('app.tenant_id', true)::uuid
  ));

-- ═══ Tablas anidadas bajo order ════════════════════════════════════════════
-- order_items: aisladas vía order.organization_id

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON order_items;
CREATE POLICY tenant_isolation ON order_items
  USING (order_id IN (
    SELECT id FROM orders
    WHERE organization_id = current_setting('app.tenant_id', true)::uuid
  ));

-- ═══ Membresías: un usuario ve solo sus organizaciones (app-side via app.user_id) ══

ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS member_access ON memberships;
CREATE POLICY member_access ON memberships
  USING (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid);
