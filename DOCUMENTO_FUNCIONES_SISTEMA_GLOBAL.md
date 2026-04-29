# Documento detallado de funciones del sistema global

Fecha de actualizacion: 2026-04-28

## 1. Alcance general

El sistema es una plataforma integral para una transportadora. Incluye panel administrativo web, backend API, base de datos SQLite, app movil de choferes con APK Android, seguimiento GPS, gestion de pedidos, viajes, flota, clientes, caja, rendiciones, cuentas corrientes, RRHH, gestion operativa integral, configuracion de tickets e impresion Bluetooth termica.

Los componentes principales son:

- Backend: API Express/Node con SQLite.
- Panel administrativo: React/Vite para administracion, operaciones y finanzas.
- App choferes: React/Vite empaquetada con Capacitor Android.
- Base de datos: `transportadora.db` con tablas operativas, financieras, RRHH y configuracion.

## 2. Seguridad, usuarios y acceso

### Funciones

- Inicio de sesion del panel administrativo.
- Control basico por rol: administrador u operador.
- Administracion de usuarios desde el panel.
- Restriccion de pantallas administrativas sensibles al rol `admin`.

### Registra

Tabla `users`:

- `id`: identificador interno.
- `username`: usuario unico.
- `password`: contrasena.
- `role`: rol del usuario.

### Puede hacer

- Crear usuarios.
- Listar usuarios.
- Eliminar usuarios.
- Iniciar sesion y guardar token JWT.
- Mostrar u ocultar secciones del menu segun rol.

## 3. Dashboard operativo

### Funciones

- Vista resumida del estado general.
- Indicadores de viajes activos.
- Indicadores de vehiculos disponibles.
- Indicadores de pedidos pendientes.
- Alertas de vencimientos de choferes y vehiculos.

### Datos consultados

- Viajes con estados activos.
- Vehiculos disponibles.
- Pedidos pendientes de planificacion o gestion.
- Vencimiento de seguro y habilitacion de vehiculos.
- Vencimiento de licencia de choferes.

## 4. Sucursales

### Funciones

- Registro de sucursales propias.
- Definicion de origen y destino de pedidos y viajes.
- Uso de coordenadas para ubicacion.

### Registra

Tabla `sucursales`:

- `id`: identificador interno.
- `nombre`: nombre de la sucursal.
- `codigo`: codigo unico.
- `direccion`: direccion fisica.
- `ciudad`: ciudad.
- `departamento`: departamento.
- `telefono`: telefono.
- `responsable`: persona responsable.
- `estado`: activo u otro estado operativo.
- `latitud`: coordenada GPS.
- `longitud`: coordenada GPS.

### Puede hacer

- Listar sucursales.
- Crear sucursales.
- Usar sucursales como origen y destino en pedidos.
- Usar sucursales como origen y destino en viajes.

## 5. Clientes

### Funciones

- Registro de clientes pagadores, remitentes frecuentes o clientes de ruta.
- Registro desde panel administrativo.
- Alta rapida desde app de choferes con ubicacion GPS.
- Uso en cuentas corrientes, contratos, pedidos e incidencias.

### Registra

Tabla `clientes`:

- `id`: identificador interno.
- `nombre`: nombre o razon social.
- `ruc`: RUC o CI.
- `direccion`: direccion.
- `telefono`: telefono.
- `tipo`: persona o empresa.
- `email`: correo.
- `condiciones_comerciales`: condiciones pactadas.
- `latitud`: coordenada GPS.
- `longitud`: coordenada GPS.

### Puede hacer

- Listar clientes.
- Crear clientes.
- Guardar ubicacion GPS cuando se registra desde ruta.
- Vincular clientes a pedidos, cuentas corrientes, pagos, contratos e incidencias.

## 6. Choferes

### Funciones

- Catalogo de conductores.
- Seleccion de perfil en app de chofer.
- Control de vencimiento de licencia.
- Asignacion de viajes.

### Registra

Tabla `choferes`:

- `id`: identificador interno.
- `nombre`: nombre del chofer.
- `documento`: documento.
- `licencia`: categoria o numero de licencia.
- `telefono`: telefono.
- `estado`: activo u otro estado.
- `vencimiento_licencia`: fecha de vencimiento.

### Puede hacer

- Listar choferes.
- Crear choferes.
- Alertar por vencimientos.
- Asignar chofer a viaje.
- Registrar tracking GPS y gastos asociados al chofer.

