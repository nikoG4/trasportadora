# Informe Técnico-Funcional: Evolución del Sistema de Transportadora (SaaS)

## 1. Estado Inicial (Auditoría)
El sistema partía de un MVP (Producto Mínimo Viable) muy básico que si bien permitía registrar clientes, choferes, vehículos y un tracking GPS rudimentario, carecía de la estructura y profundidad necesarias para operar una transportadora real en Paraguay. 

**Carencias estructurales detectadas:**
- Ausencia del concepto de "Sucursales" o "Agencias", impidiendo la logística entre nodos.
- Falta de distinción entre "Cliente Pagador", "Remitente" y "Destinatario".
- El Pedido no incluía detalles vitales como precio, tipo de pago, volumen, peso, o modalidades de retiro/entrega (puerta a puerta vs. sucursal).
- El Viaje no tenía concepto de origen y destino nodal (sucursales), y el flujo de estados era muy limitado.
- La App de Choferes no permitía capturar evidencia real (firma, foto) ni gestionar bultos o incidencias.
- Carencia de reportes financieros y operativos útiles.
- Ausencia de pruebas automatizadas (End-to-End).

---

## 2. Mejoras Implementadas (Fase 1 a 4)

### 2.1 Modelo de Datos y Backend (API)
Se rediseñó drásticamente el modelo de base de datos relacional (SQLite `transportadora.db`):
- **Sucursales:** Nueva entidad `sucursales` (id, nombre, código, dirección, ciudad, etc.).
- **Clientes:** Se agregaron campos de tipo (persona/empresa), email y condiciones comerciales.
- **Pedidos (Core):** Se amplió masivamente. Ahora un pedido relaciona: `cliente_pagador_id`, `sucursal_origen_id`, `sucursal_destino_id`. Incluye todos los datos de contacto y dirección del Remitente y Destinatario. Soporta modalidades (`modalidad_retiro`, `modalidad_entrega`), métricas logísticas (`cantidad_bultos`, `peso`, `volumen`, `valor_declarado`), detalles financieros (`precio`, `tipo_pago`) y un identificador único (`numero_guia`).
- **Estados de Pedido:** Borrador, Registrado, Pendiente de Retiro, En Sucursal Origen, En Tránsito, En Sucursal Destino, En Reparto, Entregado, Cancelado.
- **Viajes:** Integran ahora `sucursal_origen_id`, `sucursal_destino_id`, `costo_estimado` y un flujo de estados ampliado (Planificado, Cargando, En Ruta, Arribado, Finalizado, Con Incidencia).
- **POD (Proof of Delivery):** Se agregaron columnas para guardar la foto de entrega (base64), firma dibujada (base64), cantidad de bultos reales levantados y observaciones.
- **Gestión de Combustible y Configuraciones SaaS:** Tablas nuevas para registrar métricas de flota y el membrete de la empresa.

### 2.2 Frontend Backoffice (Panel de Administración)
- **Gestión de Sucursales:** Nuevo módulo CRUD para administrar la red de agencias.
- **Gestión de Pedidos Avanzada:** Formulario dividido en pestañas (Generales, Sujetos, Logística, Carga) para un UX ordenado.
- **Módulo de Impresión:** Se implementó lógica de impresión de "Guía de Envío" (formato limpio imprimible A4/Ticket) y "Manifiesto de Viaje" con soporte para membrete configurable.
- **Reportes:** Dashboard interactivo con reportes operativos (alertas de vencimiento de documentos a 30 días) y módulo financiero (registro de combustible e historial).
- **Roles y Permisos:** Acceso seguro con JWT, dividiendo la experiencia entre `Administrador` (SaaS, Reportes, Usuarios) y `Operador` (Logística diaria).

