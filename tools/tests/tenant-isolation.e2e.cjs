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

const port = 31000 + Math.floor(Math.random() * 1000);
const baseUrl = `http://127.0.0.1:${port}/api`;
const workdir = fs.mkdtempSync(path.join(os.tmpdir(), 'transportadora-tenant-e2e-'));

function startServer() {
  const child = spawn(process.execPath, [serverEntry], {
    cwd: workdir,
    env: {
      ...process.env,
      PORT: String(port),
      JWT_SECRET: 'tenant-e2e-jwt-secret',
      REFRESH_TOKEN_SECRET: 'tenant-e2e-refresh-secret',
      DATABASE_URL: ''
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let output = '';
  child.stdout.on('data', chunk => {
    output += chunk.toString();
  });
  child.stderr.on('data', chunk => {
    output += chunk.toString();
  });

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
  assert.equal(result.res.ok, true, `${pathname} -> ${result.res.status}: ${JSON.stringify(result.data)}`);
  return result.data;
}

async function expectStatus(pathname, status, options = {}) {
  const result = await request(pathname, options);
  assert.equal(result.res.status, status, `${pathname} esperaba ${status}, recibio ${result.res.status}: ${JSON.stringify(result.data)}`);
  return result.data;
}

function assertArrayEmpty(value, label) {
  assert.equal(Array.isArray(value), true, `${label} debe devolver array`);
  assert.equal(value.length, 0, `${label} debe estar vacio para tenant nuevo`);
}

function assertNoText(value, forbidden, label) {
  assert.equal(JSON.stringify(value).includes(forbidden), false, `${label} filtro datos de otro tenant: ${forbidden}`);
}

(async () => {
  const server = await startServer();
  try {
    await expectStatus('/clientes', 401);

    const adminLogin = await ok('/login', { body: { username: 'admin', password: 'admin123' } });
    const tokenTenant1 = adminLogin.token;
    assert.equal(adminLogin.tenant.id, 1, 'admin demo debe pertenecer al tenant 1');

    const tenant1Clientes = await ok('/clientes', { token: tokenTenant1 });
    assert.ok(tenant1Clientes.length > 0, 'tenant demo debe tener datos seed para detectar fugas');

    const unique = Date.now();
    const email = `tenant-isolation-${unique}@example.com`;
    const password = 'TenantTest123';
    const register = await ok('/public/register-tenant', {
      body: {
        nombre_empresa: `Tenant Isolation ${unique}`,
        email_admin: email,
        password_admin: password,
        confirm_password: password
      }
    });
    const tenant2Id = register.tenant.id;
    assert.notEqual(tenant2Id, 1, 'el tenant de prueba debe ser nuevo');

    const login2 = await ok('/login', { body: { username: email, password } });
    const token2 = login2.token;
    assert.equal(login2.tenant.id, tenant2Id, 'login sin x-tenant-id debe resolver el tenant del usuario');

    const me2 = await ok('/me', { token: token2 });
    assert.equal(me2.user.tenant_id, tenant2Id);

    const emptyChecks = [
      ['/pedidos', 'Pedidos'],
      ['/viajes', 'Viajes'],
      ['/reparto-local/pedidos-candidatos', 'Reparto local candidatos'],
      ['/reparto-local/viajes', 'Reparto local viajes'],
      ['/tracking/latest', 'Monitoreo GPS'],
      ['/caja/movimientos', 'Caja movimientos'],
      ['/caja/rendiciones', 'Caja rendiciones'],
      ['/caja/gastos', 'Viaticos gastos'],
      ['/cuentas-corrientes', 'Cuentas corrientes'],
      ['/rrhh/empleados', 'RRHH empleados'],
      ['/rrhh/asistencias', 'RRHH asistencias'],
      ['/rrhh/licencias', 'RRHH licencias'],
      ['/rrhh/nomina', 'RRHH nomina'],
      ['/rrhh/capacitaciones', 'RRHH capacitaciones'],
      ['/gestion/proveedores', 'Gestion proveedores'],
      ['/gestion/compras', 'Gestion compras'],
      ['/gestion/mantenimientos', 'Gestion mantenimientos'],
      ['/gestion/incidencias', 'Gestion incidencias'],
      ['/gestion/inventario', 'Gestion inventario'],
      ['/gestion/tarifarios', 'Gestion tarifarios'],
      ['/gestion/contratos', 'Gestion contratos'],
      ['/clientes', 'Clientes'],
      ['/vehiculos', 'Flota'],
      ['/choferes', 'Choferes'],
      ['/sucursales', 'Sucursales'],
      ['/app-updates/chofer/releases', 'App chofer OTA releases'],
      ['/app-updates/chofer/events', 'App chofer OTA events']
    ];
    for (const [pathname, label] of emptyChecks) {
      assertArrayEmpty(await ok(pathname, { token: token2 }), label);
    }

    const dashboard2 = await ok('/dashboard', { token: token2 });
    assert.deepEqual(dashboard2, { viajesActivos: 0, vehiculosDisponibles: 0, pedidosPendientes: 0 });

    const report2 = await ok('/reportes/rentabilidad', { token: token2 });
    assert.equal(report2.total_ingresos, 0);
    assert.equal(report2.total_egresos, 0);
    assert.equal(report2.viajes, 0);

    const users2 = await ok('/usuarios', { token: token2 });
    assert.equal(users2.length, 1);
    assert.equal(users2[0].tenant_id, tenant2Id);
    assert.equal(users2[0].username, email);

    const tenants2 = await ok('/tenants', { token: token2 });
    assert.equal(tenants2.length, 1);
    assert.equal(tenants2[0].id, tenant2Id);

    await expectStatus('/pedidos/1', 404, { token: token2 });
    await expectStatus('/header-template/1', 403, { token: token2 });
    await expectStatus('/tracking', 400, {
      token: token2,
      body: { chofer_id: 1, latitud: -25.1, longitud: -57.1 }
    });

    const sucursal = await ok('/sucursales', {
      token: token2,
      body: {
        nombre: `Sucursal Tenant ${unique}`,
        codigo: `TEN-${String(unique).slice(-6)}`,
        direccion: 'Direccion tenant',
        ciudad: 'Ciudad Tenant',
        departamento: 'Central',
        telefono: '0991000000',
        responsable: 'Admin Tenant',
        latitud: -25.3,
        longitud: -57.6
      }
    });
    const cliente = await ok('/clientes', {
      token: token2,
      body: {
        nombre: `Cliente Tenant ${unique}`,
        ruc: `${String(unique).slice(-7)}-1`,
        direccion: 'Direccion cliente tenant',
        telefono: '0991000001',
        tipo: 'empresa'
      }
    });
    const vehiculo = await ok('/vehiculos', {
      token: token2,
      body: {
        chapa: `TEN${String(unique).slice(-3)}`,
        marca: 'Tenant',
        modelo: 'Unit',
        capacidad: 1000,
        estado: 'disponible'
      }
    });
    const chofer = await ok('/choferes', {
      token: token2,
      body: {
        nombre: `Chofer Tenant ${unique}`,
        documento: `DOC${unique}`,
        licencia: 'Cat B',
        telefono: '0991000002',
        username: `chofer-${unique}`,
        password: 'ChoferTest123',
        estado: 'activo'
      }
    });
    const pedido = await ok('/pedidos', {
      token: token2,
      body: {
        numero_guia: `TEN-GUIA-${unique}`,
        cliente_pagador_id: cliente.id,
        remitente_nombre: 'Remitente Tenant',
        remitente_doc: '111',
        remitente_tel: '0991',
        remitente_direccion: 'Retiro Tenant',
        destinatario_nombre: 'Destinatario Tenant',
        destinatario_doc: '222',
        destinatario_tel: '0992',
        destinatario_direccion: 'Entrega Tenant',
        sucursal_origen_id: sucursal.id,
        sucursal_destino_id: sucursal.id,
        modalidad_retiro: 'puerta',
        modalidad_entrega: 'puerta',
        cantidad_bultos: 1,
        peso: 1,
        precio: 12345,
        tipo_pago: 'contado',
        fecha_prevista: '2026-05-07',
        tipo_carga: 'General'
      }
    });

    await ok('/tracking', {
      token: token2,
      body: { chofer_id: chofer.id, vehiculo_id: vehiculo.id, latitud: -25.33, longitud: -57.63 }
    });
    const tracking2 = await ok('/tracking/latest', { token: token2 });
    assert.equal(tracking2.length, 1);
    assert.equal(tracking2[0].chofer_nombre, `Chofer Tenant ${unique}`);

    const choferLogin = await ok('/chofer/login', { body: { username: `chofer-${unique}`, password: 'ChoferTest123' } });
    assert.equal(String(choferLogin.chofer.id), String(chofer.id));
    const choferMe = await ok('/chofer/me', { token: choferLogin.token });
    assert.equal(choferMe.chofer.nombre, `Chofer Tenant ${unique}`);
    assertArrayEmpty(await ok('/chofer/repartos', { token: choferLogin.token }), 'App chofer repartos');
    assertArrayEmpty(await ok(`/viajes/chofer/${chofer.id}`, { token: choferLogin.token }), 'App chofer viajes interurbanos');

    const tenant1After = await ok('/clientes', { token: tokenTenant1 });
    assertNoText(tenant1After, `Cliente Tenant ${unique}`, 'Clientes tenant demo');
    assertNoText(await ok('/tracking/latest', { token: tokenTenant1 }), `Chofer Tenant ${unique}`, 'GPS tenant demo');
    assertNoText(await ok('/pedidos', { token: tokenTenant1 }), `TEN-GUIA-${unique}`, 'Pedidos tenant demo');

    const pedido2 = await ok(`/pedidos/${pedido.id}`, { token: token2 });
    assert.equal(pedido2.numero_guia, `TEN-GUIA-${unique}`);

    console.log('Tenant isolation E2E OK');
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