## 7. Vehiculos y flota

### Funciones

- Gestion de unidades.
- Control de disponibilidad.
- Alertas por vencimiento de seguro y habilitacion.
- Asociacion con viajes, tracking, combustible y mantenimiento.

### Registra

Tabla `vehiculos`:

- `id`: identificador interno.
- `chapa`: chapa unica.
- `marca`: marca.
- `modelo`: modelo.
- `capacidad`: capacidad de carga.
- `estado`: disponible, en viaje u otro.
- `vencimiento_seguro`: vencimiento del seguro.
- `vencimiento_habilitacion`: vencimiento de habilitacion.

Tabla `combustible`:

- `id`: identificador.
- `vehiculo_id`: vehiculo.
- `litros`: litros cargados.
- `monto`: importe.
- `fecha`: fecha.
- `kilometraje`: kilometraje.

### Puede hacer

- Crear vehiculos.
- Listar flota.
- Cambiar estado cuando se crea o finaliza un viaje.
- Registrar combustible.
- Usar vehiculo en mantenimiento preventivo o correctivo.

## 8. Pedidos, guias y carga

### Funciones

- Registro completo de pedidos.
- Manejo de guia.
- Datos de pagador, remitente y destinatario.
- Origen y destino por sucursal.
- Modalidad de retiro y entrega.
- Datos fisicos y comerciales de la carga.
- Estados operativos del pedido.
- Evidencias POD: foto, firma, observaciones, bultos reales.
- Devoluciones con motivo.

### Registra

Tabla `pedidos`:

- `id`: identificador interno.
- `numero_guia`: numero de guia unico.
- `cliente_pagador_id`: cliente que paga.
- `remitente_nombre`: remitente.
- `remitente_doc`: documento del remitente.
- `remitente_tel`: telefono del remitente.
- `remitente_direccion`: direccion del remitente.
- `destinatario_nombre`: destinatario.
- `destinatario_doc`: documento del destinatario.
- `destinatario_tel`: telefono del destinatario.
- `destinatario_direccion`: direccion del destinatario.
- `sucursal_origen_id`: sucursal origen.
- `sucursal_destino_id`: sucursal destino.
- `modalidad_retiro`: puerta, sucursal u otra.
- `modalidad_entrega`: puerta, sucursal u otra.
- `cantidad_bultos`: cantidad declarada.
- `peso`: peso.
- `volumen`: volumen.
- `valor_declarado`: valor declarado.
- `precio`: precio del servicio.
- `tipo_pago`: contado, credito u otro.
- `estado`: estado operativo.
- `fecha_prevista`: fecha prevista.
- `tipo_carga`: tipo de carga.
- `viaje_id`: viaje asignado.
- `foto_pod`: foto de comprobante.
- `firma_pod`: firma digital.
- `observaciones`: notas.
- `bultos_reales`: bultos gestionados realmente.
- `motivo_devolucion`: motivo si vuelve.

Tabla `evidencias_pedido`:

- `id`: identificador.
- `pedido_id`: pedido.
- `tipo`: tipo de evidencia.
- `foto_url`: foto o dato de imagen.
- `fecha`: fecha.

### Puede hacer

- Crear pedido.
- Listar pedidos con nombres de sucursales y cliente pagador.
- Editar pedido.
- Cancelar pedido.
- Cambiar estado.
- Registrar POD desde app del chofer.
- Adjuntar evidencia.
- Asignar pedido a viaje.
- Imprimir comanda o comprobante de retiro.

## 9. Viajes y despacho

### Funciones

- Planificacion de viajes.
- Asignacion de chofer, vehiculo, sucursal origen, sucursal destino y pedidos.
- Validacion de vehiculo disponible.
- Validacion de chofer sin viaje activo.
- Cambio de estados desde panel y app de choferes.
- Registro de incidencias del viaje.
- Finalizacion de viaje y liberacion de vehiculo.

### Registra

Tabla `viajes`:

- `id`: identificador.
- `tipo_viaje`: interurbano, larga distancia u otro.
- `chofer_id`: chofer asignado.
- `vehiculo_id`: vehiculo asignado.
- `sucursal_origen_id`: sucursal origen.
- `sucursal_destino_id`: sucursal destino.
- `estado`: planificado, en curso, con incidencia, finalizado, cancelado u otro.
- `fecha_inicio`: fecha de inicio.
- `costo_estimado`: costo esperado.
- `incidencias`: texto de incidencia.

