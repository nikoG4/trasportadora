# Seeds iniciales

El seed inicial se ejecuta actualmente desde `backend/src/db.ts` para mantener compatibilidad con el proyecto existente.

Credenciales iniciales:

- Usuario: `admin`
- Contrasena: `admin123`
- Rol: `superadmin_saas`
- Tenant: `Empresa Demo Transportadora`

Datos incluidos:

- Tenant demo.
- Permisos SaaS.
- Roles RBAC.
- Usuario superadmin.
- Sucursales demo.
- Clientes demo.
- Choferes demo.
- Vehiculos demo.
- Pedido demo.
- Datos base de RRHH y gestion integral.

Para produccion se debe cambiar la contrasena inicial inmediatamente y mover el seed a migraciones controladas por entorno.
