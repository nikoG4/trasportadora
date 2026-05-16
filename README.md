# Sistema Transportadora

MVP de un sistema integral de paqueteria y logistica para transportadoras.

## Comandos Rapidos

En la raiz del proyecto, instala las dependencias generales la primera vez:

```bash
npm install
```

Levantar todos los servicios:

```bash
npm run dev:all
```

Esto inicia el backend en el puerto `3001` y los 3 frontends en puertos asignados por Vite.

Construir frontends para produccion:

```bash
npm run build:all
```

Ejecutar pruebas E2E:

```bash
npm run test:e2e
```

Antes de correr las pruebas, asegurate de que `npm run dev:all` este activo y que las dependencias de `/e2e-tests` esten instaladas.

## Estructura

- `/backend`: Servidor Node + Express + SQLite.
- `/frontend`: Panel administrativo SaaS con Vite + React.
- `/app-chofer`: Aplicacion movil/PWA para choferes con Vite + React + Capacitor.
- `/landing-saas`: Landing page del sistema con Vite + React.
- `/e2e-tests`: Suite de pruebas automatizadas en Playwright.
- `/docs`: Documentacion tecnica, funcional, despliegue y operacion.

## Documentacion

La documentacion fue unificada en un solo archivo:

- [Documentacion completa](docs/README.md)
