# Sistema de Transportadora Paraguay

## Descripción General

Sistema integral de gestión para transportadoras de cargas en Paraguay. Plataforma SaaS multi-tenant que permite gestionar la operación completa de transporte: pedidos, viajes, flota, choferes, tracking GPS, recursos humanos, finanzas y mantenimiento.

## Arquitectura del Proyecto

### Estructura de Directorios

```
trasportadora/
├── backend/              # API REST con Node.js/Express + TypeScript + SQLite
├── frontend/            # Backoffice web con React + Vite + TypeScript
├── app-chofer/          # App móvil para choferes con React + Capacitor
├── landing-saas/        # Landing page del producto SaaS
└── documentacion_sistema_transportadora_paraguay.md  # Documentación funcional completa
```

### Stack Tecnológico

#### Backend
- **Runtime**: Node.js con TypeScript
- **Framework**: Express.js
- **Base de datos**: SQLite (better-sqlite3)
- **Autenticación**: JWT con refresh tokens
- **Seguridad**: Helmet, CORS, rate limiting
- **Hashing**: bcryptjs

#### Frontend (Backoffice)
- **Framework**: React 19
- **Build**: Vite
- **Enrutamiento**: React Router DOM
- **UI**: Lucide React (iconos)
- **Mapas**: Leaflet + React Leaflet

#### App Chofer
- **Framework**: React 19
- **Build**: Vite
- **Mobile**: Capacitor (Android)
- **Plugins**: Camera, Geolocation
- **Enrutamiento**: React Router DOM

#### Landing SaaS
- **Framework**: React 19
- **Build**: Vite

## Módulos del Sistema

### 1. Autenticación y Permisos
- Login seguro con JWT
- Refresh tokens
- Roles: superadmin_saas, admin_empresa, operador, financiero, rrhh, despachante, chofer, cliente_portal
- Permisos granulares por rol
- Auditoría de accesos
- Multi-tenant con aislamiento de datos

### 2. Operaciones Logísticas
- **Clientes**: Gestión completa con datos fiscales y comerciales
- **Choferes**: Registro, licencias, documentos, disponibilidad
- **Vehículos**: Flota con capacidades, documentos, estado operativo
- **Sucursales**: Bases operativas con geolocalización
- **Pedidos**: Guías de transporte con estados completos
- **Viajes**: Asignación de choferes y vehículos, consolidación de pedidos
- **Tracking GPS**: Rastreo en tiempo real de flota y pedidos

### 3. Recursos Humanos
- **Empleados**: Gestión de personal con contratos y salarios
- **Asistencias**: Control de asistencia diaria
- **Licencias**: Gestión de permisos y ausencias
- **Nómina**: Cálculo de salarios con horas extra y bonificaciones
- **Capacitaciones**: Registro de entrenamientos y certificaciones

### 4. Gestión Integral
- **Proveedores**: Directorio de proveedores por categoría
- **Compras**: Gestión de compras y gastos
- **Mantenimientos**: Preventivos y correctivos de flota
- **Incidencias**: Registro y seguimiento de problemas operativos
- **Inventario**: Control de stock en depósitos
- **Tarifarios**: Configuración de precios por ruta y tipo de carga
- **Contratos**: Acuerdos comerciales con clientes

### 5. Finanzas
- **Caja**: Movimientos de caja y rendiciones
- **Cuentas corrientes**: Gestión de deuda de clientes
- **Pagos**: Registro de cobros
- **Facturación**: Generación de facturas (preparado para SIFEN)
- **Gastos operativos**: Control de gastos de choferes

### 6. Reportes y Dashboards
- Dashboard operativo con KPIs en tiempo real
- Reportes de rentabilidad
- Alertas automáticas
- Reglas operativas configurables
- Auditoría completa de acciones

## Estados del Sistema

### Estados de Pedido
- borrador
- pendiente_planificación
- planificado
- asignado
- en_retiro
- en_transito
- en_entrega
- entregado
- entregado_con_novedad
- cancelado

### Estados de Viaje
- planificado
- cargando
- en_ruta
- arribado
- finalizado
- cancelado

### Estados de Vehículo
- disponible
- en_viaje
- mantenimiento
- fuera_de_servicio

## API Endpoints Principales

### Autenticación
- `POST /api/login` - Iniciar sesión
- `POST /api/auth/refresh` - Renovar token
- `POST /api/auth/logout` - Cerrar sesión
- `GET /api/me` - Obtener usuario actual

### Operaciones
- `GET/POST /api/clientes` - Gestión de clientes
- `GET/POST /api/choferes` - Gestión de choferes
- `GET/POST /api/vehiculos` - Gestión de vehículos
- `GET/POST /api/sucursales` - Gestión de sucursales
- `GET/POST /api/pedidos` - Gestión de pedidos
- `GET/POST /api/viajes` - Gestión de viajes
- `POST /api/tracking` - Reportar ubicación GPS
- `GET /api/tracking/latest` - Obtener últimas posiciones

