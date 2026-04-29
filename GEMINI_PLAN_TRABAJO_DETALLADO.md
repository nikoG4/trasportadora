# Plan de trabajo para Gemini: convertir el sistema de transportadora en un MVP competente

Fecha de auditoria: 2026-04-23  
Proyecto: `c:\Users\ll\Desktop\trasportadora`  
Servicios esperados:
- Backend: `backend`, `npm run start`, `http://localhost:3001`
- Backoffice admin: `frontend`, `npm run dev -- --host 0.0.0.0 --port 5173`
- App chofer: `app-chofer`, `npm run dev -- --host 0.0.0.0 --port 5174`
- Landing: `landing-saas`, `npm run dev -- --host 0.0.0.0 --port 5175`

## 0. Resumen brutal del estado actual

El sistema tiene una maqueta navegable, backend Express con SQLite y varias pantallas, pero todavia no es competente para operar una transportadora real. La brecha principal no es estetica: el flujo core pedido -> planificacion -> viaje -> app chofer -> tracking/POD esta roto o es simulado.

Hallazgos verificados con Playwright:
- `npm run build` falla en `frontend`, `app-chofer` y `landing-saas` por TypeScript (`noUnusedLocals`).
- El E2E existente `e2e-tests/tests/admin-flow.spec.ts` falla porque no coincide con los formularios reales.
- Desde la UI se puede crear un pedido, pero queda con `cliente_pagador_id: null` porque `frontend/src/pages/Pedidos.tsx` envia `cliente_id` y el backend espera `cliente_pagador_id`.
- La tabla de Pedidos muestra columnas vacias porque usa campos inexistentes (`cliente_nombre`, `origen`, `destino`) en lugar de `cliente_pagador_nombre`, `sucursal_origen_nombre`, `sucursal_destino_nombre` o direcciones reales.
- `frontend/src/pages/Viajes.tsx` filtra pedidos con `estado === 'pendiente'`, pero los pedidos creados quedan en `borrador` y el seed usa `registrado`; resultado: "No hay pedidos pendientes" y no se pueden planificar viajes con pedidos reales.
- El tracking GPS es una simulacion aleatoria generada por la app de chofer cada 10 segundos, no un modulo de tracking real.
- La autenticacion emite JWT, pero ninguna ruta del backend valida el token; cualquier cliente puede llamar endpoints administrativos.
- Las contrasenas se guardan en texto plano y el secreto JWT esta hardcodeado.
- No hay edicion real para la mayoria de entidades. El caso visible de `Sucursales` intenta `PUT`/`DELETE`, pero el backend no tiene esos endpoints.

Evidencia generada:
- Screenshots y `audit.json`: `playwright-audit/`
- E2E fallido: `e2e-tests/test-results/`

## 1. Antes de tocar funcionalidades: dejar el proyecto construible y testeable

Objetivo: que los 4 paquetes puedan compilar y que los tests e2e fallen solo por bugs funcionales, no por setup roto.

Tareas:
1. Corregir builds TypeScript:
   - `frontend/src/pages/Configuracion.tsx`: remover import `React` no usado.
   - `frontend/src/pages/Dashboard.tsx`: remover import `React` no usado.
   - `frontend/src/pages/Mapa.tsx`: remover import `React` no usado.
   - `frontend/src/pages/Pedidos.tsx`: remover import `FileText` no usado.
   - `app-chofer/src/App.tsx`: remover import `CheckSquare` no usado.
   - `landing-saas/src/App.tsx`: remover import `React` no usado.
2. Ejecutar:
   - `cd frontend && npm run build`
   - `cd app-chofer && npm run build`
   - `cd landing-saas && npm run build`
3. Actualizar `e2e-tests/tests/admin-flow.spec.ts` para usar labels/selectores estables y el contrato real.
4. Agregar `data-testid` en botones, tablas y formularios importantes para no depender de `nth(0)`, `nth(1)`, etc.
5. Crear un README raiz con comandos unificados para levantar todo.

Criterio de aceptacion:
- Los 3 builds de frontend pasan.
- `npx playwright test --project=chromium` al menos llega al flujo real y valida el caso feliz.
- Los servicios pueden levantarse en puertos fijos sin cerrar la terminal inesperadamente.

## 2. Arreglar el flujo core: Pedido -> Viaje -> Chofer -> POD

Esta es la prioridad maxima. Sin esto, el sistema no sirve como operacion.

### 2.1 Backend: normalizar estados y contratos

