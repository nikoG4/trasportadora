# Documentación base para agentes — Sistema de transportadora en Paraguay

## 1. Resumen del producto

Este documento define la base funcional, técnica y operativa de un sistema para una transportadora en Paraguay. Está pensado para que cualquier agente de IA, desarrollador, analista funcional, diseñador UX/UI, arquitecto de software o PM pueda arrancar el trabajo sin depender de contexto adicional.

El sistema debe cubrir la operación principal de una empresa transportadora de cargas con flota propia y/o tercerizada, gestión de pedidos, despacho, seguimiento de entregas, control de conductores, administración de vehículos, mantenimiento, alertas, trazabilidad y rastreo GPS tanto de pedidos como de la flota.

## 2. Decisión de alcance actual

### 2.1 En alcance
- Gestión de clientes
- Gestión de pedidos de transporte
- Gestión de flota
- Gestión de conductores
- Asignación y despacho
- Rastreo GPS de pedidos
- Rastreo GPS de flota
- Control de estados del viaje
- Prueba de entrega (POD)
- Incidencias y novedades en ruta
- Mantenimiento preventivo y correctivo
- Control documental de vehículos y choferes
- Tarifas y cotizaciones
- Liquidación operativa básica
- Reportes y paneles
- Portal o vista para clientes
- Notificaciones y alertas
- Gestión de sucursales, depósitos o bases operativas

### 2.2 Fuera de alcance por ahora
- Facturación electrónica
- Integración con SIFEN
- Contabilidad avanzada
- Nómina completa
- Aduana avanzada
- WMS complejo de almacenes
- Optimización avanzada con IA desde la primera versión

### 2.3 Motivo de exclusión temporal de facturación electrónica
La facturación electrónica se elimina por ahora para reducir complejidad técnica, regulatoria y de integración. El sistema sí debe quedar preparado para integrar facturación más adelante, pero en esta etapa solo manejará:
- prefactura interna
- liquidación operativa
- cuentas por cobrar simples
- exportación de datos para facturación externa

## 3. Objetivo del sistema

Centralizar la operación de transporte de una empresa paraguaya en una única plataforma, permitiendo planificar, ejecutar, monitorear y auditar los pedidos y movimientos de la flota en tiempo real, mejorando trazabilidad, control operativo, tiempos de respuesta y visibilidad para el cliente.

## 4. Tipo de empresa objetivo

Empresa transportadora de cargas con estas características típicas:
- opera a nivel urbano, interurbano o nacional
- tiene entre 5 y 300 vehículos
- posee choferes propios y/o tercerizados
- recibe pedidos de clientes corporativos
- necesita seguimiento en ruta
- quiere controlar vencimientos, mantenimiento y estado de su flota
- desea mostrar tracking a clientes o al menos a operadores internos

## 5. Problemas que resuelve

- Falta de visibilidad de dónde está cada vehículo
- Dificultad para saber el estado real de cada pedido
- Seguimiento manual por llamadas o WhatsApp
- Pérdida de tiempo en asignación de viajes
- Escasa trazabilidad de incidentes
- Falta de control sobre documentos vencidos
- Mantenimiento reactivo en lugar de preventivo
- Información dispersa en Excel, chats y cuadernos
- Dificultad para medir cumplimiento y productividad

## 6. Usuarios del sistema

### 6.1 Administrador general
Gestiona configuración, usuarios, permisos, catálogos y parámetros.

### 6.2 Operador logístico / tráfico
Carga pedidos, planifica viajes, asigna choferes y vehículos, monitorea estados e incidencias.

### 6.3 Supervisor de operaciones
Ve paneles, excepciones, KPIs y desempeño de flota/pedidos.

### 6.4 Encargado de flota
Gestiona vehículos, mantenimientos, neumáticos, combustible y documentos.

### 6.5 Chofer
Usa app móvil para ver viajes, iniciar trayecto, reportar novedades, compartir ubicación y registrar entrega.

### 6.6 Cliente
Consulta estado de sus pedidos, tracking, evidencias y entregas.