### Puede hacer

- Crear viaje con uno o mas pedidos.
- Pasar pedidos a estado planificado.
- Consultar viajes con chofer, vehiculo y sucursales.
- Consultar viajes asignados a un chofer desde la app movil.
- Iniciar viaje desde app.
- Marcar llegada a retiro.
- Marcar llegada a sucursal.
- Reportar incidencia.
- Finalizar viaje si todos los pedidos estan gestionados.

## 10. Tracking GPS y mapa

### Funciones

- Seguimiento de posicion de vehiculos.
- Captura GPS desde app del chofer mientras hay viaje activo.
- Vista de ultima posicion para monitoreo.

### Registra

Tabla `tracking`:

- `id`: identificador.
- `vehiculo_id`: vehiculo.
- `chofer_id`: chofer.
- `latitud`: latitud.
- `longitud`: longitud.
- `timestamp`: fecha y hora.

### Puede hacer

- Registrar posicion periodica.
- Consultar ultima posicion por vehiculo.
- Mostrar vehiculos en mapa operativo.

## 11. App de choferes

### Funciones

- Login por seleccion de perfil de chofer.
- Lista de viajes asignados.
- Inicio de viaje.
- Vista de viaje en curso.
- Tracking GPS automatico.
- Gestion de pedidos del viaje.
- Registro POD con foto, firma, observaciones y bultos reales.
- Estados de pedido: entregado, recolectado o devuelto.
- Motivo de devolucion.
- Reporte de incidencia de viaje.
- Registro de gastos con foto de comprobante.
- Alta rapida de cliente en ruta con GPS.
- Impresion Bluetooth termica nativa en APK Android.

### Impresion de tickets

La app Android incluye un plugin nativo `BluetoothPrinter` para impresoras termicas Bluetooth clasicas emparejadas. La impresion usa puerto serial Bluetooth SPP y comandos ESC/POS basicos.

Permite:

- Listar impresoras Bluetooth emparejadas.
- Recordar la ultima impresora seleccionada.
- Seleccionar cantidad de vias antes de imprimir.
- Imprimir comanda.
- Imprimir comprobante de retiro para el cliente.
- Imprimir automaticamente/ofrecer impresion cuando un pedido queda como `recolectado`.
- Respetar ancho variable definido por configuracion.
- Respetar campos activos definidos desde el panel.
- Usar membrete configurable.

Configuracion usada por tickets:

- `membrete`: texto de cabecera.
- `ticket_width_chars`: ancho en caracteres, por ejemplo 32, 42, 48 o 64.
- `ticket_copies`: cantidad de vias por defecto.
- `ticket_fields`: JSON con campos habilitados o deshabilitados.

## 12. Configuracion SaaS

### Funciones

- Configurar membrete.
- Configurar ancho de ticket termico.
- Configurar cantidad de vias por defecto.
- Seleccionar campos que se imprimen.
- Guardado individual o masivo de claves.

### Registra

Tabla `configuracion`:

- `clave`: nombre de la configuracion.
- `valor`: valor textual o JSON.

Claves principales:

- `membrete`.
- `ticket_width_chars`.
- `ticket_copies`.
- `ticket_fields`.

### Campos configurables para impresion

- Numero de guia.
- Fecha y hora.
- Remitente.
- Documento remitente.
- Telefono remitente.
- Direccion remitente.
- Destinatario.
- Documento destinatario.
- Telefono destinatario.
- Direccion destinatario.
- Sucursal origen.
- Sucursal destino.
- Tipo de carga.
- Bultos.
- Peso.
- Volumen.
- Valor declarado.
- Precio.
- Tipo de pago.
- Estado.
- Observaciones.

## 13. Caja, gastos, rendiciones y viaticos

### Funciones

- Registro de movimientos de caja.
- Registro de gastos operativos desde app de choferes.
- Control de rendiciones de chofer por viaje.
- Seguimiento de monto recibido, gastado, cobrado y saldo entregado.
- Asociacion de comprobantes fotograficos.

### Registra

Tabla `movimientos_caja`:

- `id`: identificador.
- `tipo`: ingreso o egreso.
- `concepto`: descripcion.
- `monto`: importe.
- `fecha`: fecha.
- `usuario_id`: usuario.
- `referencia_id`: referencia operativa.
- `metodo_pago`: efectivo, transferencia u otro.
- `observaciones`: notas.

