# API publica

## Estado

La API publica para clientes externos esta disenada pero no debe exponerse en produccion hasta completar API keys, scopes, webhooks y tenant isolation estricto en todos los endpoints.

## Endpoints internos ya disponibles como base

- `POST /api/login`
- `POST /api/auth/refresh`
- `GET /api/me`
- `POST /api/rutas/optimizar`
- `POST /api/rutas`
- `GET /api/rutas/:id`
- `POST /api/facturas`
- `GET /api/alertas`
- `POST /api/alertas`
- `GET /api/auditoria`

## Diseno API keys

Tabla futura:

- `api_keys`: tenant, cliente, nombre, key_hash, scopes_json, estado, fechas.

Scopes:

- `pedidos.create`
- `pedidos.read`
- `tracking.read`
- `tarifas.read`
- `webhooks.manage`

## Webhooks planificados

- `pedido.creado`
- `pedido.recolectado`
- `pedido.en_transito`
- `pedido.entregado`
- `pedido.devuelto`
- `factura.generada`