### 6.7 Taller / mantenimiento
Carga órdenes de trabajo, diagnósticos, repuestos y salidas de servicio.

### 6.8 Auditor o backoffice
Consulta historial, bitácoras, documentos y reportes.

## 7. Módulos del sistema

## 7.1 Módulo de autenticación y permisos
Debe permitir:
- login seguro
- recuperación de contraseña
- perfiles por rol
- permisos granulares
- auditoría de acceso
- sesiones activas

## 7.2 Módulo de clientes
Debe permitir:
- alta, baja lógica y edición de clientes
- datos fiscales y comerciales básicos
- direcciones de carga y descarga
- contactos
- observaciones operativas
- condiciones comerciales básicas
- historial de pedidos

## 7.3 Módulo de conductores
Debe permitir:
- registrar choferes
- vincularlos a vehículos o tipos de unidad
- controlar licencias y vencimientos
- guardar documentos y fotos
- registrar disponibilidad
- ver historial de viajes
- ver incidencias asociadas

## 7.4 Módulo de flota
Debe permitir:
- alta de vehículos
- clasificación por tipo
- chapa, marca, modelo, año, capacidad, volumen, ejes
- estado operativo
- asignación actual
- documentos y vencimientos
- historial de mantenimiento
- estado GPS
- ubicación actual y última transmisión

## 7.5 Módulo de pedidos
Debe permitir:
- crear pedido de transporte
- origen y destino
- fecha/hora prevista
- tipo de carga
- peso/volumen
- cantidad de bultos
- requerimientos especiales
- cliente asociado
- prioridad
- observaciones
- documentos adjuntos

Estados sugeridos del pedido:
- borrador
- pendiente de planificación
- planificado
- asignado
- en retiro
- en tránsito
- en entrega
- entregado
- entregado con novedad
- cancelado

## 7.6 Módulo de planificación y despacho
Debe permitir:
- asignar vehículo y chofer
- consolidar pedidos en un viaje si aplica
- estimar horarios
- cambiar secuencia de paradas
- reasignar ante contingencias
- visualizar viajes activos
- generar hoja de ruta digital

## 7.7 Módulo de rastreo GPS
Este módulo es crítico y debe cubrir dos niveles:

### A. Rastreo GPS de flota
Debe mostrar:
- ubicación actual de cada vehículo
- historial de recorridos
- última conexión
- velocidad estimada
- estado de motor si el proveedor lo soporta
- geocercas
- alertas por desvío o detención prolongada

### B. Rastreo GPS de pedidos
Debe permitir relacionar el pedido con el viaje y el vehículo asignado para mostrar:
- ubicación estimada del pedido en tiempo real
- ETA estimada
- hitos del recorrido
- estado actual del transporte
- trazabilidad completa desde retiro hasta entrega

### Reglas importantes del tracking
- Un pedido solo puede tener tracking GPS si está vinculado a un viaje activo.
- Un viaje puede agrupar uno o varios pedidos.
- El tracking del pedido deriva del tracking del vehículo, más lógica de paradas y estados.
- Debe existir histórico de coordenadas y eventos.
- Debe permitirse integración con proveedores GPS externos mediante adaptadores.

## 7.8 Módulo de incidencias
Debe permitir registrar:
- retraso
- ausencia del destinatario
- avería mecánica
- accidente
- desvío de ruta
- rechazo de mercadería
- entrega parcial
- problema documental
- problema de carga
- problema de temperatura si aplica

Cada incidencia debe tener:
- tipo
- fecha/hora
- ubicación
- usuario que reporta
- descripción
- fotos o archivos
- estado
- resolución

## 7.9 Módulo de prueba de entrega (POD)
Debe permitir:
- firma digital simple
- foto de entrega
- nombre y documento del receptor
- fecha y hora real
- observaciones
- entrega parcial o total
- evidencia adjunta

## 7.10 Módulo de mantenimiento
Debe permitir:
- plan preventivo por km, fecha o uso
- correctivos
- órdenes de trabajo
- repuestos
- costos
- proveedor/taller
- tiempos fuera de servicio
- calendario de mantenimientos
- alertas automáticas