Tabla `rendiciones_chofer`:

- `id`: identificador.
- `chofer_id`: chofer.
- `viaje_id`: viaje.
- `fecha`: fecha.
- `monto_recibido`: monto recibido.
- `monto_gastado`: gastos.
- `monto_cobrado`: cobros realizados.
- `saldo_entregado`: saldo rendido.
- `estado`: pendiente u otro.

Tabla `gastos_operativos`:

- `id`: identificador.
- `chofer_id`: chofer.
- `viaje_id`: viaje.
- `tipo_gasto`: combustible, peaje, viatico, mantenimiento u otro.
- `monto`: importe.
- `fecha`: fecha.
- `comprobante_url`: foto/comprobante.
- `estado`: reportado u otro.

### Puede hacer

- Crear movimientos de caja.
- Listar movimientos.
- Crear rendiciones.
- Actualizar rendiciones.
- Crear gastos desde app movil.
- Consultar gastos con chofer y viaje.

## 14. Cuentas corrientes, pagos e ingresos

### Funciones

- Control de saldo por cliente.
- Limite de credito.
- Registro de pagos asociados a cliente y pedido.
- Actualizacion del saldo al registrar pago.
- Base para ingresos y facturacion.

### Registra

Tabla `cuentas_corrientes_clientes`:

- `id`: identificador.
- `cliente_id`: cliente.
- `saldo_deudor`: saldo pendiente.
- `limite_credito`: limite de credito.

Tabla `pagos_clientes`:

- `id`: identificador.
- `cliente_id`: cliente.
- `pedido_id`: pedido.
- `monto`: importe pagado.
- `fecha`: fecha.
- `metodo_pago`: metodo.
- `referencia_comprobante`: comprobante.
- `usuario_id`: usuario.

### Puede hacer

- Consultar cuenta de un cliente.
- Registrar pagos.
- Disminuir saldo deudor al aplicar pago.
- Relacionar pagos con pedidos.

## 15. RRHH

### Funciones

- Gestion de empleados.
- Asistencias.
- Licencias.
- Nomina.
- Capacitaciones.
- Indicadores de RRHH.
- Alertas por contratos y capacitaciones proximas a vencer.

### Registra

Tabla `rrhh_empleados`:

- `id`, `nombre`, `documento`, `telefono`, `email`, `cargo`, `area`, `sucursal_id`, `fecha_ingreso`, `salario_base`, `estado`, `vencimiento_contrato`, `contacto_emergencia`, `observaciones`.

Tabla `rrhh_asistencias`:

- `id`, `empleado_id`, `fecha`, `entrada`, `salida`, `tipo`, `estado`, `observaciones`.

Tabla `rrhh_licencias`:

- `id`, `empleado_id`, `tipo`, `fecha_inicio`, `fecha_fin`, `estado`, `motivo`.

Tabla `rrhh_nomina`:

- `id`, `empleado_id`, `periodo`, `salario_base`, `horas_extra`, `bonificaciones`, `descuentos`, `total_neto`, `estado`, `fecha_pago`.

Tabla `rrhh_capacitaciones`:

- `id`, `empleado_id`, `tema`, `fecha`, `vencimiento`, `resultado`, `certificado_url`, `observaciones`.

### Puede hacer

- Crear, listar, editar e inactivar empleados.
- Registrar, editar y borrar asistencias.
- Registrar, editar y borrar licencias.
- Registrar, editar y borrar nomina.
- Registrar, editar y borrar capacitaciones.
- Calcular resumen de empleados activos, presentes, permisos, nomina pendiente y masa salarial.

## 16. Gestion integral operativa

### Funciones

- Proveedores.
- Compras.
- Mantenimiento de vehiculos.
- Incidencias operativas.
- Inventario de deposito.
- Tarifarios.
- Contratos de clientes.
- Resumen gerencial de gestion.

### Proveedores

Tabla `proveedores`:

- `id`, `nombre`, `ruc`, `telefono`, `email`, `direccion`, `categoria`, `contacto`, `estado`, `observaciones`.

Funciones:

- Crear proveedor.
- Listar proveedores.
- Editar proveedor.
- Inactivar proveedor.

### Compras

Tabla `compras`:

- `id`, `proveedor_id`, `fecha`, `concepto`, `categoria`, `monto`, `estado`, `metodo_pago`, `comprobante`, `observaciones`.

Funciones:

