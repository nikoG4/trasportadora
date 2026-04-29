# Estado actual del sistema

Fecha: 2026-04-28

## Resumen ejecutivo

El proyecto ya contiene un sistema funcional de transportadora con backend Node/Express, panel administrativo React/Vite, app chofer React/Vite empaquetada con Capacitor Android, base SQLite y pruebas E2E iniciales. La base existente cubre operaciones, flota, clientes, pedidos, viajes, tracking, caja, rendiciones, RRHH y gestion integral.

La arquitectura original fue pensada como sistema monoempresa. En esta revision se agrego una fundacion SaaS progresiva: entidades de tenant, roles/permisos, refresh tokens, auditoria, alertas, reglas operativas, rutas planificadas, facturas, portal cliente a nivel de datos y columnas `tenant_id` sobre tablas operativas/financieras.

## Estructura

- `backend`: API Express con SQLite `better-sqlite3`.
- `frontend`: panel administrativo React/Vite.
- `app-chofer`: app movil React/Vite con Capacitor Android.
- `e2e-tests`: pruebas Playwright existentes.
- `scripts`: scripts auxiliares.
- `docs`: documentacion tecnica nueva.
- `migrations`: migraciones SQL versionadas nuevas.
- `seeds`: seed inicial documentado para SaaS.

## Modulos existentes

- Login administrativo.
- Dashboard.
- Usuarios y roles basicos.
- Sucursales.
- Clientes.
- Choferes.
- Vehiculos/flota.
- Pedidos/guias.
- Viajes/despacho.
- Mapa y tracking GPS.
- Configuracion de tickets.
- Impresion Bluetooth desde app chofer mediante plugin nativo Android.
- Caja.
- Viaticos y rendicion.
- Cuentas corrientes.
- Ingresos y facturacion basica.
- RRHH.
- Gestion integral: proveedores, compras, mantenimientos, incidencias, inventario, tarifarios, contratos.
- Reportes financieros basicos.

## Tablas actuales principales

- `users`
- `tenants`
- `permisos`
- `roles_permisos`
- `refresh_tokens`
- `audit_logs`
- `sucursales`
- `clientes`
- `choferes`
- `vehiculos`
- `viajes`
- `pedidos`
- `evidencias_pedido`
- `tracking`
- `combustible`
- `configuracion`
- `movimientos_caja`
- `rendiciones_chofer`
- `gastos_operativos`
- `cuentas_corrientes_clientes`
- `pagos_clientes`
- `rrhh_empleados`
- `rrhh_asistencias`
- `rrhh_licencias`
- `rrhh_nomina`
- `rrhh_capacitaciones`
- `proveedores`
- `compras`
- `mantenimientos_vehiculo`
- `incidencias_operativas`
- `inventario_deposito`
- `tarifarios`
- `contratos_clientes`
- `reglas_operativas`
- `reglas_ejecuciones`
- `alertas`
- `rutas_planificadas`
- `paradas_ruta`
- `facturas`
- `factura_items`
- `clientes_usuarios`

## Endpoints actuales

Auth y SaaS:

- `POST /api/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/me`
- `GET /api/tenants`
- `GET /api/auditoria`

Operaciones:

- `GET/POST/DELETE /api/usuarios`
- `GET/POST /api/sucursales`
- `GET/POST /api/clientes`
- `GET/POST /api/choferes`
- `GET/POST /api/vehiculos`
- `GET/POST/PUT/DELETE /api/pedidos`
- `PUT /api/pedidos/:id/estado`
- `PUT /api/pedidos/:id/pod`
- `GET/POST /api/viajes`
- `GET /api/viajes/chofer/:id`
- `PUT /api/viajes/:id/estado`
- `POST /api/tracking`
- `GET /api/tracking/latest`
- `GET /api/alertas/vencimientos`

SaaS extendido:

