# Seguridad

## Roles

- `superadmin_saas`
- `admin_empresa`
- `operador`
- `financiero`
- `rrhh`
- `despachante`
- `chofer`
- `cliente_portal`

## Permisos

- `users.manage`
- `pedidos.read`
- `pedidos.create`
- `pedidos.update`
- `pedidos.delete`
- `viajes.manage`
- `finanzas.manage`
- `rrhh.manage`
- `flota.manage`
- `reportes.read`
- `configuracion.manage`
- `clientes.portal`

## Autenticacion

- Login con bcrypt para `password_hash`.
- Compatibilidad temporal con password plano para usuarios historicos.
- JWT de acceso con expiracion configurable.
- Refresh tokens persistidos con hash.
- Rate limit en login.
- Helmet para headers de seguridad.
- CORS configurable con `CORS_ORIGIN`.

## Tenant isolation

La base ya contiene `tenant_id` en tablas operativas y financieras. Los endpoints nuevos usan el tenant del JWT. Los endpoints historicos deben completar la fase de reescritura para aplicar filtros obligatorios en todos los `SELECT`, `UPDATE` y `DELETE`.

## Auditoria

Tabla `audit_logs`:

- `tenant_id`
- `user_id`
- `accion`
- `entidad`
- `entidad_id`
- `antes_json`
- `despues_json`
- `ip`
- `user_agent`
- `fecha`

Ya se auditan login, usuarios, alertas, reglas, rutas y facturas. Deben sumarse todos los endpoints historicos de pedidos, viajes, caja, pagos, clientes y vehiculos en la siguiente iteracion.