- Crear compra.
- Listar compras con proveedor.
- Editar compra.
- Eliminar compra.

### Mantenimientos

Tabla `mantenimientos_vehiculo`:

- `id`, `vehiculo_id`, `proveedor_id`, `tipo`, `descripcion`, `fecha_programada`, `fecha_realizada`, `kilometraje_programado`, `costo_estimado`, `costo_real`, `prioridad`, `estado`, `observaciones`.

Funciones:

- Crear mantenimiento.
- Listar mantenimientos con vehiculo y proveedor.
- Editar mantenimiento.
- Eliminar mantenimiento.
- Priorizar mantenimientos.
- Controlar costos estimados y reales.

### Incidencias operativas

Tabla `incidencias_operativas`:

- `id`, `tipo`, `referencia_tipo`, `referencia_id`, `cliente_id`, `pedido_id`, `viaje_id`, `prioridad`, `estado`, `titulo`, `descripcion`, `fecha_reporte`, `fecha_cierre`, `responsable`, `resolucion`.

Funciones:

- Crear incidencia.
- Listar incidencias con cliente, pedido y viaje.
- Editar incidencia.
- Eliminar incidencia.
- Gestionar prioridad y estado.

### Inventario de deposito

Tabla `inventario_deposito`:

- `id`, `sucursal_id`, `codigo`, `descripcion`, `categoria`, `cantidad`, `unidad`, `ubicacion`, `estado`, `fecha_actualizacion`, `observaciones`.

Funciones:

- Crear item.
- Listar inventario con sucursal.
- Editar item.
- Eliminar item.
- Detectar bajo stock por estado o cantidad.

### Tarifarios

Tabla `tarifarios`:

- `id`, `nombre`, `origen_sucursal_id`, `destino_sucursal_id`, `tipo_carga`, `modalidad`, `precio_base`, `precio_kg`, `precio_m3`, `seguro_porcentaje`, `vigencia_desde`, `vigencia_hasta`, `estado`.

Funciones:

- Crear tarifario.
- Listar tarifarios con origen y destino.
- Editar tarifario.
- Inactivar tarifario.
- Definir precios por base, kilo, metro cubico y seguro.

### Contratos

Tabla `contratos_clientes`:

- `id`, `cliente_id`, `nombre`, `fecha_inicio`, `fecha_fin`, `condicion_pago`, `limite_credito`, `tarifario_id`, `estado`, `observaciones`.

Funciones:

- Crear contrato.
- Listar contratos con cliente y tarifario.
- Editar contrato.
- Inactivar contrato.
- Registrar condicion de pago y limite de credito.

## 17. Reportes

### Funciones

- Reporte de rentabilidad.
- Indicadores de ingresos, egresos, rentabilidad y viajes.
- Base para reportes financieros.

### Datos calculados actualmente

- `total_ingresos`.
- `total_egresos`.
- `rentabilidad`.
- `viajes`.

## 18. Integraciones y utilidades

### Parseo de links de mapas

Endpoint utilitario para recibir un link de mapas y devolver coordenadas simuladas:

- `latitud`.
- `longitud`.

### Evidencias

Permite registrar evidencia asociada a pedidos:

- Pedido.
- Tipo.
- Foto.
- Fecha.

## 19. Estados principales del flujo operativo

### Pedido

- `borrador`.
- `registrado`.
- `pendiente_planificacion`.
- `planificado`.
- `en_transito`.
- `recolectado`.
- `entregado`.
- `devuelto`.
- `cancelado`.

### Viaje

- `planificado`.
- `en_curso`.
- `llegada_retiro`.
- `llegada_sucursal`.
- `con_incidencia`.
- `finalizado`.
- `cancelado`.

### Vehiculo

- `disponible`.
- `en viaje`.

### Rendicion

- `pendiente`.
- Otros estados operativos segun administracion.

## 20. APK de choferes

El APK debug generado queda en:

- `app-chofer-debug.apk`
- `app-chofer/android/app/build/outputs/apk/debug/app-debug.apk`

Notas:

- Es un APK debug para instalacion directa y pruebas.
- Para produccion conviene generar una variante release firmada.
- La impresora debe estar emparejada previamente desde Android.
- En Android 12 o superior la app solicita permiso `BLUETOOTH_CONNECT`.
- Algunas impresoras termicas usan cortes de papel no compatibles; el plugin envia corte ESC/POS estandar y deja salto de linea aunque el corte no sea soportado.
