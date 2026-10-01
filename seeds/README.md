# Seeds iniciales

El proyecto incluye datos de demostración para facilitar el desarrollo local y las pruebas automatizadas.

## Desarrollo local

El backend SQLite puede crear un usuario demo conocido para que la suite E2E funcione sin configuración adicional. Estas credenciales son **solo para desarrollo/pruebas locales** y no deben reutilizarse en ningún entorno accesible públicamente.

Los tests existentes pueden asumir:

- usuario demo: `admin`;
- contraseña demo: `admin123`;
- rol: `superadmin_saas`;
- tenant: `Empresa Demo Transportadora`.

## Producción / Supabase

El bootstrap productivo no crea un administrador con una contraseña pública conocida. Para una base nueva, configura explícitamente:

```text
SEED_ADMIN_USERNAME
SEED_ADMIN_PASSWORD
```

`SEED_ADMIN_PASSWORD` debe tener al menos 12 caracteres cuando `NODE_ENV=production`.

Si esas variables no están presentes, el seed omite la creación del administrador en producción.

## Datos demo incluidos

- Tenant demo.
- Permisos SaaS.
- Roles RBAC.
- Sucursales demo.
- Clientes demo.
- Choferes demo.
- Vehículos demo.
- Pedido demo.
- Datos base de RRHH y gestión integral.

Para una instalación real conviene evolucionar estos seeds hacia migraciones/bootstrap controlados por entorno y no cargar datos demo en la base productiva.