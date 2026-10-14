# Deploy de "rest" — Plug & Play

El mismo paquete corre igual en **esta máquina (WSL), la caja 24/7 o un VPS alquilado**. Solo cambian el `.env` y, si quieres dominio público, el túnel de Cloudflare.

```
┌─ docker-compose.prod.yml (proyecto: rest-prod) ──────────────────────────┐
│  db (postgres 16, sin puertos al host)                                   │
│  migrate (one-shot: schema + RLS + seed opcional)                        │
│  web :3000 · pos :3001 · kds :3002 · menu :3003   (misma imagen)         │
│  caddy (LAN/debug, puertos altos 8080/8443)                              │
│  cloudflared (opcional, --profile tunnel → dominio público real)         │
└──────────────────────────────────────────────────────────────────────────┘
```

**No choca con otros stacks** (odontoflow, gimnasio…): red/contenedores/volúmenes con prefijo `rest-prod`, la DB no publica puertos, y Caddy usa puertos altos configurables — los 80/443 del host quedan libres.

## 1. Requisitos (una sola vez por máquina)

- **Linux/VPS:** Docker Engine + plugin compose. Listo.
- **Windows con WSL:** Ubuntu con Docker dentro (patrón OdontoFlow): `wsl -d Ubuntu` → instalar docker-ce + `systemctl enable docker`. El script del paso 5 se encarga de systemd.

## 2. Configurar

```bash
cp deploy/.env.prod.example .env
# editar: POSTGRES_PASSWORD, AUTH_SECRET, NEXT_PUBLIC_ORG_SLUG, dominios…
```

Variables clave (todas en `.env`, nada hardcodeado):

| Variable | Qué hace |
|---|---|
| `POSTGRES_PASSWORD`, `AUTH_SECRET` | credenciales — genera aleatorios en cada máquina |
| `NEXT_PUBLIC_API_URL` | URL pública del panel/API que hornean pos/kds/carta al compilar |
| `NEXT_PUBLIC_ORG_SLUG` | slug del restaurante (header `X-Org-Slug` de las PWA) |
| `ALLOWED_ORIGINS` | CORS del API para los dominios de las PWA |
| `DEMO_SEED` | `true` = arranca con la Cevichería demo · `false` = DB vacía, a operar |
| `COOKIE_SECURE` | `true` cuando el acceso sea HTTPS real (túnel/dominio) |
| `REST_HTTP_PORT`/`REST_HTTPS_PORT` | puertos del Caddy en modo LAN (8080/8443 por defecto) |

> ⚠️ `NEXT_PUBLIC_*` se hornean en build: si los cambias, re-ejecuta `build` (paso 3) y `up -d`.

## 3. Levantar

```bash
docker compose -f docker-compose.prod.yml build   # 1ª vez / tras cambiar código o NEXT_PUBLIC_*
docker compose -f docker-compose.prod.yml up -d   # migra + arranca todo
docker compose -f docker-compose.prod.yml logs -f migrate web   # ver el arranque
```

El servicio `migrate` aplica schema + RLS (idempotente: re-ejecutar no rompe) y, si `DEMO_SEED=true` y no hay organizaciones, siembra la demo (`maria@cevicheriaelmuelle.pe / demo1234`). Con `DEMO_SEED=false` la DB queda **vacía y operativa**: entra a `/signup`, registra el restaurante y queda creada la organización con local y catálogo inicial.

## 4. Verificar que todo vive

```bash
docker compose -f docker-compose.prod.yml ps        # todos "running", migrate "exited (0)"
curl -H "Host: api.localhost"  http://localhost:8080/api/orders -H "X-Org-Slug: TU_SLUG"
```

- Panel: `http://localhost:8080` (Host `api.localhost`) — o por HTTPS `https://localhost:8443` aceptando el certificado interno.
- Modo LAN con tablets: apunta los `*_DOMAIN` de tu `.env` a nombres y agrégalos al `/etc/hosts` de cada equipo, **o** mejor usa el túnel (paso siguiente).

## 5. Dominio público real (recomendado para tablets)

El túnel de Cloudflare no ocupa puertos del host (convive con odontoflow) y da HTTPS real — requisito del service worker y del Bluetooth de la impresora:

```bash
# 1) En el dashboard de Cloudflare: Zero Trust → Tunnels → Create tunnel → copia el token
# 2) Pónlo en .env (CLOUDFLARE_TUNNEL_TOKEN) y:
docker compose -f docker-compose.prod.yml --profile tunnel up -d
# 3) En el dashboard, mapea los 4 hostnames (HTTP, NO HTTPS):
#    api.TUDOMINIO  → http://web:3000
#    pos.TUDOMINIO  → http://pos:3001
#    kds.TUDOMINIO  → http://kds:3002
#    carta.TUDOMINIO → http://menu:3003
# 4) .env: NEXT_PUBLIC_API_URL=https://api.TUDOMINIO, ALLOWED_ORIGINS con los 3 dominios
#    de PWA, COOKIE_SECURE=true → rebuild + up -d
```

Las tablets instalan las PWA desde el navegador (menú → "Añadir a pantalla de inicio") ya con HTTPS válido.

## 6. Que no se apague con la máquina (patrón OdontoFlow)

WSL se apaga al cerrar la última sesión y mata dockerd/contenedores. El fix (tarea programada + sesión WSL oculta auto-reparable cada minuto):

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File deploy\scripts\configurar-keepalive-wsl.ps1
```

Solo asegura que WSL y dockerd vivan: **levanta únicamente los contenedores `restart: unless-stopped` de rest-prod** — los demás stacks dependen de sus propias políticas y este script no los toca. En un VPS Linux esto no hace falta (`systemctl enable docker` + `restart: unless-stopped` alcanza).

## 7. Operación diaria

```bash
# Actualizar código y redeployar
git pull && docker compose -f docker-compose.prod.yml build && docker compose -f docker-compose.prod.yml up -d

# Backup de la DB (programar en cron/Tarea programada)
docker exec rest-prod-db pg_dump -U rest rest > backup-$(date +%F).sql

# Restaurar
cat backup-2026-09-12.sql | docker exec -i rest-prod-db psql -U rest -d rest

# Ver logs / reiniciar un servicio
docker compose -f docker-compose.prod.yml logs -f web
docker compose -f docker-compose.prod.yml restart pos
```

## 8. Troubleshooting

| Síntoma | Causa probable | Fix |
|---|---|---|
| Contenedores mueren al cerrar sesión | keepalive no instalado | paso 6 |
| Las PWA no llegan al API | `NEXT_PUBLIC_API_URL` horneado viejo | cambiar `.env` → `build` → `up -d` |
| CORS bloquea una PWA | falta el origen en `ALLOWED_ORIGINS` | añadirlo a `.env` → `up -d` (recreate web) |
| Login no pega la cookie | acceso por HTTPS con `COOKIE_SECURE=false` | `true` en `.env` → `up -d` |
| Puerto 8080/8443 ocupado | otro stack lo usa | cambiar `REST_*_PORT` en `.env` → `up -d caddy` |
| "530/502" desde internet | túnel caído | `logs cloudflared` · token vencido |
| Quiero resetear todo | — | `down -v` **borra la DB** (¡backup antes!) |
