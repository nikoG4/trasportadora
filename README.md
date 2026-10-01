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

### Infraestructura

- Docker
- Google Cloud Build
- Google Cloud Run
- Artifact Registry
- Google Cloud Storage opcional

## Arquitectura

```text
trasportadora/
├── backend/       # API REST y lógica de negocio
├── frontend/      # Backoffice administrativo
├── app-chofer/    # Aplicación móvil/PWA para choferes
├── landing-saas/  # Landing, registro y acceso SaaS
├── e2e-tests/     # Pruebas Playwright
├── tools/tests/   # Regresiones y aislamiento tenant
├── deploy/        # Recursos de despliegue
└── docs/          # Documentación técnica completa
```

## Multi-tenant

Cada dato operativo está asociado a un `tenant_id`. Los usuarios de una empresa solo deben acceder a información perteneciente a su tenant, mientras que las operaciones cross-tenant quedan reservadas al rol SaaS correspondiente.

El proyecto incluye pruebas específicas para comprobar aislamiento entre tenants en módulos operativos, dashboard, finanzas, GPS, usuarios y app de choferes.

## Desarrollo

Instala las dependencias:

```bash
npm install
```

Levanta todos los servicios:

```bash
npm run dev:all
```

También pueden ejecutarse por separado:

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

```bash
npm run test:features
npm run test:tenant
npm run test:e2e
```

`test:tenant` comprueba específicamente que un tenant nuevo no pueda ver información perteneciente a otro.

## Configuración

Las variables del backend incluyen, entre otras:

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

Usa los archivos `.env.example` como plantilla y mantén los valores reales fuera de Git. En producción, usa Secret Manager o un mecanismo equivalente.

## Seguridad

- No versionar `.env`, tokens, secretos JWT, service accounts o credenciales de base de datos.
- Mantener identificadores administrativos de infraestructura fuera de documentación pública cuando no sean necesarios para ejecutar el proyecto.
- Validar siempre `tenant_id` antes de leer o modificar recursos.
- Mantener las rutas y operaciones sensibles cubiertas por autenticación y auditoría.
- Si una credencial estuvo alguna vez expuesta en Git, debe rotarse aunque se elimine del commit actual.

## Documentación

La documentación técnica ampliada está en:

- [docs/README.md](docs/README.md)

Allí se documentan la API, estados de pedidos/viajes, roles, variables, despliegue, pruebas y roadmap técnico.

## Estado actual

El sistema está en una etapa de MVP avanzado. La base local funciona sobre SQLite y la migración productiva a PostgreSQL/Supabase forma parte del trabajo de endurecimiento antes de operar entornos reales.