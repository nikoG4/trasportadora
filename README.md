# Sistema Transportadora

Sistema SaaS multi-tenant para **paquetería, cargas y logística**, con backoffice web, app para choferes, tracking GPS, módulos financieros y herramientas de administración de flota y operación.

El proyecto está pensado como una plataforma integral: desde el alta de pedidos y planificación de viajes hasta seguimiento, caja, rendiciones, mantenimiento, RRHH, auditoría y operación móvil del chofer.

> **Estado:** MVP avanzado en desarrollo. El entorno local utiliza SQLite y la arquitectura productiva contempla PostgreSQL/Supabase y despliegue en Google Cloud Run.

## Funcionalidades principales

### Operación logística

- Pedidos y planificación.
- Viajes y asignación de chofer/vehículo.
- Reparto local.
- Tracking GPS.
- Gestión de proveedores y compras.
- Mantenimientos e incidencias.
- Inventario, tarifarios y contratos.

### Finanzas

- Caja del día.
- Viáticos y rendiciones.
- Cuentas corrientes.
- Pagos e ingresos.
- Facturación.
- Reportes financieros y de rentabilidad.

### Administración

- Clientes.
- Flota.
- Choferes.
- Sucursales.
- RRHH.
- Usuarios, roles y permisos.
- Auditoría.
- Configuración SaaS.
- Gestión de actualizaciones de la app de choferes.

### App de choferes

- Geolocalización y tracking en segundo plano.
- Cola offline para eventos y posiciones.
- Reparto local.
- Navegación externa con Google Maps/Waze.
- Cámara/geolocalización mediante Capacitor.
- Impresión Bluetooth térmica.
- Actualizaciones OTA administradas desde el sistema.

## Stack

### Backend

- Node.js
- Express
- TypeScript
- JWT + refresh tokens
- bcrypt
- SQLite para desarrollo
- PostgreSQL/Supabase preparado para producción

### Frontend

- React 19
- Vite
- TypeScript
- React Router
- Leaflet
- Lucide React

### App chofer

- React 19
- Vite
- Capacitor Android
- Camera
- Geolocation
- Plugins nativos propios

### Infraestructura y pruebas

- Docker
- Google Cloud Build
- Google Cloud Run
- Artifact Registry
- Google Cloud Storage opcional
- Playwright

## Arquitectura

```text
trasportadora/
├── backend/       # API REST Node/Express/TypeScript
├── frontend/      # Backoffice administrativo
├── app-chofer/    # PWA + app Android con Capacitor
├── landing-saas/  # Landing, registro y login
├── e2e-tests/     # Pruebas Playwright
├── tools/tests/   # Regresiones y aislamiento tenant
├── deploy/        # Configuración de despliegue
└── docs/          # Documentación técnica completa
```

## Multi-tenant y seguridad

Los datos operativos están asociados a `tenant_id`. Los usuarios normales solo deben operar dentro de su empresa, mientras que el rol SaaS de administración puede realizar operaciones cross-tenant explícitas.

El sistema incluye roles como:

- `superadmin_saas`
- `admin_empresa`
- `operador`
- `financiero`
- `rrhh`
- `despachante`
- `chofer`
- `cliente_portal`

Las rutas productivas requieren autenticación salvo endpoints públicos concretos como login, refresh y recursos explícitamente expuestos.

## Inicio rápido

Instalar dependencias desde la raíz:

```bash
npm install
```

Cuando sea necesario, instalar también las dependencias de cada aplicación:

```bash
cd backend && npm install
cd ../frontend && npm install
cd ../app-chofer && npm install
cd ../landing-saas && npm install
```

Levantar todos los servicios:

```bash
npm run dev:all
```

O por separado:

```bash
npm run dev:backend
npm run dev:frontend
npm run dev:chofer
npm run dev:landing
```

## Build

```bash
npm run build:all
```

## Pruebas

Regresiones funcionales:

```bash
npm run test:features
```

Aislamiento multi-tenant:

```bash
npm run test:tenant
```

End-to-end con Playwright:

```bash
npm run test:e2e
```

La prueba de aislamiento tenant verifica que una empresa nueva no pueda acceder a información perteneciente a otro tenant a través de módulos operativos, finanzas, dashboard, GPS, usuarios, reportes y app chofer.

## Variables de entorno

El backend utiliza variables como:

```text
PORT
JWT_SECRET
REFRESH_TOKEN_SECRET
JWT_EXPIRES_IN
CORS_ORIGIN
DATABASE_URL
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
GCS_BUCKET
```

Usa `backend/.env.example` y `deploy/env.example` como referencia. No versiones `.env`, service accounts, tokens ni credenciales reales.

## Base de datos

- **Desarrollo:** SQLite.
- **Producción:** capa preparada para PostgreSQL/Supabase.

Las consultas de datos operativos deben respetar el aislamiento mediante `tenant_id`. Antes de usar el sistema con clientes reales, la migración productiva y las pruebas de aislamiento deben estar validadas.

## Despliegue

La infraestructura incluida permite construir los frontends, empaquetar el backend y desplegar el conjunto en Google Cloud mediante Cloud Build y Cloud Run.

Consulta la documentación completa para configuración de producción, despliegue y operación.

## Roadmap técnico

- completar y validar la migración PostgreSQL productiva;
- ampliar pruebas API por endpoint y tenant;
- aplicar code splitting en frontend;
- formalizar generación/publicación de APK y OTA;
- ampliar reportes financieros agregados.

## Documentación completa

La guía técnica y funcional extendida está en [`docs/README.md`](docs/README.md). Allí se documentan endpoints, estados de pedidos/viajes, app chofer, seguridad, despliegue, pruebas y operación.
