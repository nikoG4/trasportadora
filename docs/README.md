# Sistema Transportadora Paraguay

Documentacion unica del proyecto. Este archivo reemplaza las guias sueltas anteriores y concentra arquitectura, modulos, desarrollo, despliegue, seguridad y pruebas.

## Resumen

Sistema SaaS multi-tenant para transportadoras de cargas en Paraguay. Cubre operacion logistica, finanzas, caja, RRHH, flota, choferes, GPS, app movil de choferes, configuracion SaaS y auditoria.

## Estructura

```text
trasportadora/
├── backend/       API REST Node.js + Express + TypeScript
├── frontend/      Backoffice React + Vite
├── app-chofer/    App chofer React + Capacitor Android
├── landing-saas/  Landing, registro y login SaaS
├── e2e-tests/     Pruebas Playwright
├── tools/tests/   Pruebas estaticas y tenant isolation
├── deploy/        Ejemplos y scripts de despliegue
└── docs/          Esta documentacion
```

## Stack

- Backend: Node.js, Express, TypeScript, JWT, bcrypt, SQLite local y capa PostgreSQL/Supabase para produccion.
- Frontend: React 19, Vite, TypeScript, React Router, Lucide React, Leaflet.
- App chofer: React 19, Vite, Capacitor Android, Camera, Geolocation, plugins nativos propios.
- Infra: Docker, Cloud Build, Cloud Run, Artifact Registry, Google Cloud Storage opcional.

## Modulos

### Autenticacion y Tenant

- Login admin y login chofer con JWT y refresh token.
- Roles: `superadmin_saas`, `admin_empresa`, `operador`, `financiero`, `rrhh`, `despachante`, `chofer`, `cliente_portal`.
- Cada dato operativo usa `tenant_id`.
- Los endpoints `/api/*` productivos requieren autenticacion, salvo login, refresh, rutas publicas y actualizaciones publicas de app.
- `superadmin_saas` puede operar cross-tenant; usuarios de empresa solo ven su tenant.

### Operaciones

- Pedidos
- Viajes
- Reparto local
- Monitoreo GPS
- Gestion integral: proveedores, compras, mantenimientos, incidencias, inventario, tarifarios y contratos

### Finanzas y Caja

- Caja del dia
- Viaticos y rendiciones
- Cuentas corrientes
- Ingresos y facturacion
- Reportes financieros

### Catalogos y Administracion

- Clientes
- Flota
- Choferes
- Sucursales
- RRHH
- Usuarios y roles
- Auditoria
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

Vehiculos:

- `disponible`
- `en_viaje`
- `mantenimiento`
- `fuera_de_servicio`

## API Principal

Autenticacion:

- `POST /api/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/me`

Operacion:

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

Gestion y administracion:

- `GET/POST /api/rrhh/*`
- `GET/POST /api/gestion/*`
- `GET/PUT /api/configuracion`
- `GET/POST /api/alertas`
- `GET/POST /api/reglas`
- `GET /api/auditoria`
- `GET/POST /api/app-updates/*`

## Desarrollo

Instalar dependencias raiz:

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

Pruebas estaticas y regresiones de frontend:

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

La prueba `test:tenant` crea tenants nuevos, valida que una cuenta nueva no vea datos del tenant demo y revisa modulos operativos, finanzas, dashboard, GPS, usuarios, reportes y app chofer.

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

Usar `backend/.env.example` y `deploy/env.example` como base.

## Base de Datos

- Desarrollo: SQLite en `backend/transportadora.db`.
- Produccion: la capa PostgreSQL/Supabase esta preparada; completar migracion y validar `DATABASE_URL` antes de operar clientes reales.
- Las tablas operativas deben incluir `tenant_id`.
- Toda consulta list/detail/update/delete debe filtrar por `tenant_id` salvo rutas explicitas de superadmin.

## Despliegue GCloud

Servicio existente:

- Proyecto: `project-c603f2e8-0d5d-451f-ade`
- Region: `us-central1`
- Servicio Cloud Run: `transportadora`
- URL: `https://transportadora-754837345818.us-central1.run.app`

Deploy usado actualmente:

```powershell
& 'C:\Users\ll\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd' builds submit --project=project-c603f2e8-0d5d-451f-ade --config cloudbuild.yaml
```

El `cloudbuild.yaml` construye frontend, app chofer web, landing y backend, publica imagen en Artifact Registry y despliega Cloud Run.

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
- Navegacion externa con Google Maps/Waze.
- Impresion Bluetooth termica.
- Soporte OTA desde el modulo App Chofer OTA.

## Seguridad

- No commitear `.env`, secretos, service accounts, builds, APKs generados ni carpetas `node_modules`.
- No aceptar datos cross-tenant por ids externos sin validar pertenencia con `tenant_id`.
- Registrar acciones sensibles en auditoria.
- Usar refresh tokens para sesiones largas.
- Revisar rutas nuevas con `npm run test:tenant`.

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

## Roadmap Tecnico Corto

- Completar migracion PostgreSQL productiva.
- Agregar pruebas API por endpoint para cada modulo tenant.
- Code splitting del frontend para reducir bundle.
- Formalizar generacion y publicacion de APK/OTA en scripts versionados.
- Convertir reportes financieros a endpoints agregados dedicados por chofer, vehiculo y aging real.