### Recursos Humanos
- `GET /api/rrhh/resumen` - Resumen de RRHH
- `GET/POST /api/rrhh/empleados` - Gestión de empleados
- `GET/POST /api/rrhh/asistencias` - Control de asistencia
- `GET/POST /api/rrhh/licencias` - Gestión de licencias
- `GET/POST /api/rrhh/nomina` - Nómina salarial
- `GET/POST /api/rrhh/capacitaciones` - Capacitaciones

### Gestión
- `GET /api/gestion/resumen` - Resumen de gestión
- `GET/POST /api/gestion/proveedores` - Proveedores
- `GET/POST /api/gestion/compras` - Compras
- `GET/POST /api/gestion/mantenimientos` - Mantenimientos
- `GET/POST /api/gestion/incidencias` - Incidencias
- `GET/POST /api/gestion/inventario` - Inventario
- `GET/POST /api/gestion/tarifarios` - Tarifarios
- `GET/POST /api/gestion/contratos` - Contratos

### Finanzas
- `GET/POST /api/caja/movimientos` - Movimientos de caja
- `GET/POST /api/caja/rendiciones` - Rendiciones de choferes
- `GET/POST /api/caja/gastos` - Gastos operativos
- `POST /api/pagos` - Registrar pagos
- `GET /api/clientes/:id/cuenta` - Cuenta corriente

### Configuración
- `GET/PUT /api/configuracion` - Configuración del sistema
- `GET/POST /api/alertas` - Alertas
- `GET/POST /api/reglas` - Reglas operativas
- `GET /api/auditoria` - Logs de auditoría

## Scripts de Desarrollo

### Backend
```bash
cd backend
npm run dev      # Modo desarrollo con hot reload
npm run build    # Compilar TypeScript
npm start        # Ejecutar en producción
```

### Frontend
```bash
cd frontend
npm run dev      # Servidor de desarrollo
npm run build    # Build para producción
npm run preview  # Previsualizar build
```

### App Chofer
```bash
cd app-chofer
npm run dev      # Servidor de desarrollo
npm run build    # Build para producción
npx cap sync     # Sincronizar con Capacitor
npx cap open android  # Abrir en Android Studio
```

### Landing SaaS
```bash
cd landing-saas
npm run dev      # Servidor de desarrollo
npm run build    # Build para producción
```

## Configuración

### Variables de Entorno (Backend)
- `PORT` - Puerto del servidor (default: 3001)
- `JWT_SECRET` - Secreto para tokens JWT
- `REFRESH_TOKEN_SECRET` - Secreto para refresh tokens
- `JWT_EXPIRES_IN` - Expiración de tokens (default: 1h)
- `CORS_ORIGIN` - Orígenes permitidos para CORS

### Base de Datos
- SQLite con archivo `transportadora.db`
- Inicialización automática con seed data
- Soporte multi-tenant con columnas `tenant_id`

## Funcionalidades Clave

### Tracking GPS
- Rastreo de flota en tiempo real
- Tracking de pedidos basado en vehículo asignado
- Historial de posiciones
- Cálculo de ETA
- Alertas por desvío o pérdida de señal

### Optimización de Rutas
- Algoritmo de nearest neighbor para optimización
- Cálculo de distancias con fórmula Haversine
- Estimación de tiempos y costos
- Generación de paradas ordenadas

### Seguridad
- Autenticación JWT con refresh tokens
- Rate limiting en login
- Helmet para headers seguros
- Validación de permisos por rol
- Auditoría completa de acciones

### Multi-tenant
- Aislamiento de datos por tenant
- Roles específicos por tenant
- Configuración independiente por empresa
- Superadmin con acceso cross-tenant

## Páginas del Frontend

- **Dashboard** - Vista general con KPIs
- **Pedidos** - Gestión de guías de transporte
- **Viajes** - Asignación y seguimiento de viajes
- **Choferes** - Gestión de conductores
- **Vehículos** - Gestión de flota
- **Clientes** - Gestión de clientes
- **Sucursales** - Bases operativas
- **Mapa** - Tracking en tiempo real
- **RRHH** - Gestión de recursos humanos
- **Caja** - Movimientos financieros
- **Cuentas Corrientes** - Deuda de clientes
- **Ingresos** - Registro de ingresos
- **Viáticos** - Gastos de viaje
- **Reportes** - Reportes y estadísticas
- **Gestión Integral** - Proveedores, compras, mantenimientos, etc.
- **Configuración** - Configuración del sistema
- **Auditoría** - Logs de auditoría
- **Usuarios** - Gestión de usuarios

## Notas Importantes

1. **Facturación Electrónica**: El sistema está preparado para integración con SIFEN pero actualmente no implementado
2. **GPS**: El tracking de pedidos depende del GPS del vehículo asignado
3. **Offline**: La app de choferes debe soportar operación offline básica
4. **Escalabilidad**: Arquitectura modular preparada para crecer
5. **Auditoría**: Todas las acciones críticas se registran en audit_logs

## Documentación Adicional

Ver `documentacion_sistema_transportadora_paraguay.md` para:
- Requerimientos funcionales detallados
- Historias de usuario
- Procesos de negocio
- Reglas de negocio
- Roadmap por fases
- Definición de éxito del producto