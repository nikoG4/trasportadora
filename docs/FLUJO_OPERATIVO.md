# Flujo operativo

## Pedido

1. Se registra cliente pagador, remitente, destinatario, origen, destino, bultos, peso, valor y precio.
2. El pedido queda pendiente de planificacion o registrado.
3. Puede asignarse a viaje o ruta planificada.
4. Durante el viaje puede pasar por recolectado, en transito, entregado o devuelto.
5. La app chofer registra POD con foto, firma, observaciones y bultos reales.

## Viaje

1. Operaciones selecciona chofer, vehiculo, origen, destino y pedidos.
2. El sistema valida disponibilidad basica.
3. La app chofer inicia viaje.
4. Se registra tracking GPS.
5. El chofer gestiona paradas/pedidos.
6. El viaje se finaliza al completar entregas.

## Tracking

1. La app chofer envia latitud/longitud.
2. El backend guarda `tracking`.
3. El panel consulta ultima ubicacion.
4. La siguiente fase debe reemplazar polling por SSE/WebSocket.

## POD

1. Chofer abre gestion del pedido.
2. Selecciona estado.
3. Captura foto y firma.
4. Ingresa observaciones y bultos reales.
5. Se guarda en `pedidos`.
6. Puede imprimir comprobante de retiro si corresponde.

## Facturacion

1. Finanzas selecciona pedidos de un cliente.
2. Se genera `facturas`.
3. Se crean `factura_items`.
4. Se registra pago en `pagos_clientes`.
5. Se actualiza cuenta corriente.

## Rendicion

1. Chofer reporta gastos.
2. Finanzas revisa comprobantes.
3. Se crea o actualiza rendicion por viaje.
4. Se cruza monto recibido, gastado, cobrado y saldo entregado.