Archivos principales:
- `backend/src/index.ts`
- `backend/src/db.ts`
- `frontend/src/pages/Pedidos.tsx`
- `frontend/src/pages/Viajes.tsx`
- `app-chofer/src/App.tsx`

Tareas backend:
1. Definir estados unicos y documentados:
   - Pedido: `borrador`, `registrado`, `pendiente_planificacion`, `planificado`, `en_retiro`, `en_transito`, `en_entrega`, `entregado`, `entregado_con_novedad`, `cancelado`.
   - Viaje: `planificado`, `cargando`, `en_ruta`, `arribado`, `finalizado`, `con_incidencia`, `cancelado`.
2. Al crear pedido desde backoffice, usar estado por defecto `pendiente_planificacion` o permitir elegir entre `borrador` y `registrado`, pero el flujo operativo debe dejarlo planificable.
3. Cambiar `POST /api/pedidos` para validar y guardar `cliente_pagador_id`, no `cliente_id`.
4. Responder errores 400 claros si faltan:
   - `cliente_pagador_id`
   - `sucursal_origen_id`
   - `sucursal_destino_id`
   - remitente/destinatario
   - tipo de carga
   - cantidad/peso validos
5. Agregar endpoints:
   - `GET /api/pedidos/:id`
   - `PUT /api/pedidos/:id`
   - `DELETE /api/pedidos/:id` como baja logica o `estado = cancelado`
   - `PUT /api/pedidos/:id/estado`
6. En `POST /api/viajes`:
   - Exigir chofer, vehiculo, origen, destino, fecha.
   - Exigir al menos un pedido.
   - Permitir solo pedidos en `pendiente_planificacion` o `registrado`.
   - Bloquear vehiculo si ya esta en un viaje activo.
   - Bloquear chofer si ya esta en un viaje activo.
   - Actualizar pedidos a `planificado`.
   - Actualizar vehiculo a `en_viaje`.
7. En `PUT /api/viajes/:id/estado`:
   - Transiciones validas, no cualquier texto.
   - Si pasa a `en_ruta`, pedidos asociados deben pasar a `en_transito`.
   - Si finaliza viaje, vehiculo vuelve a `disponible` y solo finaliza si todos los pedidos estan cerrados o con excepcion.

### 2.2 Frontend admin: hacer que Pedidos y Viajes funcionen de verdad

Tareas en `frontend/src/pages/Pedidos.tsx`:
1. Cambiar `formData.cliente_id` por `formData.cliente_pagador_id`.
2. Enviar `cliente_pagador_id` en el payload.
3. Mostrar columnas correctas:
   - Cliente: `p.cliente_pagador_nombre`
   - Origen: `p.sucursal_origen_nombre` o `p.remitente_direccion`
   - Destino: `p.sucursal_destino_nombre` o `p.destinatario_direccion`
4. Agregar acciones:
   - Ver detalle.
   - Editar.
   - Cancelar.
   - Cambiar estado si corresponde.
   - Imprimir guia.
5. Agregar busqueda por guia, cliente, destinatario.
6. Agregar filtros por estado, sucursal origen/destino, rango de fecha.
7. Al guardar, mostrar error visible si backend responde 400/500.
8. Evitar `alert`; usar mensajes inline o toast sencillo.
9. No guardar si origen y destino son iguales sin advertencia.
10. Agregar validacion de numeros: bultos > 0, peso >= 0, precio >= 0.

Tareas en `frontend/src/pages/Viajes.tsx`:
1. Cambiar filtro `p.estado === 'pendiente'` por estados planificables reales.
2. Mostrar pedidos candidatos correctamente con cliente/origen/destino reales.
3. No permitir crear viaje sin pedido.
4. Agregar detalle de viaje con pedidos asociados.
5. El manifiesto impreso debe listar pedidos reales, no texto dummy.
6. Agregar acciones:
   - Ver detalle.
   - Editar planificacion si aun no inicio.
   - Cancelar.
   - Cambiar estado.
   - Reasignar chofer/vehiculo antes de iniciar.
7. Al crear viaje, refrescar viajes, pedidos y vehiculos con estado correcto.

### 2.3 App chofer: cerrar entrega real

Tareas en `app-chofer/src/App.tsx`:
1. No "loguear" por selector libre de chofer. Implementar login real:
   - usuario/clave o token de chofer.
   - endpoint backend protegido.
2. Mostrar viajes asignados con origen/destino, pedidos y estados claros.
3. Al iniciar viaje:
   - actualizar viaje a `en_ruta`.
   - actualizar pedidos a `en_transito`.
