# Sistema Transportadora

Este es un MVP de un sistema integral de paquetería y logística.

## Comandos Rápidos

En la raíz del proyecto (donde se ubica este README), debes instalar las dependencias generales con `npm install` la primera vez.

- Levantar todos los servicios:
  `npm run dev:all`
  Esto iniciará el backend en el puerto `3001` y los 3 frontends en distintos puertos asignados por Vite.

- Construir frontends para producción:
  `npm run build:all`

- Ejecutar las pruebas E2E (Asegúrate de que `dev:all` esté corriendo y las dependencias de `/e2e-tests` estén instaladas):
  `npm run test:e2e`

## Estructura
- `/backend`: Servidor Node + Express + SQLite.
- `/frontend`: Panel administrativo SaaS (Vite + React).
- `/app-chofer`: Aplicación móvil/PWA para transportistas (Vite + React).
- `/landing-saas`: Landing page del sistema (Vite + React).
- `/e2e-tests`: Suite de pruebas automatizadas en Playwright.