const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const serverEntry = path.join(root, 'backend', 'dist', 'index.js');

if (!fs.existsSync(serverEntry)) {
  throw new Error('backend/dist/index.js no existe. Ejecuta primero: cd backend && npm run build');
}

const port = 32000 + Math.floor(Math.random() * 1000);
const baseUrl = `http://127.0.0.1:${port}/api`;
const workdir = fs.mkdtempSync(path.join(os.tmpdir(), 'transportadora-full-crud-'));

function startServer() {
  const child = spawn(process.execPath, [serverEntry], {
    cwd: workdir,
    env: {
      ...process.env,
      PORT: String(port),
      JWT_SECRET: 'full-crud-jwt-secret',
      REFRESH_TOKEN_SECRET: 'full-crud-refresh-secret',
      DATABASE_URL: ''
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let output = '';
  child.stdout.on('data', chunk => { output += chunk.toString(); });
  child.stderr.on('data', chunk => { output += chunk.toString(); });

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Servidor no inicio:\n${output}`)), 30000);
    child.on('exit', code => reject(new Error(`Servidor termino antes de tiempo (${code}):\n${output}`)));
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${baseUrl}/public/check-availability`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        });
        if (res.status < 500) {
          clearTimeout(timeout);
          clearInterval(interval);
          resolve(child);
        }
      } catch {}
    }, 250);
  });
}