4. Dividir acciones:
   - llegada a retiro
   - retiro confirmado
   - llegada a entrega
   - entrega confirmada
   - incidencia
5. POD:
   - Capturar foto.
   - Capturar firma.
   - Nombre receptor.
   - Documento receptor.
   - Bultos entregados.
   - Entrega parcial/total.
   - Observaciones.
6. Guardar POD en backend con entidad propia, no solo columnas sueltas en `pedidos`.
7. No permitir finalizar viaje si quedan pedidos sin entregar/cancelar/incidencia resuelta.
8. Agregar estados de carga y error.

Criterio de aceptacion del flujo core:
1. Admin crea cliente/sucursal/chofer/vehiculo.
2. Admin crea pedido y la tabla muestra cliente/origen/destino.
3. Admin crea viaje y puede seleccionar ese pedido.
4. App chofer ve el viaje.
5. Chofer inicia viaje.
6. Admin ve tracking/estado actualizado.
7. Chofer registra POD.
8. Admin ve pedido entregado con evidencia.
9. Vehiculo vuelve a disponible al finalizar viaje.
10. E2E automatizado cubre todo el flujo en Chromium.

## 3. CRUD real para entidades maestras

Ahora solo hay altas en muchos modulos. Un sistema operativo necesita editar, desactivar y consultar.

Entidades:
- Sucursales
- Clientes
- Choferes
- Vehiculos
- Usuarios

Tareas backend:
1. Implementar para cada entidad:
   - `GET /api/<entidad>`
   - `GET /api/<entidad>/:id`
   - `POST /api/<entidad>`
   - `PUT /api/<entidad>/:id`
   - `DELETE /api/<entidad>/:id` como baja logica cuando aplique.
2. No borrar fisicamente si la entidad tiene pedidos/viajes asociados.
3. Agregar validaciones de unicidad:
   - usuario username
   - sucursal codigo
   - vehiculo chapa
   - cliente ruc opcional
   - chofer documento/licencia opcional
4. Devolver errores consistentes: `{ error: string, details?: any }`.

Tareas frontend:
1. Agregar botones editar/eliminar/desactivar.
2. Reusar modal para crear/editar.
3. Confirmacion antes de eliminar/desactivar.
4. Mostrar errores del backend.
5. Agregar busqueda y filtros basicos.
6. Mostrar estados activos/inactivos.

Nota critica: `frontend/src/pages/Sucursales.tsx` ya llama `PUT /api/sucursales/:id` y `DELETE /api/sucursales/:id`, pero esos endpoints no existen. Arreglar de inmediato.

## 4. Seguridad minima para dejar de ser demo insegura

Tareas obligatorias:
1. Mover `SECRET` a `.env` (`JWT_SECRET`).
2. Agregar `dotenv.config()`.
3. Hashear passwords con `bcrypt` o `argon2`.
4. Crear middleware `authenticateToken`.
5. Aplicar middleware a todos los endpoints salvo login y tracking publico si se decide permitir ingest externa.
6. Crear middleware `requireRole('admin')` para:
   - usuarios
   - configuracion SaaS
   - reportes sensibles
7. Frontend debe enviar `Authorization: Bearer <token>`.
8. Manejar expiracion de sesion.
9. Eliminar credenciales hardcodeadas de produccion.
10. No exponer contrasenas en respuestas.

Criterio de aceptacion:
- Sin token, `GET /api/clientes` devuelve 401.
- Con token operador, no puede administrar usuarios.
- Con token admin, puede administrar usuarios.
- Password en DB no es texto plano.

## 5. Base de datos: pasar de schema demo a modelo mantenible

Problemas actuales:
- `initDb()` crea tablas con `CREATE TABLE IF NOT EXISTS`, pero no hay migraciones versionadas.
- No hay constraints suficientes.
- No hay indices.
- Documentos, POD, incidencias y tracking estan mal normalizados o incompletos.

Tareas:
1. Implementar migraciones simples, por ejemplo carpeta `backend/src/migrations` o usar `better-sqlite3` con tabla `schema_migrations`.
2. Agregar indices:
   - `pedidos.numero_guia`
   - `pedidos.estado`
   - `pedidos.cliente_pagador_id`
   - `pedidos.viaje_id`
   - `viajes.estado`
   - `viajes.chofer_id`
   - `viajes.vehiculo_id`
   - `tracking.vehiculo_id, timestamp`
3. Crear tablas faltantes:
   - `incidencias`
   - `pod_entregas`
   - `documentos`
   - `mantenimientos`
   - `ordenes_trabajo`
   - `tarifas`
   - `auditoria`
   - `gps_devices`
   - `gps_events`