## 7.11 Módulo documental
Debe centralizar documentos de:
- vehículos
- choferes
- clientes
- pedidos
- viajes
- entregas
- mantenimientos

Debe soportar:
- subida de archivos
- categorización
- vencimientos
- alertas
- vista previa
- historial de versiones si se decide implementar

## 7.12 Módulo de reportes y dashboard
Debe incluir al menos:
- pedidos por estado
- viajes activos
- entregas a tiempo
- entregas demoradas
- utilización de flota
- vehículos fuera de servicio
- incidencias por tipo
- tiempos promedio por ruta
- mantenimiento vencido o próximo
- tracking de unidades activas

## 7.13 Módulo portal cliente
Debe permitir al cliente:
- ver sus pedidos
- ver estado actual
- consultar tracking
- descargar POD si existe
- ver historial
- recibir notificaciones

## 8. Procesos principales

## 8.1 Flujo de pedido a entrega
1. El operador crea el pedido.
2. El pedido queda pendiente de planificación.
3. El operador o despachador asigna vehículo y chofer.
4. Se genera un viaje.
5. El chofer recibe la tarea en su app.
6. Se inicia el retiro.
7. El sistema comienza a asociar tracking GPS del vehículo al pedido.
8. El pedido cambia a en tránsito.
9. Se actualizan hitos y ETA.
10. Se registra entrega o novedad.
11. Se cierra el viaje.
12. Se consolida historial y evidencia.

## 8.2 Flujo de mantenimiento
1. Se registra vehículo.
2. Se parametrizan mantenimientos preventivos.
3. El sistema alerta vencimiento o kilometraje.
4. Se crea orden de trabajo.
5. Se ejecuta mantenimiento.
6. Se cargan costos y repuestos.
7. Se actualiza disponibilidad del vehículo.

## 8.3 Flujo de monitoreo GPS
1. El proveedor GPS envía eventos de ubicación.
2. El adaptador del sistema normaliza la data.
3. Se identifica vehículo asociado.
4. Si el vehículo tiene viaje activo, se actualiza tracking del viaje.
5. Si el viaje tiene pedidos asociados, se actualiza tracking del pedido.
6. Se recalcula ETA y reglas de alerta.
7. Se guarda histórico.

## 9. Requerimientos funcionales detallados

## 9.1 Requerimientos del pedido
- RF-001: El sistema debe permitir crear pedidos manualmente.
- RF-002: El sistema debe permitir editar pedidos mientras no hayan sido cerrados.
- RF-003: El sistema debe permitir cancelar pedidos.
- RF-004: El sistema debe permitir adjuntar documentos al pedido.
- RF-005: El sistema debe permitir ver historial completo del pedido.

## 9.2 Requerimientos de despacho
- RF-006: El sistema debe permitir asignar chofer y vehículo a un pedido o conjunto de pedidos.
- RF-007: El sistema debe permitir reasignar viaje por contingencia.
- RF-008: El sistema debe mostrar viajes activos en tiempo real.
- RF-009: El sistema debe soportar múltiples paradas por viaje.

## 9.3 Requerimientos de GPS
- RF-010: El sistema debe recibir posiciones GPS desde integraciones externas.
- RF-011: El sistema debe mostrar la posición actual del vehículo en mapa.
- RF-012: El sistema debe conservar historial de posiciones.
- RF-013: El sistema debe asociar tracking del vehículo al viaje activo.
- RF-014: El sistema debe asociar tracking del viaje a los pedidos del viaje.
- RF-015: El sistema debe calcular ETA básica según posición y destino.
- RF-016: El sistema debe generar alertas por pérdida de señal, desvío o parada prolongada.

## 9.4 Requerimientos de POD
- RF-017: El sistema debe registrar entrega con fecha y hora real.
- RF-018: El sistema debe permitir carga de foto y firma.
- RF-019: El sistema debe soportar entregas parciales.

