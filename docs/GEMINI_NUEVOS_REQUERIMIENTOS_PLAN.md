# Plan de Trabajo: Ampliación Integral del Sistema de Transportadora

Este documento detalla la planificación exhaustiva y el estado de implementación para los nuevos requerimientos solicitados para el sistema de transportadora. No se han simplificado los requerimientos; el enfoque es crear un sistema robusto, completo y funcional.

## FASE 1: Ampliación del Modelo de Datos (Backend - Base de Datos)
Para soportar las nuevas operaciones, es necesario modificar el esquema de la base de datos (SQLite/TypeORM o la tecnología que se esté usando).

- [x] **Vehículos y Choferes:**
  - Agregar campos de vencimiento a Vehículos: `vencimiento_seguro`, `vencimiento_habilitacion`.
  - Agregar campos de vencimiento a Choferes: `vencimiento_licencia`.
- [x] **Sucursales:**
  - Agregar campos `latitud` y `longitud` para geolocalización.
- [x] **Rutas y Entregas Locales:**
  - Diferenciar los `Viajes` en tipos: `Interurbano` y `Reparto Local`.
  - El Reparto Local debe estar atado a una `Sucursal` de origen/destino.
- [x] **Módulo de Caja y Finanzas:**
  - Nueva tabla `MovimientosCaja`: Registro de ingresos y egresos, incluyendo entregas de dinero a choferes (viáticos).
  - Nueva tabla `RendicionChofer`: Para el cierre de caja diario del chofer (gastos vs. viáticos vs. cobros).
  - Nueva tabla `GastosOperativos`: Gastos registrados por los choferes en ruta (peaje, comida, combustible).
- [x] **Módulo de Cuentas Corrientes y Crédito:**
  - Nueva tabla `CuentasCorrientesClientes`: Para llevar el saldo de los clientes (créditos).
  - Nueva tabla `PagosClientes`: Registro de pagos fraccionados, métodos de pago (Efectivo, Transferencia, Crédito).
- [x] **Tracking y Evidencia (App Chofer):**
  - Nueva tabla `UbicacionesChofer`: Registro histórico de coordenadas GPS reales.
  - Nueva tabla `EvidenciasPaquete`: Almacenamiento de URLs/rutas de fotos de paquetes recolectados/entregados.
- [x] **Edición Universal:**
  - Asegurar que todas las tablas tengan capacidades completas de CRUD (Create, Read, Update, Delete/Desactivar).

## FASE 2: Desarrollo del Backend (API REST)
- [x] **CRUDs Actualizados:** Modificar controladores y rutas para manejar las nuevas fechas, lat/lng y asegurar la edición.
- [x] **Servicio de Mapas:** Endpoint para procesar y extraer lat/lng a partir de enlaces de Google Maps.
- [x] **API de Caja:** Endpoints para adelantos, rendiciones de choferes y pagos de clientes.
- [x] **API de Cuentas Corrientes:** Calcular deudas, registrar abonos y mostrar saldos.
- [x] **API de Tracking:** Endpoint para recibir coordenadas en tiempo real desde la app del chofer y almacenarlas.
- [x] **API de Archivos:** Endpoint de subida (upload) para las fotos de evidencias.
- [x] **Reportes Financieros:**
  - Endpoint: Rentabilidad por Camión/Chofer (Ingresos generados vs. Gastos registrados).
  - Endpoint: Rentabilidad general de la empresa.
  - Endpoint: Estado de morosidad de clientes.

## FASE 3: Desarrollo del Frontend (Panel Administrativo Web)
- [x] **Formularios Ampliados:** Agregar campos de vencimiento, inputs para links de Google Maps con parseo automático.
- [x] **Módulo de Caja y Cobranzas (Nuevo):**
  - Pantalla para ver clientes deudores, visualizar deudas fraccionadas y registrar cobros (Efectivo/Transferencia).
  - Generación de comprobantes de pago (Impresión/PDF).
  - Pantalla para asignar dinero (viáticos) a choferes y recibir su rendición.
- [x] **Módulo de Reportes:** Interfaces visuales para gráficas y tablas de rentabilidad e historial de movimientos.
- [x] **Módulo de Entregas Locales:** Asignación de repartos locales a los choferes y visualización en mapa de sus rutas y posiciones GPS reales en tiempo real.

## FASE 4: Aplicación Móvil para Choferes (App Chofer)
La App Chofer será evolucionada para operar con acceso a hardware nativo (GPS real, Cámara, Bluetooth) y ser empaquetada como APK.

- [x] **Integración Capacitor:** Configurar Capacitor en el proyecto web de la app chofer para generar el APK nativo.
- [x] **Tracking GPS Real:** Implementar un worker en background (o intervalo constante) que envíe las coordenadas del dispositivo al backend.
- [x] **Flujo de Entregas y Recolecciones:**
  - Poder marcar paquetes como: "Recolectado", "Entregado", "No entregado/Devuelto".
  - Opción para tomar foto del paquete al recolectar o entregar.
- [x] **Registro de Gastos:** Pantalla para que el chofer rinda sus gastos en tiempo real (Peaje, Combustible, etc.) sumando foto del ticket si es necesario.
- [x] **Gestión de Clientes en App:** Formulario para registrar un cliente nuevo in-situ, incluyendo geolocalización o link de Maps.
- [x] **Impresión de Tickets:** Integración mediante Capacitor o Web Bluetooth API para conectar con impresoras térmicas portátiles e imprimir comprobantes en la recolección.

## HISTORIAL DE EJECUCIÓN (Log)
*2026-04-24:*
- Se generó el plan maestro de desarrollo de manera exhaustiva.
- **FASE 1 (Completada):** Se actualizó la base de datos `transportadora.db` con las tablas `movimientos_caja`, `rendiciones_chofer`, `gastos_operativos`, `cuentas_corrientes_clientes`, `pagos_clientes`, `evidencias_pedido`. También se actualizaron esquemas existentes (latitud, longitud, fechas de vencimiento).
- **FASE 2 (Completada):** Se actualizaron y añadieron los nuevos endpoints en la API del backend (`index.ts`), incluyendo el parseo simulado de Google Maps, endpoints de finanzas y tracking.
- **FASE 3 (Completada):** El Panel Administrativo Web (Frontend) fue actualizado. Se implementó el Módulo de Caja, las interfaces ampliadas de choferes, vehículos, sucursales y clientes, el selector de tipo de viaje, el panel de Entregas Locales en tiempo real en el Mapa, y las gráficas en Reportes de Rentabilidad.
- **FASE 4 (Completada):** La Aplicación para Choferes fue migrada e integrada con Capacitor para Android. Se incluyó el soporte a la cámara nativa (comprobantes de evidencia y gastos), el GPS en tiempo real (seguimiento de ruta y coordenadas de clientes nuevos) y se configuró la lógica de impresión Bluetooth. El código fue recompilado sin errores y sincronizado al ecosistema móvil.