4. Separar archivos/evidencias:
   - En MVP local, guardar en carpeta `backend/uploads`.
   - En produccion, preparar adaptador a S3/GCS.
   - No guardar fotos grandes en Base64 dentro de SQLite.
5. Agregar timestamps:
   - `created_at`
   - `updated_at`
   - `deleted_at` cuando aplique.

## 6. Tracking GPS realista

Estado actual: la app chofer genera coordenadas aleatorias cerca de Asuncion si hay viaje activo. Sirve solo para demo visual.

Tareas:
1. Crear endpoint de ingesta:
   - `POST /api/gps/events`
   - payload: `deviceId`, `provider`, `lat`, `lng`, `speed`, `heading`, `eventTime`, `ignition`, `accuracy`, `rawPayload`.
2. Relacionar `gps_devices` con `vehiculos`.
3. Guardar historico en `gps_events`.
4. `GET /api/tracking/latest` debe obtener ultimo evento por vehiculo.
5. `GET /api/viajes/:id/tracking` debe devolver ruta historica del viaje.
6. `GET /api/pedidos/:id/tracking` debe derivar tracking del viaje/vehiculo asociado.
7. Marcar tracking como degradado si no hay senal reciente.
8. Mostrar en mapa:
   - vehiculos con estado y ultima senal
   - viajes activos
   - pedido seleccionado
   - ruta historica
   - timestamps legibles
9. Eliminar coordenadas deterministicas falsas para direcciones si no hay geocoding. Mostrar "sin coordenadas" o permitir registrar lat/lng por direccion/sucursal.
10. Preparar adaptadores GPS por proveedor, aunque inicialmente sea `MockGpsProviderAdapter`.

Criterio de aceptacion:
- Se puede insertar evento GPS via API.
- Admin ve vehiculo en mapa.
- Si el vehiculo tiene viaje activo, el pedido asociado muestra ubicacion.
- Si pasan X minutos sin eventos, aparece alerta de senal perdida.

## 7. Incidencias

Estado actual: la app chofer guarda un texto en `viajes.incidencias`. Eso no alcanza.

Tareas:
1. Crear tabla `incidencias`:
   - id
   - viaje_id
   - pedido_id nullable
   - tipo
   - descripcion
   - lat/lng nullable
   - foto_url nullable
   - estado (`abierta`, `en_revision`, `resuelta`, `cerrada`)
   - reportado_por_usuario_id o chofer_id
   - created_at/resolved_at
2. Backend CRUD:
   - crear incidencia
   - listar por viaje/pedido
   - resolver/cerrar
3. App chofer:
   - elegir tipo de incidencia
   - cargar foto opcional
   - guardar ubicacion si navegador lo permite
4. Backoffice:
   - bandeja de incidencias
   - filtros por estado/tipo
   - detalle y resolucion

## 8. Mantenimiento y documentos

Actualmente casi no existe, aunque la documentacion lo promete.

Tareas documentos:
1. Documentos para vehiculos y choferes:
   - tipo
   - numero
   - fecha_emision
   - fecha_vencimiento
   - archivo_url
   - estado
2. Alertas:
   - vencido
   - vence en 30 dias
   - vence en 7 dias
3. Bloqueo configurable:
   - no asignar vehiculo con habilitacion vencida
   - no asignar chofer con licencia vencida

Tareas mantenimiento:
1. Tabla `mantenimientos` u `ordenes_trabajo`.
2. Registrar:
   - tipo preventivo/correctivo
   - vehiculo
   - fecha
   - kilometraje
   - costo
   - taller/proveedor
   - descripcion
   - estado
3. Marcar vehiculo fuera de servicio.
4. Dashboard con proximos mantenimientos.

## 9. Portal cliente

No existe portal cliente real. La landing no cuenta.

Tareas:
1. Crear modulo o app `portal-cliente` o integrar en `frontend` con rutas publicas/protegidas.
2. Flujo minimo:
   - buscar pedido por numero de guia + documento/RUC
   - ver estado
   - ver tracking si tiene viaje activo
   - descargar/ver POD cuando este entregado
3. No exponer datos de otros clientes.
4. Diseno mobile-first.

## 10. Reportes operativos y financieros utiles

Estado actual: reportes son basicos.

Tareas:
1. Dashboard operativo:
   - pedidos por estado
   - viajes activos
   - atrasos
   - incidencias abiertas
   - vehiculos disponibles/en viaje/fuera de servicio
   - documentos vencidos