async function request(pathname, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  let body = options.body;
  if (body !== undefined && typeof body !== 'string') {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
    body = JSON.stringify(body);
  }

  const res = await fetch(`${baseUrl}${pathname}`, {
    method: options.method || (body === undefined ? 'GET' : 'POST'),
    headers,
    body
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { res, data };
}

async function ok(pathname, options = {}) {
  const result = await request(pathname, options);
  assert.equal(result.res.ok, true, `${options.method || (options.body === undefined ? 'GET' : 'POST')} ${pathname} -> ${result.res.status}: ${JSON.stringify(result.data)}`);
  return result.data;
}

async function expectStatus(pathname, status, options = {}) {
  const result = await request(pathname, options);
  assert.equal(result.res.status, status, `${options.method || (options.body === undefined ? 'GET' : 'POST')} ${pathname} esperaba ${status}, recibio ${result.res.status}: ${JSON.stringify(result.data)}`);
  return result.data;
}

function assertHasId(value, label) {
  assert.ok(value && Number(value.id) > 0, `${label} debe devolver id: ${JSON.stringify(value)}`);
  return Number(value.id);
}

function assertListHas(rows, id, label) {
  assert.equal(Array.isArray(rows), true, `${label} debe devolver array`);
  assert.ok(rows.some(row => Number(row.id) === Number(id) || Number(row.cliente_id) === Number(id)), `${label} debe contener id ${id}: ${JSON.stringify(rows)}`);
}

async function crudRecord({ base, token, create, update, listLabel, deleteMethod = 'DELETE' }) {
  const created = await ok(base, { token, body: create });
  const id = assertHasId(created, `${base} create`);
  assertListHas(await ok(base, { token }), id, listLabel || base);
  await ok(`${base}/${id}`, { token, method: 'PUT', body: update });
  if (deleteMethod) {
    await ok(`${base}/${id}`, { token, method: deleteMethod });
  }
  return id;
}

(async () => {
  const server = await startServer();
  try {
    await expectStatus('/sucursales', 401);

    const unique = Date.now();
    const password = 'CrudTest123';
    const email = `crud-${unique}@example.com`;

    await ok('/public/check-availability', { body: { email_admin: email, dominio: `crud-${unique}.local` } });
    const register = await ok('/public/register-tenant', {
      body: {
        nombre_empresa: `CRUD Tenant ${unique}`,
        email_admin: email,
        password_admin: password,
        confirm_password: password,
        dominio: `crud-${unique}.local`
      }
    });
    assertHasId(register.tenant, 'tenant register');

    const login = await ok('/login', { body: { username: email, password } });
    const token = login.token;
    assert.ok(token, 'login debe devolver token');
    await ok('/me', { token });
    const refresh = await ok('/auth/refresh', { body: { refreshToken: login.refreshToken } });
    assert.ok(refresh.token, 'refresh debe devolver token');

    await ok('/configuracion', { token, method: 'PUT', body: { clave: 'moneda', valor: 'PYG' } });
    await ok('/configuracion/bulk', { token, method: 'PUT', body: { map_default_lat: '-25.5167', map_default_lng: '-54.6167', ticket_width_chars: '32' } });
    const config = await ok('/configuracion', { token });
    assert.ok(config.some(row => row.clave === 'moneda'), 'configuracion debe listar moneda');
    const header = await ok('/header-template', {
      token,
      method: 'PUT',
      body: {
        name: 'Membrete E2E',
        paperWidthDefault: 58,
        blocks: [{ type: 'TEXT', text: 'CRUD Tenant', visible: true, order: 1, alignment: 'CENTER', fontSize: 16, bold: true }]
      }
    });
    assert.equal(header.name, 'Membrete E2E');
    await ok('/header-template/logo', { token, body: { dataUrl: 'data:image/png;base64,iVBORw0KGgo=' } });

    const usuario = await ok('/usuarios', {
      token,
      body: { username: `operador-${unique}`, password: 'Operador123', role: 'operador', nombre: 'Operador E2E' }
    });
    assertHasId(usuario, 'usuario create');
    assertListHas(await ok('/usuarios', { token }), usuario.id, 'usuarios');
    await ok(`/usuarios/${usuario.id}`, { token, method: 'DELETE' });

    const sucursal = await ok('/sucursales', {
      token,
      body: {
        nombre: 'Sucursal E2E',
        codigo: 'ASU-01',
        direccion: 'Direccion sucursal',
        ciudad: 'Asuncion',
        departamento: 'Central',
        telefono: '021000000',
        responsable: 'Responsable',
        latitud: -25.3,
        longitud: -57.6
      }
    });
    const sucursalId = assertHasId(sucursal, 'sucursal create con codigo repetido cross-tenant');
    await ok(`/sucursales/${sucursalId}`, {
      token,
      method: 'PUT',
      body: { ...sucursal, nombre: 'Sucursal E2E Editada', codigo: 'ASU-01', ciudad: 'Asuncion' }
    });
    assertListHas(await ok('/sucursales', { token }), sucursalId, 'sucursales');
    const sucursalTrash = await ok('/sucursales', { token, body: { nombre: 'Sucursal borrar', codigo: `DEL-${unique}`, direccion: 'x', ciudad: 'x', telefono: 'x' } });
    await ok(`/sucursales/${sucursalTrash.id}`, { token, method: 'DELETE' });

    const cliente = await ok('/clientes', {
      token,
      body: {
        nombre: 'Cliente E2E',
        ruc: '80012345-1',
        direccion: 'Direccion cliente',
        telefono: '0991000000',
        tipo: 'empresa',
        email: `cliente-${unique}@example.com`,
        latitud: -25.31,
        longitud: -57.61
      }
    });
    const clienteId = assertHasId(cliente, 'cliente create');
    await ok(`/clientes/${clienteId}`, {
      token,
      method: 'PUT',
      body: { ...cliente, nombre: 'Cliente E2E Editado', tipo: 'empresa' }
    });
    assertListHas(await ok('/clientes', { token }), clienteId, 'clientes');
    assertListHas(await ok('/cuentas-corrientes', { token }), clienteId, 'cuentas corrientes');

    const empleado = await ok('/rrhh/empleados', {
      token,
      body: {
        nombre: 'Empleado E2E',
        documento: '4445556',
        telefono: '0991222333',
        email: `empleado-${unique}@example.com`,
        cargo: 'Operador',
        area: 'Operaciones',
        sucursal_id: sucursalId,
        fecha_ingreso: '2026-05-07',
        salario_base: 3500000,
        estado: 'activo'
      }
    });
    const empleadoId = assertHasId(empleado, 'empleado create con documento repetido cross-tenant');
    await ok(`/rrhh/empleados/${empleadoId}`, { token, method: 'PUT', body: { nombre: 'Empleado E2E Editado', estado: 'activo' } });
    assertListHas(await ok('/rrhh/empleados', { token }), empleadoId, 'rrhh empleados');
    await ok('/rrhh/resumen', { token });

    await crudRecord({
      base: '/rrhh/asistencias',
      token,
      create: { empleado_id: empleadoId, fecha: '2026-05-07', entrada: '08:00', salida: '17:00', tipo: 'normal', estado: 'presente' },
      update: { estado: 'permiso', observaciones: 'Editado E2E' },
      listLabel: 'rrhh asistencias'
    });
    await crudRecord({
      base: '/rrhh/licencias',
      token,
      create: { empleado_id: empleadoId, tipo: 'vacaciones', fecha_inicio: '2026-05-10', fecha_fin: '2026-05-12', estado: 'pendiente', motivo: 'E2E' },
      update: { estado: 'aprobada', motivo: 'Editado E2E' },
      listLabel: 'rrhh licencias'
    });
    await crudRecord({
      base: '/rrhh/nomina',
      token,
      create: { empleado_id: empleadoId, periodo: '2026-05', salario_base: 3500000, horas_extra: 100000, bonificaciones: 50000, descuentos: 25000, estado: 'pendiente' },
      update: { estado: 'pagada', fecha_pago: '2026-05-31' },
      listLabel: 'rrhh nomina'
    });
    await crudRecord({
      base: '/rrhh/capacitaciones',
      token,
      create: { empleado_id: empleadoId, tema: 'Seguridad E2E', fecha: '2026-05-07', vencimiento: '2027-05-07', resultado: 'aprobado' },
      update: { resultado: 'renovado', observaciones: 'Editado E2E' },
      listLabel: 'rrhh capacitaciones'
    });

    const chofer = await ok('/choferes', {
      token,
      body: {
        nombre: 'Chofer E2E',
        documento: `CHO-${unique}`,
        licencia: 'Cat C',
        telefono: '0991444555',
        vencimiento_licencia: '2027-01-01',
        username: `chofer-crud-${unique}`,
        password: 'Chofer123',
        estado: 'activo'
      }
    });
    const choferId = assertHasId(chofer, 'chofer create');
    await ok(`/choferes/${choferId}`, {
      token,
      method: 'PUT',
      body: { ...chofer, username: `chofer-crud-${unique}`, nombre: 'Chofer E2E Editado', estado: 'activo' }
    });
    assertListHas(await ok('/choferes', { token }), choferId, 'choferes');

    const choferLogin = await ok('/chofer/login', { body: { username: `chofer-crud-${unique}`, password: 'Chofer123' } });
    const choferToken = choferLogin.token;
    await ok('/chofer/me', { token: choferToken });
    await ok('/chofer/device-token', { token: choferToken, body: { token: `device-${unique}`, platform: 'android', app_version: '1.0.0' } });
    await expectStatus('/chofer/events', 401);

    const vehiculo = await ok('/vehiculos', {
      token,
      body: {
        chapa: 'AAA 111',
        marca: 'Marca E2E',
        modelo: 'Modelo E2E',
        capacidad: 3500,
        capacidad_kg: 3500,
        capacidad_m3: 12,
        costo_km: 2500,
        consumo_estimado: 10,
        tipo_carga_soportada: 'General',
        estado: 'disponible'
      }
    });
    const vehiculoId = assertHasId(vehiculo, 'vehiculo create con chapa repetida cross-tenant');
    await ok(`/vehiculos/${vehiculoId}`, { token, method: 'PUT', body: { ...vehiculo, marca: 'Marca Editada', estado: 'disponible' } });
    assertListHas(await ok('/vehiculos', { token }), vehiculoId, 'vehiculos');

    await ok('/combustible', { token, body: { vehiculo_id: vehiculoId, litros: 40, monto: 280000, fecha: '2026-05-07', kilometraje: 12000 } });
    assert.ok((await ok('/combustible', { token })).some(row => Number(row.vehiculo_id) === vehiculoId), 'combustible debe listar la carga creada');

    const pedido = await ok('/pedidos', {
      token,
      body: {
        numero_guia: 'GUIA-10001',
        cliente_pagador_id: clienteId,
        remitente_nombre: 'Remitente E2E',
        remitente_doc: '111',
        remitente_tel: '0991',
        remitente_direccion: 'Retiro E2E',
        destinatario_nombre: 'Destinatario E2E',
        destinatario_doc: '222',
        destinatario_tel: '0992',
        destinatario_direccion: 'Entrega E2E',
        sucursal_origen_id: sucursalId,
        sucursal_destino_id: sucursalId,
        modalidad_retiro: 'puerta',
        modalidad_entrega: 'puerta',
        cantidad_bultos: 1,
        peso: 10,
        volumen: 1,
        valor_declarado: 100000,
        precio: 500000,
        tipo_pago: 'contado',
        fecha_prevista: '2026-05-07',
        tipo_carga: 'General',
        estado: 'pendiente_planificacion'
      }
    });
    const pedidoId = assertHasId(pedido, 'pedido create con guia repetida cross-tenant');
    await ok(`/pedidos/${pedidoId}`, { token });
    await ok(`/pedidos/${pedidoId}`, {
      token,
      method: 'PUT',
      body: { prioridad: 1, latitud_retiro: -25.3, longitud_retiro: -57.6, latitud_entrega: -25.31, longitud_entrega: -57.61, observaciones: 'Editado E2E' }
    });
    await ok(`/pedidos/${pedidoId}/estado`, { token, method: 'PUT', body: { estado: 'pendiente_planificacion' } });
    await ok('/evidencias', { token, body: { pedido_id: pedidoId, tipo: 'foto', foto_url: 'https://example.com/foto.jpg', fecha: '2026-05-07' } });
    assertListHas(await ok('/pedidos', { token }), pedidoId, 'pedidos');

    const rutaOptimizada = await ok('/rutas/optimizar', { token, body: { pedido_ids: [pedidoId] } });
    assert.ok(Array.isArray(rutaOptimizada.paradas), 'rutas/optimizar debe devolver paradas');
    const ruta = await ok('/rutas', {
      token,
      body: {
        vehiculo_id: vehiculoId,
        chofer_id: choferId,
        distancia_total_km: 5,
        duracion_total_min: 20,
        costo_estimado: 10000,
        paradas: [{ pedido_id: pedidoId, orden: 1, tipo_parada: 'entrega', direccion: 'Entrega E2E', latitud: -25.31, longitud: -57.61 }]
      }
    });
    await ok(`/rutas/${ruta.id}`, { token });

    const viaje = await ok('/viajes', {
      token,
      body: {
        chofer_id: choferId,
        vehiculo_id: vehiculoId,
        sucursal_origen_id: sucursalId,
        sucursal_destino_id: sucursalId,
        fecha_inicio: '2026-05-07 08:00:00',
        costo_estimado: 150000,
        pedido_ids: [pedidoId],
        tipo_viaje: 'interurbano'
      }
    });
    const viajeId = assertHasId(viaje, 'viaje create');
    await ok('/tracking', { token, body: { viaje_id: viajeId, vehiculo_id: vehiculoId, chofer_id: choferId, latitud: -25.31, longitud: -57.61 } });
    await ok('/tracking/latest', { token });
    await ok(`/viajes/${viajeId}/tracking`, { token });
    await ok(`/viajes/chofer/${choferId}`, { token: choferToken });
    await ok(`/viajes/${viajeId}/estado`, { token, method: 'PUT', body: { estado: 'en_ruta' } });
    await ok(`/pedidos/${pedidoId}/pod`, { token, method: 'PUT', body: { estado: 'entregado', firma_pod: 'firma', observaciones: 'POD E2E', bultos_reales: 1 } });
    await ok(`/viajes/${viajeId}/cerrar`, { token, body: { estado: 'finalizado', observaciones: 'Cierre E2E' } });

    const factura = await ok('/facturas', { token, body: { cliente_id: clienteId, pedido_ids: [pedidoId], condicion_pago: 'contado', timbrado: 'TIMB-E2E' } });
    assertHasId(factura, 'factura create');
    await ok('/pagos', { token, body: { cliente_id: clienteId, pedido_id: pedidoId, monto: 500000, metodo_pago: 'transferencia', referencia: 'PAGO-E2E', observaciones: 'Pago E2E' } });
    await ok(`/clientes/${clienteId}/cuenta`, { token });
    await ok(`/clientes/${clienteId}/ledger`, { token });
    await ok('/reportes/rentabilidad', { token });
    await ok('/dashboard', { token });

    const movimiento = await ok('/caja/movimientos', { token, body: { tipo: 'ingreso', concepto: 'Movimiento E2E', monto: 100000, fecha: '2026-05-07', metodo_pago: 'efectivo', observaciones: 'Caja E2E' } });
    assertHasId(movimiento, 'movimiento caja create');
    assertListHas(await ok('/caja/movimientos', { token }), movimiento.id, 'caja movimientos');
    const rendicion = await ok('/caja/rendiciones', { token, body: { chofer_id: choferId, viaje_id: viajeId, fecha: '2026-05-07', monto_recibido: 200000, monto_gastado: 50000, monto_cobrado: 0, saldo_entregado: 150000, estado: 'pendiente' } });
    assertHasId(rendicion, 'rendicion create');
    await ok(`/caja/rendiciones/${rendicion.id}`, { token, method: 'PUT', body: { estado: 'cerrada' } });
    const gasto = await ok('/caja/gastos', { token, body: { chofer_id: choferId, viaje_id: viajeId, tipo_gasto: 'combustible', monto: 50000, fecha: '2026-05-07', comprobante_url: 'https://example.com/ticket.jpg', estado: 'aprobado' } });
    assertHasId(gasto, 'gasto create');
    assertListHas(await ok('/caja/gastos', { token }), gasto.id, 'caja gastos');

    const proveedor = await ok('/gestion/proveedores', { token, body: { nombre: 'Proveedor E2E', ruc: '80000000-1', telefono: '021', email: `prov-${unique}@example.com`, categoria: 'mantenimiento', estado: 'activo' } });
    const proveedorId = assertHasId(proveedor, 'proveedor create');
    await ok(`/gestion/proveedores/${proveedorId}`, { token, method: 'PUT', body: { nombre: 'Proveedor E2E Editado', estado: 'activo' } });
    const compra = await ok('/gestion/compras', { token, body: { proveedor_id: proveedorId, fecha: '2026-05-07', concepto: 'Compra E2E', categoria: 'repuestos', monto: 250000, estado: 'pendiente', metodo_pago: 'transferencia' } });
    await ok(`/gestion/compras/${compra.id}`, { token, method: 'PUT', body: { estado: 'pagada', observaciones: 'Editado E2E' } });
    const mantenimiento = await ok('/gestion/mantenimientos', { token, body: { vehiculo_id: vehiculoId, proveedor_id: proveedorId, tipo: 'preventivo', descripcion: 'Mant E2E', fecha_programada: '2026-05-20', costo_estimado: 300000, prioridad: 'media', estado: 'programado' } });
    await ok(`/gestion/mantenimientos/${mantenimiento.id}`, { token, method: 'PUT', body: { estado: 'en_proceso', observaciones: 'Editado E2E' } });
    const incidencia = await ok('/gestion/incidencias', { token, body: { tipo: 'operativa', cliente_id: clienteId, pedido_id: pedidoId, viaje_id: viajeId, prioridad: 'alta', estado: 'abierta', titulo: 'Incidencia E2E', descripcion: 'Detalle', fecha_reporte: '2026-05-07' } });
    await ok(`/gestion/incidencias/${incidencia.id}`, { token, method: 'PUT', body: { estado: 'cerrada', resolucion: 'Resuelta E2E' } });
    const inventario = await ok('/gestion/inventario', { token, body: { sucursal_id: sucursalId, codigo: 'REP-001', descripcion: 'Item E2E', categoria: 'repuesto', cantidad: 5, unidad: 'unidad', estado: 'disponible', fecha_actualizacion: '2026-05-07' } });
    await ok(`/gestion/inventario/${inventario.id}`, { token, method: 'PUT', body: { cantidad: 6, estado: 'disponible' } });
    const tarifario = await ok('/gestion/tarifarios', { token, body: { nombre: 'Tarifario E2E', origen_sucursal_id: sucursalId, destino_sucursal_id: sucursalId, tipo_carga: 'General', modalidad: 'puerta', precio_base: 100000, precio_kg: 1000, precio_m3: 5000, seguro_porcentaje: 1, vigencia_desde: '2026-05-07', vigencia_hasta: '2027-05-07', estado: 'activo' } });
    await ok(`/gestion/tarifarios/${tarifario.id}`, { token, method: 'PUT', body: { precio_base: 120000, estado: 'activo' } });
    const contrato = await ok('/gestion/contratos', { token, body: { cliente_id: clienteId, nombre: 'Contrato E2E', fecha_inicio: '2026-05-07', fecha_fin: '2027-05-07', condicion_pago: '30 dias', limite_credito: 1000000, tarifario_id: tarifario.id, estado: 'activo' } });
    await ok(`/gestion/contratos/${contrato.id}`, { token, method: 'PUT', body: { limite_credito: 1500000, estado: 'activo' } });
    await ok('/gestion/resumen', { token });
    assertListHas(await ok('/gestion/proveedores', { token }), proveedorId, 'gestion proveedores');
    assertListHas(await ok('/gestion/compras', { token }), compra.id, 'gestion compras');
    assertListHas(await ok('/gestion/mantenimientos', { token }), mantenimiento.id, 'gestion mantenimientos');
    assertListHas(await ok('/gestion/incidencias', { token }), incidencia.id, 'gestion incidencias');
    assertListHas(await ok('/gestion/inventario', { token }), inventario.id, 'gestion inventario');
    assertListHas(await ok('/gestion/tarifarios', { token }), tarifario.id, 'gestion tarifarios');
    assertListHas(await ok('/gestion/contratos', { token }), contrato.id, 'gestion contratos');

    const alerta = await ok('/alertas', { token, body: { tipo: 'operativa', severidad: 'media', titulo: 'Alerta E2E', descripcion: 'Detalle alerta', entidad: 'pedido', entidad_id: pedidoId } });
    assertHasId(alerta, 'alerta create');
    await ok(`/alertas/${alerta.id}`, { token, method: 'PUT', body: { estado: 'resuelta' } });
    await ok('/alertas', { token });
    await ok('/alertas/vencimientos', { token });

    const regla = await ok('/reglas', { token, body: { nombre: 'Regla E2E', descripcion: 'Regla prueba', entidad: 'pedido', evento: 'creado', condicion_json: { campo: 'peso' }, accion_json: { tipo: 'alerta' }, prioridad: 10, activo: true } });
    assertHasId(regla, 'regla create');
    await ok(`/reglas/${regla.id}`, { token, method: 'PUT', body: { nombre: 'Regla E2E Editada', descripcion: 'Editada', entidad: 'pedido', evento: 'actualizado', condicion_json: {}, accion_json: {}, prioridad: 20, activo: false } });
    await ok('/reglas', { token });
    await ok('/reglas/ejecuciones', { token });

    const native = await ok('/app-updates/chofer/native', { token, body: { latest_native_version: '1.2.3', min_supported_native_version: '1.0.0', apk_url: 'https://example.com/app.apk', obligatorio: false, notas: 'APK E2E' } });
    assert.equal(native.latest_native_version, '1.2.3');
    await ok('/app-updates/chofer/native', { token });
    await ok('/app-updates/chofer/native/latest?native_version=1.0.0', { token });

    const release = await ok('/app-updates/chofer/releases', {
      token,
      body: {
        platform: 'android',
        channel: 'stable',
        version_web: `1.0.${String(unique).slice(-4)}`,
        url_zip: 'https://example.com/bundle.zip',
        sha256: 'a'.repeat(64),
        rollout_percent: 0,
        obligatorio: false,
        notas: 'OTA E2E'
      }
    });
    assertHasId(release, 'release OTA create');
    await ok(`/app-updates/chofer/releases/${release.id}/status`, { token, body: { estado: 'ACTIVE', rollout_percent: 100 } });
    await ok('/app-updates/chofer/latest?platform=android&channel=stable&current_version=0.0.1', { token });
    await ok('/app-updates/chofer/devices', { token: choferToken, body: { platform: 'android', device_id: `device-${unique}`, native_version: '1.2.3', bundle_actual: '0.0.1', channel: 'stable', chofer_id: choferId } });
    await ok('/app-updates/chofer/events', { token: choferToken, body: { platform: 'android', device_id: `device-${unique}`, release_id: release.id, event_type: 'INSTALLED', status: 'ok', chofer_id: choferId } });
    await ok('/app-updates/chofer/events', { token });
    await ok(`/app-updates/chofer/releases/${release.id}/status`, { token, body: { estado: 'PAUSED' } });
    await ok(`/app-updates/chofer/releases/${release.id}/rollback`, { token, body: {} });

    const pedidoLocal = await ok('/pedidos', {
      token,
      body: {
        numero_guia: `LOCAL-${unique}`,
        cliente_pagador_id: clienteId,
        remitente_nombre: 'Retiro Local',
        remitente_doc: '333',
        remitente_tel: '0993',
        remitente_direccion: 'Retiro local',
        destinatario_nombre: 'Entrega Local',
        destinatario_doc: '444',
        destinatario_tel: '0994',
        destinatario_direccion: 'Entrega local',
        sucursal_origen_id: sucursalId,
        sucursal_destino_id: sucursalId,
        modalidad_retiro: 'puerta',
        modalidad_entrega: 'puerta',
        cantidad_bultos: 1,
        peso: 1,
        precio: 100000,
        tipo_pago: 'contado',
        fecha_prevista: '2026-05-08',
        tipo_carga: 'General',
        estado: 'pendiente_planificacion'
      }
    });
    await ok('/reparto-local/pedidos-candidatos', { token });
    const reparto = await ok('/reparto-local/viajes', {
      token,
      body: {
        chofer_id: choferId,
        vehiculo_id: vehiculoId,
        sucursal_origen_id: sucursalId,
        fecha_inicio: '2026-05-08 08:00:00',
        zona: 'Zona E2E',
        ciudad: 'Asuncion',
        pedido_ids: [pedidoLocal.id],
        paradas: [{ tipo_parada: 'ENTREGA', nombre_contacto: 'Contacto', telefono_contacto: '0995', direccion: 'Manual', latitud: -25.32, longitud: -57.62 }],
        retornar_sucursal: true,
        auto_optimizar: true
      }
    });
    const repartoId = Number(reparto.viaje?.id || reparto.id);
    assert.ok(repartoId > 0, 'reparto local debe devolver viaje id');
    await ok('/reparto-local/viajes', { token });
    const repartoDetail = await ok(`/reparto-local/viajes/${repartoId}`, { token });
    assert.ok(Array.isArray(repartoDetail.paradas), 'reparto detail debe devolver paradas');
    await ok(`/reparto-local/viajes/${repartoId}`, { token, method: 'PUT', body: { zona: 'Zona E2E Editada', observaciones: 'Editado' } });
    await ok(`/reparto-local/viajes/${repartoId}/iniciar`, { token, method: 'POST' });
    await ok(`/reparto-local/viajes/${repartoId}/finalizar`, { token, body: { observaciones: 'Fin E2E', permitir_pendientes: true } });
    await ok(`/reparto-local/viajes/${repartoId}/cerrar`, { token, body: { estado: 'finalizado', observaciones: 'Cierre local E2E' } });
    await ok('/chofer/repartos', { token: choferToken });

    await ok(`/gestion/compras/${compra.id}`, { token, method: 'DELETE' });
    await ok(`/gestion/mantenimientos/${mantenimiento.id}`, { token, method: 'DELETE' });
    await ok(`/gestion/incidencias/${incidencia.id}`, { token, method: 'DELETE' });
    await ok(`/gestion/inventario/${inventario.id}`, { token, method: 'DELETE' });
    await ok(`/gestion/tarifarios/${tarifario.id}`, { token, method: 'DELETE' });
    await ok(`/gestion/contratos/${contrato.id}`, { token, method: 'DELETE' });
    await ok(`/gestion/proveedores/${proveedorId}`, { token, method: 'DELETE' });
    await ok(`/rrhh/empleados/${empleadoId}`, { token, method: 'DELETE' });
    await ok('/auth/logout', { token, body: { refreshToken: login.refreshToken } });

    console.log('Full CRUD E2E OK');
  } finally {
    server.kill();
    try {
      fs.rmSync(workdir, { recursive: true, force: true });
    } catch {}
  }
})().catch(error => {
  console.error(error);
  process.exit(1);
});