### 2.3 Frontend App Choferes (PWA)
Se transformó la aplicación móvil en una herramienta de operación de campo real:
- **Hitos de Viaje:** El chofer puede marcar "Llegada a Retiro" y "Llegada a Sucursal" para actualizar la trazabilidad de los paquetes.
- **Modal de POD Interactivo:** Al procesar un pedido, el chofer abre un panel para:
  1. Modificar la cantidad de bultos reales levantados.
  2. Tomar una Fotografía (usando la cámara del móvil).
  3. Capturar Firma (Canvas interactivo para que el cliente firme en pantalla).
  4. Agregar observaciones textuales.
- **Incidencias:** Botón rápido para reportar problemas mecánicos, demoras o accidentes, cambiando el estado del viaje al instante.
- **Impresión Bluetooth Directa:** Módulo experimental utilizando la API `Web Bluetooth` (`navigator.bluetooth`) para conectarse a impresoras térmicas portátiles y emitir comandas de retiro en el lugar.

### 2.4 Pruebas Automatizadas (QA / E2E)
- **Playwright:** Se instaló e inicializó el entorno de testing E2E en la carpeta `e2e-tests`.
- **Flujos Críticos Cubiertos:** Se automatizó el login de administrador, la creación secuencial de Sucursales, Clientes, Choferes, Vehículos, Pedidos y la Planificación de Viajes, validando el correcto funcionamiento en múltiples motores (Chromium, Firefox, WebKit).

---

## 3. Instrucciones de Ejecución

### 3.1 Levantar los Servicios
El proyecto cuenta con 4 servicios principales.
Desde la carpeta raíz del proyecto, debes iniciar los siguientes comandos en terminales separadas (o en segundo plano):

1. **Backend (API + Base de Datos):**
   ```bash
   cd backend
   npm run start
   # Corriendo en http://localhost:3001
   ```

2. **Frontend Admin (Backoffice):**
   ```bash
   cd frontend
   npm run dev
   # Corriendo en http://localhost:5173
   # Credenciales: admin / admin123
   ```

3. **App Choferes (PWA Móvil):**
   ```bash
   cd app-chofer
   npm run dev -- --port 5174
   # Corriendo en http://localhost:5174
   ```

4. **Landing Page SaaS (Opcional):**
   ```bash
   cd landing-saas
   npm run dev -- --port 5175
   # Corriendo en http://localhost:5175
   ```

### 3.2 Ejecutar las Pruebas (E2E)
Con el Frontend Admin y el Backend corriendo:
```bash
cd e2e-tests
npx playwright test
```

---

## 4. Lista de Pendientes (Backlog para Producción Real)

Si bien el sistema ahora es altamente competitivo y funcional, para salir a producción masiva (Go-Live) a nivel empresarial, se recomiendan los siguientes pasos:

1. **Infraestructura Cloud y Storage:**
   - Migrar el almacenamiento de fotos y firmas (actualmente Base64 en SQLite) a un bucket cloud (ej. AWS S3, Google Cloud Storage, Firebase) para no inflar la base de datos transaccional.
   - Migrar SQLite a una base de datos concurrente como PostgreSQL o MySQL.
2. **Facturación Electrónica (SIFEN):**
   - Integrar el endpoint de generación del KUDE (código de control) y firma XML según las regulaciones de la SET en Paraguay para la facturación electrónica.
3. **PWA y Offline-First (App Chofer):**
   - Implementar un `Service Worker` sólido (usando Workbox o Vite PWA plugin) para interceptar las llamadas al backend cuando no hay 4G en ruta, guardando las firmas y fotos en `IndexedDB` y sincronizándolas automáticamente al recuperar conexión.
4. **Motor de Tarifario Automático:**
   - Implementar una calculadora de tarifas dinámica en el Backend que defina el precio en base a un tarifario por zonas (ej. Asunción a CDE = X guaraníes el kilo, + tarifa base).
5. **App de Cliente Final:**
   - Crear un portal donde el cliente pagador o destinatario pueda rastrear su pedido ingresando el `número de guía`.
