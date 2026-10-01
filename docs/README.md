# Sistema Transportadora Paraguay

Documentación única del proyecto. Este archivo reemplaza las guías sueltas anteriores y concentra arquitectura, módulos, desarrollo, despliegue, seguridad y pruebas.

## Resumen

Sistema SaaS multi-tenant para transportadoras de cargas en Paraguay. Cubre operación logística, finanzas, caja, RRHH, flota, choferes, GPS, app móvil de choferes, configuración SaaS y auditoría.

## Estructura

```text
trasportadora/
├── backend/       API REST Node.js + Express + TypeScript
├── frontend/      Backoffice React + Vite
├── app-chofer/    App chofer React + Capacitor Android
├── landing-saas/  Landing, registro y login SaaS
├── e2e-tests/     Pruebas Playwright
├── tools/tests/   Pruebas estáticas y tenant isolation
├── deploy/        Ejemplos y scripts de despliegue
└── docs/          Esta documentación
```

## Stack

- Backend: Node.js, Express, TypeScript, JWT, bcrypt, SQLite local y capa PostgreSQL/Supabase para producción.
- Frontend: React 19, Vite, TypeScript, React Router, Lucide React, Leaflet.
- App chofer: React 19, Vite, Capacitor Android, Camera, Geolocation, plugins nativos propios.
- Infra: Docker, Cloud Build, Cloud Run, Artifact Registry, Google Cloud Storage opcional.

## Módulos

### Autenticación y Tenant

- Login admin y login chofer con JWT y refresh token.
- Roles: `superadmin_saas`, `admin_empresa`, `operador`, `financiero`, `rrhh`, `despachante`, `chofer`, `cliente_portal`.
- Cada dato operativo usa `tenant_id`.
- Los endpoints `/api/*` productivos requieren autenticación, salvo login, refresh, rutas públicas y actualizaciones públicas de app.
- `superadmin_saas` puede operar cross-tenant; usuarios de empresa solo ven su tenant.

### Operaciones

- Pedidos
- Viajes
- Reparto local
- Monitoreo GPS
- Gestión integral: proveedores, compras, mantenimientos, incidencias, inventario, tarifarios y contratos

### Finanzas y Caja

- Caja del día
- Viáticos y rendiciones
- Cuentas corrientes
- Ingresos y facturación
- Reportes financieros

### Catálogos y Administración

- Clientes
- Flota
- Choferes
- Sucursales
- RRHH
- Usuarios y roles
- Auditoría
- App Chofer OTA
- SaaS Config

## Estados Principales

Pedidos:

- `borrador`
- `pendiente_planificacion`
- `planificado`
- `asignado`
- `en_retiro`
- `en_transito`
- `en_entrega`
- `entregado`
- `entregado_con_novedad`
- `cancelado`

Viajes:

- `planificado`
- `cargando`
- `en_ruta`
- `arribado`
- `finalizado`
- `cancelado`

Vehículos:

- `disponible`
- `en_viaje`
- `mantenimiento`
- `fuera_de_servicio`

## API Principal

Autenticación:

- `POST /api/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/me`

Operación:

- `GET/POST /api/clientes`
- `GET/POST /api/choferes`
- `GET/POST /api/vehiculos`
- `GET/POST /api/sucursales`
- `GET/POST /api/pedidos`
- `GET/POST /api/viajes`
- `GET /api/reparto-local/candidatos`
- `GET/POST /api/reparto-local/viajes`
- `POST /api/tracking`
- `GET /api/tracking/latest`

Finanzas:

- `GET/POST /api/caja/movimientos`
- `GET/POST /api/caja/rendiciones`
- `GET/POST /api/caja/gastos`
- `GET /api/cuentas-corrientes`
- `GET /api/clientes/:id/ledger`
- `POST /api/pagos`
- `POST /api/facturas`
- `GET /api/reportes/rentabilidad`

Gestión y administración:

- `GET/POST /api/rrhh/*`
- `GET/POST /api/gestion/*`
- `GET/PUT /api/configuracion`
- `GET/POST /api/alertas`
- `GET/POST /api/reglas`
- `GET /api/auditoria`
- `GET/POST /api/app-updates/*`

## Desarrollo

Instalar dependencias raíz:

