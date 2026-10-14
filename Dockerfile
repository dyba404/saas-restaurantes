# Imagen única del monorepo "rest": construye las 4 apps Next.js + el bundle
# de migración. Cada servicio del compose arranca la MISMA imagen con distinto
# comando (next start del app que le toca). Sin standalone: robustez > tamaño.
FROM node:24-alpine

# next/swc en alpine necesita compat glibc
RUN apk add --no-cache libc6-compat

WORKDIR /app

# 1) Dependencias (lockfile determinista). Copia explícita por workspace:
#    los globs de archivos aplanan rutas y romperían npm ci.
COPY package.json package-lock.json turbo.json tsconfig.base.json ./
COPY apps/web-admin/package.json apps/web-admin/package.json
COPY apps/pos/package.json apps/pos/package.json
COPY apps/kds/package.json apps/kds/package.json
COPY apps/menu/package.json apps/menu/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/sync/package.json packages/sync/package.json
COPY packages/printer/package.json packages/printer/package.json
COPY packages/ui/package.json packages/ui/package.json
RUN npm ci --no-audit --no-fund

# 2) Migraciones SQL del paquete db (las necesita el bundle del migrador)
COPY packages/db/drizzle packages/db/drizzle

# 3) Código fuente
COPY apps ./apps
COPY packages ./packages

# 3) NEXT_PUBLIC_* se inlinean EN BUILD (pos/kds/carta quedan apuntando a la API
#    y al slug del restaurante). Cámbialos en .env y re-ejecuta `docker compose build`.
ARG NEXT_PUBLIC_API_URL=http://localhost:3000
ARG NEXT_PUBLIC_ORG_SLUG=cevicheria-el-muelle
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_ORG_SLUG=$NEXT_PUBLIC_ORG_SLUG \
    NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# 4) Bundle del migrador (packages/db/scripts/migrate.ts → deploy/migrate.mjs).
#    Externos: los resolve node_modules en runtime (ya están en la imagen).
RUN ./node_modules/.bin/esbuild packages/db/scripts/migrate.ts \
      --bundle --platform=node --format=esm \
      --external:drizzle-orm --external:postgres --external:@electric-sql/pglite \
      --outfile=deploy/migrate.mjs

# CMD por defecto: panel web-admin. El compose pasa `command` por servicio.
EXPOSE 3000
CMD ["sh", "-c", "cd apps/web-admin && ../../node_modules/.bin/next start -H 0.0.0.0 -p 3000"]