## 9.5 Requerimientos de mantenimiento
- RF-020: El sistema debe programar mantenimientos preventivos.
- RF-021: El sistema debe registrar correctivos.
- RF-022: El sistema debe marcar vehículo fuera de servicio cuando corresponda.

## 9.6 Requerimientos documentales
- RF-023: El sistema debe alertar vencimientos de documentos.
- RF-024: El sistema debe impedir asignación de chofer o vehículo con documento crítico vencido si así se configura.

## 10. Requerimientos no funcionales

- RNF-001: El sistema debe ser web responsive para backoffice.
- RNF-002: Debe existir app móvil o PWA para choferes.
- RNF-003: El tracking en pantalla operativa debe refrescarse casi en tiempo real.
- RNF-004: El sistema debe ser escalable por módulos.
- RNF-005: Debe soportar auditoría de acciones críticas.
- RNF-006: Debe permitir operación básica offline en móvil y sincronización posterior.
- RNF-007: Debe tener arquitectura preparada para integraciones externas.
- RNF-008: Debe manejar permisos por rol.
- RNF-009: Debe ser multi-sucursal.
- RNF-010: Debe permitir despliegue cloud.

## 11. Entidades principales del dominio

- Cliente
- Contacto
- Dirección
- Chofer
- Vehículo
- TipoVehículo
- Documento
- Pedido
- Viaje
- Parada
- EventoTracking
- Incidencia
- Entrega
- Mantenimiento
- OrdenTrabajo
- Usuario
- Rol
- Sucursal
- Depósito
- Tarifa

## 12. Relaciones clave

- Un cliente tiene muchos pedidos.
- Un pedido puede pertenecer a un viaje.
- Un viaje puede incluir uno o muchos pedidos.
- Un viaje tiene un chofer principal.
- Un viaje tiene un vehículo principal.
- Un vehículo genera muchos eventos GPS.
- Un pedido hereda tracking del viaje/vehículo asignado.
- Un vehículo tiene muchos mantenimientos.
- Un chofer y un vehículo tienen documentos con vencimiento.

## 13. Reglas de negocio clave

- No se puede iniciar un viaje sin chofer y vehículo asignados.
- Un vehículo no debe estar en dos viajes activos incompatibles al mismo tiempo.
- Un pedido entregado no puede volver a estado anterior salvo con permiso especial.
- Si un vehículo queda fuera de servicio, el sistema debe alertar los viajes afectados.
- El tracking de pedido debe depender del viaje activo y no de un GPS “propio del pedido”.
- Si no hay señal GPS reciente, el sistema debe marcar tracking degradado.
- Un documento crítico vencido puede bloquear asignación según configuración.

## 14. Arquitectura sugerida

### 14.1 Frontends
- Backoffice web
- Portal cliente web
- App móvil/PWA para chofer

### 14.2 Backend
- API principal
- servicio de tracking
- servicio de notificaciones
- servicio documental
- servicio de reportes

### 14.3 Integraciones
- proveedores GPS
- email
- WhatsApp o SMS opcional a futuro
- mapas/geocoding

### 14.4 Base de datos
- base relacional para núcleo transaccional
- almacenamiento de archivos para documentos y evidencias
- componente de cache/cola para tracking y eventos

## 15. Integración GPS — lineamientos técnicos para agentes

### Objetivo
Construir una capa desacoplada para consumir distintos proveedores GPS sin reescribir la lógica del negocio.

### Estrategia
- Crear una interfaz común `GpsProviderAdapter`
- Normalizar todos los eventos entrantes al mismo formato interno
- Guardar posición, timestamp, velocidad, heading, ignición, fuente y precisión si existe
- Separar ingestión de GPS del dominio de pedidos

### Evento interno de tracking sugerido
- vehicleId
- deviceId
- provider
- latitude
- longitude
- speed
- heading
- eventTime
- receivedAt
- ignitionStatus
- rawPayload

### Casos de uso del tracking
- mapa de flota en vivo
- mapa de viaje en curso
- vista cliente del pedido
- alertas por desvío
- tiempo detenido
- reconstrucción de ruta histórica