- `GET/POST/PUT /api/alertas`
- `GET/POST/PUT /api/reglas`
- `GET /api/reglas/ejecuciones`
- `POST /api/rutas/optimizar`
- `POST /api/rutas`
- `GET /api/rutas/:id`
- `POST /api/facturas`

Finanzas:

- `GET/POST /api/caja/movimientos`
- `GET/POST/PUT /api/caja/rendiciones`
- `GET/POST /api/caja/gastos`
- `GET /api/clientes/:id/cuenta`
- `POST /api/pagos`
- `GET /api/reportes/rentabilidad`

RRHH:

- `GET /api/rrhh/resumen`
- CRUD de empleados, asistencias, licencias, nomina y capacitaciones.

Gestion integral:

- `GET /api/gestion/resumen`
- CRUD de proveedores, compras, mantenimientos, incidencias, inventario, tarifarios y contratos.

## Problemas detectados

- Muchos endpoints historicos todavia no aplican middleware `authenticate` ni filtros `tenant_id` de forma estricta.
- La base SQLite esta muy acoplada a SQL inline dentro de `index.ts`.
- No existia sistema de migraciones versionadas.
- No existia capa de repositorios para aislar SQLite y PostgreSQL.
- El login original usaba contrasenas planas.
- No habia refresh tokens.
- CORS y headers de seguridad no estaban endurecidos.
- No habia auditoria operacional.
- No habia API publica, webhooks ni portal cliente implementado en UI.
- No habia facturacion real con items persistentes.
- El planificador inteligente requiere coordenadas reales para funcionar; pedidos historicos pueden no tenerlas.
- El frontend usa `fetch` directo en cada pantalla; conviene centralizar cliente HTTP con auth/refresh.
- App chofer no es offline-first todavia.
- Archivos/fotos se guardan como base64 o referencias locales; falta storage real.

## Riesgos para produccion

- Aislamiento multi-tenant incompleto si se habilitan multiples empresas antes de reescribir todos los queries historicos.
- SQLite no es ideal para SaaS multiempresa concurrente.
- Faltan pruebas automatizadas amplias.
- Faltan secretos gestionados y variables obligatorias para produccion.
- Faltan URLs firmadas para evidencias y documentos.
- La app Android debug no reemplaza release firmado.

## Deuda tecnica prioritaria

1. Extraer repositorios por dominio y eliminar SQL inline repetido.
2. Aplicar `authenticate`, `requirePermission` y `tenant_id` a todos los endpoints historicos.
3. Centralizar cliente API del frontend.
4. Migrar de SQLite a PostgreSQL/Cloud SQL.
5. Implementar migraciones reales ejecutables en ambos motores.
6. Agregar test suite backend.
7. Implementar almacenamiento de archivos en GCS.
8. Separar portal cliente como rutas protegidas por rol.
9. Implementar SSE/WebSocket para tracking.
10. Convertir app chofer a offline-first con cola local.

## Plan de implementacion por fases

### Fase A: Fundacion SaaS

- Mantener compatibilidad con sistema actual.
- Crear `tenants`, roles, permisos, auditoria, refresh tokens.
- Agregar `tenant_id` a tablas.
- Crear seed demo y superadmin.
- Agregar documentacion y deploy base.

### Fase B: Aislamiento estricto

- Proteger cada endpoint historico.
- Filtrar todos los listados por `tenant_id`.
- Validar pertenencia tenant en updates/deletes.
- Agregar tests de aislamiento.

### Fase C: Operacion avanzada

- Reglas operativas.
- Alertas.
- Rutas inteligentes con proveedor de mapas.
- Tracking realtime y link publico.

### Fase D: Portales y finanzas

- Portal cliente.
- Facturas, items, pagos parciales, estados de cuenta y PDF.
- Reportes BI reales.

### Fase E: Produccion Google Cloud

- PostgreSQL Cloud SQL.
- Cloud Run.
- Cloud Storage.
- Secret Manager.
- Cloud Build.
- Observabilidad.