```bash
npm install
```

Instalar dependencias por app cuando sea necesario:

```bash
cd backend && npm install
cd ../frontend && npm install
cd ../app-chofer && npm install
cd ../landing-saas && npm install
```

Levantar todo:

```bash
npm run dev:all
```

Levantar por separado:

```bash
npm run dev:backend
npm run dev:frontend
npm run dev:chofer
npm run dev:landing
```

Build completo:

```bash
npm run build:all
```

## Pruebas

Pruebas estáticas y regresiones de frontend:

```bash
npm run test:features
```

Prueba end-to-end de aislamiento tenant:

```bash
npm run test:tenant
```

Pruebas Playwright:

```bash
npm run test:e2e
```

La prueba `test:tenant` crea tenants nuevos, valida que una cuenta nueva no vea datos del tenant demo y revisa módulos operativos, finanzas, dashboard, GPS, usuarios, reportes y app chofer.

## Variables Backend

Variables frecuentes:

- `PORT`
- `JWT_SECRET`
- `REFRESH_TOKEN_SECRET`
- `JWT_EXPIRES_IN`
- `CORS_ORIGIN`
- `DATABASE_URL`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GCS_BUCKET`

Usar `backend/.env.example` y `deploy/env.example` como base. Los ejemplos deben contener solo placeholders o valores ficticios.

## Base de Datos

- Desarrollo: SQLite en `backend/transportadora.db`.
- Producción: la capa PostgreSQL/Supabase está preparada; completar migración y validar `DATABASE_URL` antes de operar clientes reales.
- Las tablas operativas deben incluir `tenant_id`.
- Toda consulta list/detail/update/delete debe filtrar por `tenant_id` salvo rutas explícitas de superadmin.

## Despliegue en Google Cloud

El proyecto incluye configuración para construir y desplegar con Cloud Build y Cloud Run. Los identificadores concretos de proyecto, servicio, cuenta y URLs administrativas deben mantenerse fuera de la documentación pública.

Flujo genérico:

```bash
gcloud builds submit --project=<GCP_PROJECT_ID> --config cloudbuild.yaml
```

`cloudbuild.yaml` construye frontend, app chofer web, landing y backend, publica la imagen en Artifact Registry y despliega Cloud Run según la configuración del entorno.

## App Chofer

Desarrollo web:

```bash
cd app-chofer
npm run dev
```

Build web:

```bash
cd app-chofer
npm run build
```

Sincronizar Android:

```bash
cd app-chofer
npx cap sync android
```

La app incluye:

- GPS en segundo plano.
- Cola offline para tracking y eventos.
- Reparto local.
- Navegación externa con Google Maps/Waze.
- Impresión Bluetooth térmica.
- Soporte OTA desde el módulo App Chofer OTA.

## Seguridad

- No commitear `.env`, secretos, service accounts, builds, APKs generados ni carpetas `node_modules`.
- No aceptar datos cross-tenant por ids externos sin validar pertenencia con `tenant_id`.
- Registrar acciones sensibles en auditoría.
- Usar refresh tokens para sesiones largas.
- Revisar rutas nuevas con `npm run test:tenant`.
- Mantener IDs de proyectos cloud, endpoints administrativos y detalles operativos internos fuera de archivos públicos cuando no sean necesarios para usar el proyecto.

## Limpieza del Repositorio

Se consideran artefactos locales y no deben versionarse:

- `node_modules/`
- `dist/`
- `build/`
- `.vite/`
- `.app-chofer-vite.pid`
- `*.log`
- `*.apk`; si se publica un APK desde `backend/downloads/`, queda como artefacto local incluido por `.gcloudignore`, no como archivo versionado.
- `apk_posprinter_extract/`
- `apk_posprinter_jadx/`
- `manual_pages/`
- `posprinter_strings.txt`
- `manual_tdr058bt_text.txt`
- `backend/uploads/`

## Roadmap Técnico Corto

- Completar migración PostgreSQL productiva.
- Agregar pruebas API por endpoint para cada módulo tenant.
- Code splitting del frontend para reducir bundle.
- Formalizar generación y publicación de APK/OTA en scripts versionados.
- Convertir reportes financieros a endpoints agregados dedicados por chofer, vehículo y aging real.