## 16. Paneles sugeridos

### Panel operativo
- viajes en curso
- pedidos críticos
- unidades detenidas
- atrasos
- incidencias abiertas

### Panel de flota
- disponibilidad
- mantenimientos próximos
- estado documental
- últimas posiciones

### Panel cliente
- pedidos abiertos
- pedidos entregados
- ETA
- POD disponibles

## 17. Alertas sugeridas

- GPS sin señal X minutos
- vehículo detenido más de Y minutos
- salida de geocerca
- retraso frente a ETA
- documento por vencer
- mantenimiento próximo
- viaje sin actualizar estado
- entrega con novedad

## 18. Backlog sugerido por fases

## Fase 1 — MVP realista
- autenticación
- clientes
- choferes
- vehículos
- pedidos
- asignación básica
- viajes
- tracking GPS de flota
- tracking GPS de pedidos
- estados de viaje
- incidencias
- POD básico
- dashboard operativo básico

## Fase 2
- documentos y vencimientos
- mantenimiento preventivo/correctivo
- portal cliente
- reportes más completos
- notificaciones automáticas

## Fase 3
- tarifas
- cotizaciones
- liquidación operativa
- geocercas avanzadas
- reglas automáticas de alertas
- analítica avanzada

## 19. Historias de usuario base

- Como operador, quiero crear un pedido para luego asignarlo a una unidad.
- Como despachador, quiero ver qué vehículos están disponibles para asignar un viaje.
- Como supervisor, quiero ver en mapa dónde está cada unidad activa.
- Como cliente, quiero rastrear mi pedido sin llamar por teléfono.
- Como chofer, quiero ver mis viajes y reportar una novedad desde el móvil.
- Como encargado de flota, quiero saber qué documentos y mantenimientos están por vencer.

## 20. Definición de éxito del producto

El sistema será exitoso si logra:
- reducir llamadas manuales de seguimiento
- aumentar visibilidad operativa
- mejorar puntualidad de entrega
- disminuir asignaciones erróneas
- centralizar información de flota y viajes
- ofrecer tracking entendible tanto interno como para clientes

## 21. Instrucciones para cualquier agente que tome este proyecto

### Si eres agente analista funcional
Debes convertir esta base en:
- casos de uso
- matriz de requerimientos
- reglas de negocio formalizadas
- prototipo funcional por módulo

### Si eres agente UX/UI
Debes diseñar:
- backoffice de operaciones
- mapa de tracking
- app de chofer
- portal cliente
priorizando rapidez, legibilidad y uso móvil.

### Si eres agente backend
Debes construir primero:
- autenticación
- maestros
- pedidos/viajes
- tracking GPS
- incidencias
- POD
con arquitectura modular.

### Si eres agente frontend
Debes priorizar:
- tablero operativo
- ABM de maestros
- mapa en tiempo real
- detalle del pedido
- app móvil de chofer

### Si eres agente de datos
Debes modelar:
- pedidos
- viajes
- eventos GPS
- mantenimientos
- documentos
- incidencias
- entregas

### Si eres agente PM
Debes dividir el proyecto en entregables pequeños, medibles y con dependencia clara, arrancando por el MVP.

## 22. Restricciones actuales del proyecto

- No implementar todavía facturación electrónica.
- No asumir integraciones gubernamentales en esta etapa.
- No sobrediseñar el sistema con microservicios innecesarios desde el día 1.
- No mezclar tracking GPS con lógica contable.
- No depender de un solo proveedor GPS en el diseño.

## 23. Prompt corto de contexto para otros agentes

Estamos construyendo un sistema para una transportadora en Paraguay. En esta etapa el alcance incluye clientes, pedidos, viajes, despacho, choferes, flota, mantenimiento, incidencias, POD y rastreo GPS de pedidos y flota. La facturación electrónica queda excluida por ahora. El sistema debe permitir seguir un pedido en tiempo real a partir del GPS del vehículo asignado, gestionar la operación diaria y centralizar la trazabilidad completa del transporte.

