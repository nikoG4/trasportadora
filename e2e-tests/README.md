# E2E Tests con Playwright

Este directorio contiene las pruebas End-to-End (E2E) automáticas para la aplicación Transportadora SaaS utilizando Playwright.

## Requisitos Previos
- Node.js instalado.
- Backend en ejecución (`cd backend && npm start`).
- Frontend de Administración en ejecución en el puerto 5173 (`cd frontend && npm run dev`).

## Ejecutar las pruebas

1. Instalar dependencias y navegadores (si no se ha hecho aún):
   ```bash
   npm install
   npx playwright install
   ```

2. Ejecutar las pruebas:
   ```bash
   npx playwright test
   ```

3. Ver el reporte (opcional):
   ```bash
   npx playwright show-report
   ```

## Cobertura de la Prueba
El archivo `tests/admin-flow.spec.ts` cubre el flujo crítico principal del sistema:
- Inicio de sesión con credenciales de administrador (`admin` / `admin123`).
- Creación de Sucursales, Clientes, Vehículos y Choferes.
- Creación de Pedidos con datos válidos.
- Creación de Viajes y asignación de un pedido al viaje.
- Navegación y verificación de las pantallas de Dashboard y Reportes.