2. Reporte financiero basico:
   - ingresos por pedidos
   - costos estimados por viaje
   - combustible
   - margen estimado
3. Filtros por rango de fecha, sucursal, cliente.
4. Exportar CSV.

## 11. UX/UI: hacerlo usable, no solo visible

Tareas:
1. Arreglar responsive del backoffice. Hoy el sidebar fijo de 250px puede ser malo en mobile/tablet.
2. Agregar estados:
   - cargando
   - vacio
   - error
   - guardando
3. Evitar modales gigantes con campos escondidos si impiden validacion.
4. En pedidos, usar flujo tipo wizard con resumen antes de guardar.
5. Tablas:
   - busqueda
   - filtros
   - paginacion
   - acciones claras
6. Usar moneda paraguaya `Gs.` y formato local, no `$`.
7. Revisar textos con mojibake/encoding si aparecen caracteres rotos en archivos o consola.
8. No usar `alert()` para errores/confirmaciones operativas.

## 12. Landing

Estado actual: landing muy basica y promete cosas que no estan implementadas.

Tareas:
1. Ajustar copy para no prometer "listo para usar" hasta que el core este completo.
2. Agregar capturas reales del producto cuando este funcional.
3. Links:
   - admin
   - portal cliente cuando exista
   - app chofer
4. Hacer build pasar.

## 13. Tests obligatorios

### 13.1 Unit/integration backend

Agregar tests para:
- login correcto/incorrecto
- auth requerida
- crear cliente
- crear pedido valido
- rechazar pedido invalido
- crear viaje con pedido planificable
- rechazar viaje sin pedido
- rechazar vehiculo ocupado
- cambiar estado de viaje y propagacion a pedidos
- registrar POD
- registrar GPS event

### 13.2 E2E Playwright

Reescribir `e2e-tests/tests/admin-flow.spec.ts` en tests separados:
1. `auth.spec.ts`
   - login admin
   - logout
   - operador no ve admin
2. `pedido-viaje-flow.spec.ts`
   - crear pedido
   - aparece en tabla con datos correctos
   - crear viaje con ese pedido
   - pedido pasa a planificado
3. `chofer-flow.spec.ts`
   - chofer ve viaje
   - inicia viaje
   - registra POD
   - finaliza viaje
4. `tracking.spec.ts`
   - insertar evento GPS
   - mapa muestra vehiculo
5. `crud.spec.ts`
   - editar/desactivar sucursal/cliente/vehiculo/chofer

Usar `data-testid` y no `nth()` salvo que no haya alternativa.

## 14. Orden recomendado de ejecucion para Gemini

No saltar directo a features vistosas. El orden importa:

1. Hacer builds pasar.
2. Arreglar contrato Pedido frontend/backend.
3. Arreglar estados y filtro de Viajes.
4. Hacer E2E del flujo core pasar.
5. Implementar CRUD edit/delete real.
6. Agregar auth middleware y passwords hasheadas.
7. Normalizar POD e incidencias.
8. Mejorar tracking GPS.
9. Agregar documentos/mantenimiento.
10. Crear portal cliente.
11. Mejorar reportes.
12. Pulir UX responsive y landing.

## 15. Comandos de verificacion que Gemini debe correr al final de cada bloque

```bash
cd backend
npm run start
```

```bash
cd frontend
npm run build
npm run dev -- --host 0.0.0.0 --port 5173
```

```bash
cd app-chofer
npm run build
npm run dev -- --host 0.0.0.0 --port 5174
```

```bash
cd landing-saas
npm run build
```

```bash
cd e2e-tests
npx playwright test --project=chromium
```

## 16. No hacer

- No agregar facturacion electronica/SIFEN todavia.
- No convertir a microservicios.
- No meter IA ni optimizacion avanzada antes de cerrar el flujo operativo.
- No seguir guardando fotos/firma grandes en Base64 como solucion final.
- No maquillar la landing antes de que el backoffice y app chofer funcionen.
- No crear mas pantallas dummy sin persistencia real.
- No cambiar a PostgreSQL antes de arreglar contratos y tests, salvo que se haga con migracion ordenada.

## 17. Resultado esperado

Al terminar este plan, el sistema debe poder demostrar en vivo:
- Alta de maestros.
- Creacion de pedido con datos completos.
- Planificacion de viaje con uno o varios pedidos.
- Chofer ejecuta viaje desde app.
- Tracking visible en backoffice.
- Incidencia registrada y visible.
- POD registrado y consultable.
- Reportes basicos consistentes.
- Seguridad minima con roles.
- Build y E2E pasando.

