import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { createPgDatabase } from './pg-sync-db';

const db: any = process.env.DATABASE_URL ? createPgDatabase() : new Database('transportadora.db');

export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password TEXT,
      role TEXT,
      chofer_id INTEGER
    );

    CREATE TABLE IF NOT EXISTS sucursales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT,
      codigo TEXT UNIQUE,
      direccion TEXT,
      ciudad TEXT,
      departamento TEXT,
      telefono TEXT,
      responsable TEXT,
      estado TEXT DEFAULT 'activo',
      latitud REAL,
      longitud REAL
    );

    CREATE TABLE IF NOT EXISTS clientes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT,
      ruc TEXT,
      direccion TEXT,
      telefono TEXT,
      tipo TEXT DEFAULT 'persona',
      email TEXT,
      condiciones_comerciales TEXT,
      latitud REAL,
      longitud REAL
    );

    CREATE TABLE IF NOT EXISTS choferes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT,
      documento TEXT,
      licencia TEXT,
      telefono TEXT,
      estado TEXT DEFAULT 'activo',
      vencimiento_licencia TEXT DEFAULT '2026-12-31'
    );

    CREATE TABLE IF NOT EXISTS vehiculos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chapa TEXT UNIQUE,
      marca TEXT,
      modelo TEXT,
      capacidad REAL,
      estado TEXT DEFAULT 'disponible',
      vencimiento_seguro TEXT DEFAULT '2026-12-31',
      vencimiento_habilitacion TEXT DEFAULT '2026-12-31'
    );

    CREATE TABLE IF NOT EXISTS viajes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tipo_viaje TEXT DEFAULT 'interurbano',
      chofer_id INTEGER,
      vehiculo_id INTEGER,
      sucursal_origen_id INTEGER,
      sucursal_destino_id INTEGER,
      estado TEXT DEFAULT 'planificado',
      fecha_inicio TEXT,
      costo_estimado REAL DEFAULT 0,
      incidencias TEXT,
      FOREIGN KEY(chofer_id) REFERENCES choferes(id),
      FOREIGN KEY(vehiculo_id) REFERENCES vehiculos(id),
      FOREIGN KEY(sucursal_origen_id) REFERENCES sucursales(id),
      FOREIGN KEY(sucursal_destino_id) REFERENCES sucursales(id)
    );

    CREATE TABLE IF NOT EXISTS pedidos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numero_guia TEXT UNIQUE,
      cliente_pagador_id INTEGER,
      remitente_nombre TEXT,
      remitente_doc TEXT,
      remitente_tel TEXT,
      remitente_direccion TEXT,
      destinatario_nombre TEXT,
      destinatario_doc TEXT,
      destinatario_tel TEXT,
      destinatario_direccion TEXT,
      sucursal_origen_id INTEGER,
      sucursal_destino_id INTEGER,
      modalidad_retiro TEXT,
      modalidad_entrega TEXT,
      cantidad_bultos INTEGER DEFAULT 1,
      peso REAL DEFAULT 0,
      volumen REAL DEFAULT 0,
      valor_declarado REAL DEFAULT 0,
      precio REAL DEFAULT 0,
      tipo_pago TEXT,
      estado TEXT DEFAULT 'borrador',
      fecha_prevista TEXT,
      tipo_carga TEXT,
      viaje_id INTEGER,
      foto_pod TEXT,
      firma_pod TEXT,
      observaciones TEXT,
      bultos_reales INTEGER,
      motivo_devolucion TEXT,
      FOREIGN KEY(cliente_pagador_id) REFERENCES clientes(id),
      FOREIGN KEY(sucursal_origen_id) REFERENCES sucursales(id),
      FOREIGN KEY(sucursal_destino_id) REFERENCES sucursales(id),
      FOREIGN KEY(viaje_id) REFERENCES viajes(id)
    );

    CREATE TABLE IF NOT EXISTS evidencias_pedido (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pedido_id INTEGER,
      tipo TEXT,
      foto_url TEXT,
      fecha TEXT,
      FOREIGN KEY(pedido_id) REFERENCES pedidos(id)
    );

    CREATE TABLE IF NOT EXISTS tracking (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vehiculo_id INTEGER,
      chofer_id INTEGER,
      latitud REAL,
      longitud REAL,
      timestamp TEXT,
      FOREIGN KEY(vehiculo_id) REFERENCES vehiculos(id),
      FOREIGN KEY(chofer_id) REFERENCES choferes(id)
    );

    CREATE TABLE IF NOT EXISTS combustible (
      id INTEGER PRIMARY KEY AUTOINCREMENT, 
      vehiculo_id INTEGER, 
      litros REAL, 
      monto REAL, 
      fecha TEXT, 
      kilometraje REAL, 
      FOREIGN KEY(vehiculo_id) REFERENCES vehiculos(id)
    );

    CREATE TABLE IF NOT EXISTS configuracion (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER DEFAULT 1,
      clave TEXT NOT NULL,
      valor TEXT,
      UNIQUE(tenant_id, clave)
    );

    CREATE TABLE IF NOT EXISTS movimientos_caja (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tipo TEXT,
      concepto TEXT,
      monto REAL,
      fecha TEXT,
      usuario_id INTEGER,
      referencia_id INTEGER,
      metodo_pago TEXT,
      observaciones TEXT,
      FOREIGN KEY(usuario_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS rendiciones_chofer (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chofer_id INTEGER,
      viaje_id INTEGER,
      fecha TEXT,
      monto_recibido REAL,
      monto_gastado REAL,
      monto_cobrado REAL,
      saldo_entregado REAL,
      estado TEXT DEFAULT 'pendiente',
      FOREIGN KEY(chofer_id) REFERENCES choferes(id),
      FOREIGN KEY(viaje_id) REFERENCES viajes(id)
    );

    CREATE TABLE IF NOT EXISTS gastos_operativos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chofer_id INTEGER,
      viaje_id INTEGER,
      tipo_gasto TEXT,
      monto REAL,
      fecha TEXT,
      comprobante_url TEXT,
      estado TEXT DEFAULT 'reportado',
      FOREIGN KEY(chofer_id) REFERENCES choferes(id),
      FOREIGN KEY(viaje_id) REFERENCES viajes(id)
    );

    CREATE TABLE IF NOT EXISTS cuentas_corrientes_clientes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cliente_id INTEGER,
      saldo_deudor REAL DEFAULT 0,
      limite_credito REAL DEFAULT 0,
      FOREIGN KEY(cliente_id) REFERENCES clientes(id)
    );

    CREATE TABLE IF NOT EXISTS pagos_clientes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cliente_id INTEGER,
      pedido_id INTEGER,
      monto REAL,
      fecha TEXT,
      metodo_pago TEXT,
      referencia_comprobante TEXT,
      usuario_id INTEGER,
      FOREIGN KEY(cliente_id) REFERENCES clientes(id),
      FOREIGN KEY(pedido_id) REFERENCES pedidos(id),
      FOREIGN KEY(usuario_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS rrhh_empleados (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      documento TEXT UNIQUE,
      telefono TEXT,
      email TEXT,
      cargo TEXT,
      area TEXT,
      sucursal_id INTEGER,
      fecha_ingreso TEXT,
      salario_base REAL DEFAULT 0,
      estado TEXT DEFAULT 'activo',
      vencimiento_contrato TEXT,
      contacto_emergencia TEXT,
      observaciones TEXT,
      FOREIGN KEY(sucursal_id) REFERENCES sucursales(id)
    );

    CREATE TABLE IF NOT EXISTS rrhh_asistencias (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      empleado_id INTEGER NOT NULL,
      fecha TEXT NOT NULL,
      entrada TEXT,
      salida TEXT,
      tipo TEXT DEFAULT 'normal',
      estado TEXT DEFAULT 'presente',
      observaciones TEXT,
      FOREIGN KEY(empleado_id) REFERENCES rrhh_empleados(id)
    );

    CREATE TABLE IF NOT EXISTS rrhh_licencias (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      empleado_id INTEGER NOT NULL,
      tipo TEXT NOT NULL,
      fecha_inicio TEXT NOT NULL,
      fecha_fin TEXT NOT NULL,
      estado TEXT DEFAULT 'pendiente',
      motivo TEXT,
      FOREIGN KEY(empleado_id) REFERENCES rrhh_empleados(id)
    );

    CREATE TABLE IF NOT EXISTS rrhh_nomina (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      empleado_id INTEGER NOT NULL,
      periodo TEXT NOT NULL,
      salario_base REAL DEFAULT 0,
      horas_extra REAL DEFAULT 0,
      bonificaciones REAL DEFAULT 0,
      descuentos REAL DEFAULT 0,
      total_neto REAL DEFAULT 0,
      estado TEXT DEFAULT 'pendiente',
      fecha_pago TEXT,
      FOREIGN KEY(empleado_id) REFERENCES rrhh_empleados(id)
    );

    CREATE TABLE IF NOT EXISTS rrhh_capacitaciones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      empleado_id INTEGER,
      tema TEXT NOT NULL,
      fecha TEXT,
      vencimiento TEXT,
      resultado TEXT DEFAULT 'programada',
      certificado_url TEXT,
      observaciones TEXT,
      FOREIGN KEY(empleado_id) REFERENCES rrhh_empleados(id)
    );

    CREATE TABLE IF NOT EXISTS proveedores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      ruc TEXT,
      telefono TEXT,
      email TEXT,
      direccion TEXT,
      categoria TEXT,
      contacto TEXT,
      estado TEXT DEFAULT 'activo',
      observaciones TEXT
    );

    CREATE TABLE IF NOT EXISTS compras (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      proveedor_id INTEGER,
      fecha TEXT NOT NULL,
      concepto TEXT NOT NULL,
      categoria TEXT,
      monto REAL DEFAULT 0,
      estado TEXT DEFAULT 'pendiente',
      metodo_pago TEXT,
      comprobante TEXT,
      observaciones TEXT,
      FOREIGN KEY(proveedor_id) REFERENCES proveedores(id)
    );

    CREATE TABLE IF NOT EXISTS mantenimientos_vehiculo (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vehiculo_id INTEGER NOT NULL,
      proveedor_id INTEGER,
      tipo TEXT NOT NULL,
      descripcion TEXT,
      fecha_programada TEXT,
      fecha_realizada TEXT,
      kilometraje_programado REAL DEFAULT 0,
      costo_estimado REAL DEFAULT 0,
      costo_real REAL DEFAULT 0,
      prioridad TEXT DEFAULT 'media',
      estado TEXT DEFAULT 'programado',
      observaciones TEXT,
      FOREIGN KEY(vehiculo_id) REFERENCES vehiculos(id),
      FOREIGN KEY(proveedor_id) REFERENCES proveedores(id)
    );

    CREATE TABLE IF NOT EXISTS incidencias_operativas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tipo TEXT NOT NULL,
      referencia_tipo TEXT,
      referencia_id INTEGER,
      cliente_id INTEGER,
      pedido_id INTEGER,
      viaje_id INTEGER,
      prioridad TEXT DEFAULT 'media',
      estado TEXT DEFAULT 'abierta',
      titulo TEXT NOT NULL,
      descripcion TEXT,
      fecha_reporte TEXT NOT NULL,
      fecha_cierre TEXT,
      responsable TEXT,
      resolucion TEXT,
      FOREIGN KEY(cliente_id) REFERENCES clientes(id),
      FOREIGN KEY(pedido_id) REFERENCES pedidos(id),
      FOREIGN KEY(viaje_id) REFERENCES viajes(id)
    );

    CREATE TABLE IF NOT EXISTS inventario_deposito (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sucursal_id INTEGER,
      codigo TEXT UNIQUE,
      descripcion TEXT NOT NULL,
      categoria TEXT,
      cantidad REAL DEFAULT 0,
      unidad TEXT DEFAULT 'unidad',
      ubicacion TEXT,
      estado TEXT DEFAULT 'disponible',
      fecha_actualizacion TEXT,
      observaciones TEXT,
      FOREIGN KEY(sucursal_id) REFERENCES sucursales(id)
    );

    CREATE TABLE IF NOT EXISTS tarifarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      origen_sucursal_id INTEGER,
      destino_sucursal_id INTEGER,
      tipo_carga TEXT,
      modalidad TEXT,
      precio_base REAL DEFAULT 0,
      precio_kg REAL DEFAULT 0,
      precio_m3 REAL DEFAULT 0,
      seguro_porcentaje REAL DEFAULT 0,
      vigencia_desde TEXT,
      vigencia_hasta TEXT,
      estado TEXT DEFAULT 'activo',
      FOREIGN KEY(origen_sucursal_id) REFERENCES sucursales(id),
      FOREIGN KEY(destino_sucursal_id) REFERENCES sucursales(id)
    );

    CREATE TABLE IF NOT EXISTS contratos_clientes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cliente_id INTEGER NOT NULL,
      nombre TEXT NOT NULL,
      fecha_inicio TEXT,
      fecha_fin TEXT,
      condicion_pago TEXT DEFAULT 'contado',
      limite_credito REAL DEFAULT 0,
      tarifario_id INTEGER,
      estado TEXT DEFAULT 'activo',
      observaciones TEXT,
      FOREIGN KEY(cliente_id) REFERENCES clientes(id),
      FOREIGN KEY(tarifario_id) REFERENCES tarifarios(id)
    );

    CREATE TABLE IF NOT EXISTS tenants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      ruc TEXT,
      dominio TEXT UNIQUE,
      plan TEXT DEFAULT 'demo',
      estado TEXT DEFAULT 'activo',
      fecha_alta TEXT DEFAULT CURRENT_TIMESTAMP,
      configuracion_json TEXT DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS permisos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clave TEXT UNIQUE NOT NULL,
      descripcion TEXT
    );

    CREATE TABLE IF NOT EXISTS roles_permisos (
      role TEXT NOT NULL,
      permiso TEXT NOT NULL,
      PRIMARY KEY (role, permiso)
    );

    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER,
      user_id INTEGER NOT NULL,
      token_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      revoked_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(tenant_id) REFERENCES tenants(id),
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER,
      user_id INTEGER,
      accion TEXT NOT NULL,
      entidad TEXT NOT NULL,
      entidad_id TEXT,
      antes_json TEXT,
      despues_json TEXT,
      ip TEXT,
      user_agent TEXT,
      fecha TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(tenant_id) REFERENCES tenants(id),
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS reglas_operativas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      nombre TEXT NOT NULL,
      descripcion TEXT,
      entidad TEXT NOT NULL,
      evento TEXT NOT NULL,
      condicion_json TEXT DEFAULT '{}',
      accion_json TEXT DEFAULT '{}',
      prioridad INTEGER DEFAULT 100,
      activo INTEGER DEFAULT 1,
      FOREIGN KEY(tenant_id) REFERENCES tenants(id)
    );

    CREATE TABLE IF NOT EXISTS reglas_ejecuciones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      regla_id INTEGER,
      evento TEXT NOT NULL,
      entidad TEXT,
      entidad_id TEXT,
      resultado TEXT,
      detalle_json TEXT DEFAULT '{}',
      fecha TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(tenant_id) REFERENCES tenants(id),
      FOREIGN KEY(regla_id) REFERENCES reglas_operativas(id)
    );

    CREATE TABLE IF NOT EXISTS alertas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      tipo TEXT NOT NULL,
      severidad TEXT DEFAULT 'media',
      titulo TEXT NOT NULL,
      descripcion TEXT,
      entidad TEXT,
      entidad_id TEXT,
      estado TEXT DEFAULT 'abierta',
      asignado_a INTEGER,
      fecha_creacion TEXT DEFAULT CURRENT_TIMESTAMP,
      fecha_resolucion TEXT,
      FOREIGN KEY(tenant_id) REFERENCES tenants(id),
      FOREIGN KEY(asignado_a) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS rutas_planificadas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      viaje_id INTEGER,
      vehiculo_id INTEGER,
      chofer_id INTEGER,
      distancia_total_km REAL DEFAULT 0,
      duracion_total_min REAL DEFAULT 0,
      costo_estimado REAL DEFAULT 0,
      estado TEXT DEFAULT 'borrador',
      fecha_creacion TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(tenant_id) REFERENCES tenants(id),
      FOREIGN KEY(viaje_id) REFERENCES viajes(id),
      FOREIGN KEY(vehiculo_id) REFERENCES vehiculos(id),
      FOREIGN KEY(chofer_id) REFERENCES choferes(id)
    );

    CREATE TABLE IF NOT EXISTS paradas_ruta (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ruta_id INTEGER NOT NULL,
      pedido_id INTEGER,
      orden INTEGER NOT NULL,
      tipo_parada TEXT NOT NULL,
      direccion TEXT,
      latitud REAL,
      longitud REAL,
      eta TEXT,
      estado TEXT DEFAULT 'pendiente',
      llegada_real TEXT,
      evidencia_json TEXT DEFAULT '{}',
      FOREIGN KEY(ruta_id) REFERENCES rutas_planificadas(id),
      FOREIGN KEY(pedido_id) REFERENCES pedidos(id)
    );

    CREATE TABLE IF NOT EXISTS facturas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      cliente_id INTEGER NOT NULL,
      numero TEXT NOT NULL,
      timbrado TEXT,
      fecha TEXT NOT NULL,
      vencimiento TEXT,
      subtotal REAL DEFAULT 0,
      iva REAL DEFAULT 0,
      total REAL DEFAULT 0,
      estado TEXT DEFAULT 'emitida',
      condicion_pago TEXT DEFAULT 'contado',
      pdf_url TEXT,
      FOREIGN KEY(tenant_id) REFERENCES tenants(id),
      FOREIGN KEY(cliente_id) REFERENCES clientes(id)
    );

    CREATE TABLE IF NOT EXISTS factura_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      factura_id INTEGER NOT NULL,
      pedido_id INTEGER,
      descripcion TEXT NOT NULL,
      cantidad REAL DEFAULT 1,
      precio_unitario REAL DEFAULT 0,
      total REAL DEFAULT 0,
      FOREIGN KEY(factura_id) REFERENCES facturas(id),
      FOREIGN KEY(pedido_id) REFERENCES pedidos(id)
    );

    CREATE TABLE IF NOT EXISTS clientes_usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      cliente_id INTEGER NOT NULL,
      nombre TEXT NOT NULL,
      email TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      estado TEXT DEFAULT 'activo',
      FOREIGN KEY(tenant_id) REFERENCES tenants(id),
      FOREIGN KEY(cliente_id) REFERENCES clientes(id)
    );
  `);
  
  // Añadir columnas dinámicamente si no existen para soportar DB existente
  try { db.exec("ALTER TABLE sucursales ADD COLUMN latitud REAL;"); } catch (e) {}
  try { db.exec("ALTER TABLE sucursales ADD COLUMN longitud REAL;"); } catch (e) {}
  try { db.exec("ALTER TABLE clientes ADD COLUMN latitud REAL;"); } catch (e) {}
  try { db.exec("ALTER TABLE clientes ADD COLUMN longitud REAL;"); } catch (e) {}
  try { db.exec("ALTER TABLE viajes ADD COLUMN tipo_viaje TEXT DEFAULT 'interurbano';"); } catch (e) {}
  try { db.exec("ALTER TABLE pedidos ADD COLUMN motivo_devolucion TEXT;"); } catch (e) {}
  try { db.exec("ALTER TABLE tracking ADD COLUMN chofer_id INTEGER;"); } catch (e) {}
  try { db.exec("ALTER TABLE users ADD COLUMN tenant_id INTEGER DEFAULT 1;"); } catch (e) {}
  try { db.exec("ALTER TABLE users ADD COLUMN password_hash TEXT;"); } catch (e) {}
  try { db.exec("ALTER TABLE users ADD COLUMN estado TEXT DEFAULT 'activo';"); } catch (e) {}
  try { db.exec("ALTER TABLE users ADD COLUMN permisos_json TEXT DEFAULT '[]';"); } catch (e) {}
  try { db.exec("ALTER TABLE users ADD COLUMN nombre TEXT;"); } catch (e) {}
  try { db.exec("ALTER TABLE users ADD COLUMN chofer_id INTEGER;"); } catch (e) {}
  try { db.exec("ALTER TABLE pedidos ADD COLUMN prioridad INTEGER DEFAULT 3;"); } catch (e) {}
  try { db.exec("ALTER TABLE pedidos ADD COLUMN ventana_entrega_inicio TEXT;"); } catch (e) {}
  try { db.exec("ALTER TABLE pedidos ADD COLUMN ventana_entrega_fin TEXT;"); } catch (e) {}
  try { db.exec("ALTER TABLE pedidos ADD COLUMN requiere_frio INTEGER DEFAULT 0;"); } catch (e) {}
  try { db.exec("ALTER TABLE pedidos ADD COLUMN fragil INTEGER DEFAULT 0;"); } catch (e) {}
  try { db.exec("ALTER TABLE pedidos ADD COLUMN latitud_retiro REAL;"); } catch (e) {}
  try { db.exec("ALTER TABLE pedidos ADD COLUMN longitud_retiro REAL;"); } catch (e) {}
  try { db.exec("ALTER TABLE pedidos ADD COLUMN latitud_entrega REAL;"); } catch (e) {}
  try { db.exec("ALTER TABLE pedidos ADD COLUMN longitud_entrega REAL;"); } catch (e) {}
  try { db.exec("ALTER TABLE pedidos ADD COLUMN tracking_token TEXT;"); } catch (e) {}
  try { db.exec("ALTER TABLE pedidos ADD COLUMN tracking_token_expira TEXT;"); } catch (e) {}
  try { db.exec("ALTER TABLE vehiculos ADD COLUMN capacidad_kg REAL DEFAULT 0;"); } catch (e) {}
  try { db.exec("ALTER TABLE vehiculos ADD COLUMN capacidad_m3 REAL DEFAULT 0;"); } catch (e) {}
  try { db.exec("ALTER TABLE vehiculos ADD COLUMN costo_km REAL DEFAULT 0;"); } catch (e) {}
  try { db.exec("ALTER TABLE vehiculos ADD COLUMN consumo_estimado REAL DEFAULT 0;"); } catch (e) {}
  try { db.exec("ALTER TABLE vehiculos ADD COLUMN tipo_carga_soportada TEXT;"); } catch (e) {}

  const tenantTables = [
    'sucursales', 'clientes', 'choferes', 'vehiculos', 'viajes', 'pedidos',
    'evidencias_pedido', 'tracking', 'combustible', 'configuracion',
    'movimientos_caja', 'rendiciones_chofer', 'gastos_operativos',
    'cuentas_corrientes_clientes', 'pagos_clientes', 'rrhh_empleados',
    'rrhh_asistencias', 'rrhh_licencias', 'rrhh_nomina',
    'rrhh_capacitaciones', 'proveedores', 'compras',
    'mantenimientos_vehiculo', 'incidencias_operativas',
    'inventario_deposito', 'tarifarios', 'contratos_clientes'
  ];
  for (const table of tenantTables) {
    try { db.exec(`ALTER TABLE ${table} ADD COLUMN tenant_id INTEGER DEFAULT 1;`); } catch (e) {}
    try { db.exec(`UPDATE ${table} SET tenant_id = 1 WHERE tenant_id IS NULL;`); } catch (e) {}
  }

  // Create admin user
  db.prepare("INSERT OR IGNORE INTO tenants (id, nombre, ruc, dominio, plan, estado, configuracion_json) VALUES (1, 'Empresa Demo Transportadora', '80012345-6', 'demo.local', 'demo', 'activo', '{}')").run();

  const permisos = [
    'users.manage', 'pedidos.read', 'pedidos.create', 'pedidos.update', 'pedidos.delete',
    'viajes.manage', 'finanzas.manage', 'rrhh.manage', 'flota.manage', 'reportes.read',
    'configuracion.manage', 'clientes.portal'
  ];
  const insertPermiso = db.prepare("INSERT OR IGNORE INTO permisos (clave, descripcion) VALUES (?, ?)");
  permisos.forEach(permiso => insertPermiso.run(permiso, permiso));

  const rolePermissions: Record<string, string[]> = {
    superadmin_saas: permisos,
    admin_empresa: permisos,
    operador: ['pedidos.read', 'pedidos.create', 'pedidos.update', 'viajes.manage', 'flota.manage', 'reportes.read'],
    financiero: ['pedidos.read', 'finanzas.manage', 'reportes.read'],
    rrhh: ['rrhh.manage', 'reportes.read'],
    despachante: ['pedidos.read', 'pedidos.update', 'viajes.manage', 'flota.manage'],
    chofer: ['pedidos.read'],
    cliente_portal: ['clientes.portal']
  };
  const insertRolePermission = db.prepare("INSERT OR IGNORE INTO roles_permisos (role, permiso) VALUES (?, ?)");
  Object.entries(rolePermissions).forEach(([role, rolePermisos]) => rolePermisos.forEach(permiso => insertRolePermission.run(role, permiso)));

  const admin = db.prepare("SELECT * FROM users WHERE username = 'admin'").get() as any;
  const adminHash = bcrypt.hashSync('admin123', 10);
  if (!admin) {
    db.prepare("INSERT INTO users (tenant_id, username, password, password_hash, role, nombre, estado) VALUES (1, 'admin', 'admin123', ?, 'superadmin_saas', 'Superadmin SaaS', 'activo')").run(adminHash);
  } else if (!admin.password_hash) {
    db.prepare("UPDATE users SET tenant_id = COALESCE(tenant_id, 1), password_hash = ?, role = CASE WHEN role = 'admin' THEN 'superadmin_saas' ELSE role END, estado = COALESCE(estado, 'activo') WHERE id = ?").run(adminHash, admin.id);
  }

  // Config defaults
  const insertConfig = db.prepare("INSERT OR IGNORE INTO configuracion (tenant_id, clave, valor) VALUES (?, ?, ?)");
  insertConfig.run(1, 'membrete', 'TRANSPORTADORA PARAGUAY SAAS\\nRUC: 80012345-6\\nTel: 0981 000 000');
  insertConfig.run(1, 'ticket_width_chars', '32');
  insertConfig.run(1, 'ticket_copies', '2');
  insertConfig.run(1, 'ticket_fields', JSON.stringify({
    numero_guia: true,
    fecha: true,
    remitente_nombre: true,
    remitente_doc: true,
    remitente_tel: true,
    remitente_direccion: true,
    destinatario_nombre: true,
    destinatario_doc: true,
    destinatario_tel: true,
    destinatario_direccion: true,
    sucursal_origen_nombre: true,
    sucursal_destino_nombre: true,
    tipo_carga: true,
    cantidad_bultos: true,
    peso: true,
    volumen: false,
    valor_declarado: false,
    precio: true,
    tipo_pago: true,
    estado: true,
    observaciones: true
  }));

  // Seed Data
  seedData();
  ensureDriverUsers();
  seedHumanResources();
  seedManagementData();
}

function seedData() {
  const sucursales = db.prepare("SELECT count(*) as count FROM sucursales").get() as { count: number };
  if (Number(sucursales.count) === 0) {
    console.log("Seeding base data...");

    const insertSucursal = db.prepare("INSERT INTO sucursales (nombre, codigo, direccion, ciudad, departamento, telefono, responsable) VALUES (?, ?, ?, ?, ?, ?, ?)");
    insertSucursal.run('Asunción Central', 'ASU-01', 'Av. Artigas 1234', 'Asunción', 'Capital', '021-123-456', 'Juan Pérez');
    insertSucursal.run('Ciudad del Este', 'CDE-01', 'Ruta 7 km 4', 'Ciudad del Este', 'Alto Paraná', '061-123-456', 'María Gómez');
    insertSucursal.run('Encarnación', 'ENC-01', 'Ruta 1 km 2', 'Encarnación', 'Itapúa', '071-123-456', 'Carlos López');

    const insertCliente = db.prepare("INSERT INTO clientes (nombre, ruc, direccion, telefono, tipo, email, condiciones_comerciales) VALUES (?, ?, ?, ?, ?, ?, ?)");
    insertCliente.run('Empresa Tech SRL', '80012345-1', 'Centro 55', '0981123456', 'empresa', 'info@tech.com', 'Crédito 30 días');
    insertCliente.run('Juan Perez', '1234567-8', 'Barrio Obrero', '0991123456', 'persona', 'juan@gmail.com', 'Contado');

    // Inicializar cuentas corrientes de clientes al crearlos (para los seeders)
    const insertCuenta = db.prepare("INSERT INTO cuentas_corrientes_clientes (cliente_id, saldo_deudor, limite_credito) VALUES (?, ?, ?)");
    insertCuenta.run(1, 0, 10000000);
    insertCuenta.run(2, 0, 500000);

    const insertChofer = db.prepare("INSERT INTO choferes (nombre, documento, licencia, telefono) VALUES (?, ?, ?, ?)");
    insertChofer.run('Pedro Chofer', '4445556', 'Cat B', '0982223344');
    insertChofer.run('Luis Volante', '3334445', 'Cat C', '0992334455');

    const insertVehiculo = db.prepare("INSERT INTO vehiculos (chapa, marca, modelo, capacidad) VALUES (?, ?, ?, ?)");
    insertVehiculo.run('AAA 111', 'Toyota', 'Dyna', 3500);
    insertVehiculo.run('BBB 222', 'Mercedes', 'Sprinter', 5000);

    const insertPedido = db.prepare(`
      INSERT INTO pedidos (
        numero_guia, cliente_pagador_id,
        remitente_nombre, remitente_doc, remitente_tel, remitente_direccion,
        destinatario_nombre, destinatario_doc, destinatario_tel, destinatario_direccion,
        sucursal_origen_id, sucursal_destino_id, modalidad_retiro, modalidad_entrega,
        cantidad_bultos, peso, volumen, valor_declarado, precio, tipo_pago, estado,
        fecha_prevista, tipo_carga
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
    `);
    
    insertPedido.run(
      'GUIA-10001', 1, 
      'Empresa Tech SRL', '80012345-1', '0981123456', 'Centro 55',
      'Cliente Final 1', '5556667', '0971223344', 'Barrio San Pablo',
      1, 2, 'puerta', 'puerta',
      5, 120.5, 2.5, 5000000, 250000, 'credito', 'registrado',
      '2024-12-30', 'Electrónicos'
    );
  }
}

function ensureDriverUsers() {
  const choferes = db.prepare("SELECT id, nombre, documento FROM choferes WHERE COALESCE(estado, 'activo') = 'activo'").all() as any[];
  const insertUser = db.prepare(`
    INSERT INTO users (tenant_id, username, password, password_hash, role, nombre, estado, chofer_id)
    VALUES (?, ?, '', ?, 'chofer', ?, 'activo', ?)
  `);
  const updateUser = db.prepare(`
    UPDATE users
    SET role = 'chofer',
        nombre = COALESCE(nombre, ?),
        chofer_id = COALESCE(chofer_id, ?),
        password_hash = COALESCE(password_hash, ?),
        estado = COALESCE(estado, 'activo')
    WHERE username = ?
  `);

  for (const chofer of choferes) {
    const username = String(chofer.documento || `chofer${chofer.id}`).trim();
    if (!username) continue;
    const passwordHash = bcrypt.hashSync(username, 10);
    const existing = db.prepare("SELECT id FROM users WHERE username = ?").get(username) as any;
    if (existing) {
      updateUser.run(chofer.nombre, chofer.id, passwordHash, username);
    } else {
      insertUser.run(1, username, passwordHash, chofer.nombre, chofer.id);
    }
  }
}

function seedHumanResources() {
  const empleados = db.prepare("SELECT count(*) as count FROM rrhh_empleados").get() as { count: number };
  if (Number(empleados.count) > 0) return;

  const insertEmpleado = db.prepare(`
    INSERT INTO rrhh_empleados (
      nombre, documento, telefono, email, cargo, area, sucursal_id,
      fecha_ingreso, salario_base, estado, vencimiento_contrato,
      contacto_emergencia, observaciones
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertEmpleado.run(
    'Ana Benitez',
    '5123456',
    '0981555001',
    'ana.benitez@transportadora.local',
    'Coordinadora de Trafico',
    'Operaciones',
    1,
    '2024-02-01',
    5200000,
    'activo',
    '2027-02-01',
    '0981666001',
    'Responsable de despacho y monitoreo de viajes.'
  );
  insertEmpleado.run(
    'Roberto Acosta',
    '4876543',
    '0981555002',
    'roberto.acosta@transportadora.local',
    'Analista Administrativo',
    'Administracion',
    1,
    '2023-08-15',
    4300000,
    'activo',
    '2026-08-15',
    '0981666002',
    'Caja, cobranzas y documentacion.'
  );
  insertEmpleado.run(
    'Marta Ruiz',
    '4556677',
    '0981555003',
    'marta.ruiz@transportadora.local',
    'Supervisora de Deposito',
    'Deposito',
    2,
    '2024-11-04',
    3900000,
    'activo',
    '2026-11-04',
    '0981666003',
    'Control de carga, inventario temporal y calidad de entrega.'
  );

  const today = new Date().toISOString().slice(0, 10);
  const insertAsistencia = db.prepare(`
    INSERT INTO rrhh_asistencias (empleado_id, fecha, entrada, salida, tipo, estado, observaciones)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  insertAsistencia.run(1, today, '07:55', '17:10', 'normal', 'presente', 'Turno operativo completo.');
  insertAsistencia.run(2, today, '08:10', null, 'normal', 'presente', 'Caja abierta.');
  insertAsistencia.run(3, today, null, null, 'normal', 'permiso', 'Permiso medico informado.');

  const insertLicencia = db.prepare(`
    INSERT INTO rrhh_licencias (empleado_id, tipo, fecha_inicio, fecha_fin, estado, motivo)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  insertLicencia.run(3, 'Medica', today, today, 'aprobada', 'Consulta medica.');
  insertLicencia.run(2, 'Vacaciones', '2026-05-06', '2026-05-10', 'pendiente', 'Solicitud programada.');

  const insertNomina = db.prepare(`
    INSERT INTO rrhh_nomina (
      empleado_id, periodo, salario_base, horas_extra, bonificaciones, descuentos,
      total_neto, estado, fecha_pago
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertNomina.run(1, '2026-04', 5200000, 300000, 250000, 420000, 5330000, 'pendiente', null);
  insertNomina.run(2, '2026-04', 4300000, 0, 150000, 310000, 4140000, 'pendiente', null);
  insertNomina.run(3, '2026-04', 3900000, 180000, 0, 280000, 3800000, 'pendiente', null);

  const insertCapacitacion = db.prepare(`
    INSERT INTO rrhh_capacitaciones (empleado_id, tema, fecha, vencimiento, resultado, certificado_url, observaciones)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  insertCapacitacion.run(1, 'Seguridad en ruta y cadena de custodia', '2026-03-15', '2027-03-15', 'aprobada', '', 'Refuerzo anual obligatorio.');
  insertCapacitacion.run(3, 'Manipulacion de carga fragil', '2026-04-22', '2027-04-22', 'aprobada', '', 'Deposito CDE.');
  insertCapacitacion.run(2, 'Prevencion de fraude y arqueo de caja', '2026-05-08', '2027-05-08', 'programada', '', 'Para operaciones administrativas.');
}

function seedManagementData() {
  const proveedores = db.prepare("SELECT count(*) as count FROM proveedores").get() as { count: number };
  if (Number(proveedores.count) > 0) return;

  const insertProveedor = db.prepare(`
    INSERT INTO proveedores (nombre, ruc, telefono, email, direccion, categoria, contacto, estado, observaciones)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertProveedor.run('Diesel Norte SA', '80055555-1', '021-555-010', 'ventas@dieselnorte.local', 'Ruta Transchaco km 12', 'Combustible', 'Laura Gomez', 'activo', 'Proveedor principal de combustible.');
  insertProveedor.run('Taller Ruta 7', '80066666-2', '061-555-011', 'service@ruta7.local', 'CDE km 8', 'Mantenimiento', 'Hector Vera', 'activo', 'Mecanica pesada y auxilio.');
  insertProveedor.run('Insumos Logisticos PY', '80077777-3', '021-555-012', 'compras@insumoslog.local', 'Asuncion', 'Insumos deposito', 'Noelia Duarte', 'activo', 'Film, etiquetas y precintos.');

  const insertCompra = db.prepare(`
    INSERT INTO compras (proveedor_id, fecha, concepto, categoria, monto, estado, metodo_pago, comprobante, observaciones)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertCompra.run(1, '2026-04-24', 'Carga mensual de combustible', 'Combustible', 8200000, 'aprobada', 'Transferencia', 'FAC-001-001-000120', 'Cuenta corriente proveedor.');
  insertCompra.run(3, '2026-04-25', 'Reposicion de precintos y etiquetas', 'Insumos', 1350000, 'pendiente', 'Credito', 'PEND-445', 'Necesario para deposito central.');

  const insertMantenimiento = db.prepare(`
    INSERT INTO mantenimientos_vehiculo (
      vehiculo_id, proveedor_id, tipo, descripcion, fecha_programada, fecha_realizada,
      kilometraje_programado, costo_estimado, costo_real, prioridad, estado, observaciones
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertMantenimiento.run(1, 2, 'Preventivo', 'Cambio de aceite, filtros y revision de frenos', '2026-05-02', null, 125000, 1200000, 0, 'alta', 'programado', 'Programar antes de viaje largo.');
  insertMantenimiento.run(2, 2, 'Correctivo', 'Revision de suspension delantera', '2026-04-20', '2026-04-22', 87600, 1800000, 1650000, 'media', 'finalizado', 'Unidad liberada.');

  const insertIncidencia = db.prepare(`
    INSERT INTO incidencias_operativas (
      tipo, referencia_tipo, referencia_id, cliente_id, pedido_id, viaje_id,
      prioridad, estado, titulo, descripcion, fecha_reporte, fecha_cierre, responsable, resolucion
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertIncidencia.run('Reclamo cliente', 'pedido', 1, 1, 1, null, 'alta', 'abierta', 'Demora en entrega CDE', 'Cliente solicita ETA actualizado y evidencia de transito.', '2026-04-25', null, 'Mesa de control', '');
  insertIncidencia.run('Siniestro menor', 'vehiculo', 2, null, null, null, 'media', 'cerrada', 'Golpe lateral Sprinter', 'Roce menor en maniobra de deposito.', '2026-04-18', '2026-04-19', 'Operaciones', 'Se documento evidencia y se programo taller.');

  const insertInventario = db.prepare(`
    INSERT INTO inventario_deposito (
      sucursal_id, codigo, descripcion, categoria, cantidad, unidad, ubicacion,
      estado, fecha_actualizacion, observaciones
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertInventario.run(1, 'INS-PREC-001', 'Precintos numerados', 'Seguridad', 850, 'unidad', 'ASU-A1', 'disponible', '2026-04-25', 'Stock critico debajo de 300.');
  insertInventario.run(1, 'INS-FILM-001', 'Film stretch para pallets', 'Embalaje', 42, 'rollo', 'ASU-B2', 'disponible', '2026-04-25', '');
  insertInventario.run(2, 'INS-ETQ-001', 'Etiquetas termicas 100x150', 'Identificacion', 18, 'rollo', 'CDE-C1', 'bajo_stock', '2026-04-25', 'Reponer esta semana.');

  const insertTarifario = db.prepare(`
    INSERT INTO tarifarios (
      nombre, origen_sucursal_id, destino_sucursal_id, tipo_carga, modalidad,
      precio_base, precio_kg, precio_m3, seguro_porcentaje,
      vigencia_desde, vigencia_hasta, estado
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertTarifario.run('ASU-CDE Paqueteria general', 1, 2, 'General', 'puerta-puerta', 85000, 1800, 45000, 1.2, '2026-04-01', '2026-12-31', 'activo');
  insertTarifario.run('ASU-ENC Palletizado', 1, 3, 'Pallet', 'sucursal-sucursal', 120000, 1400, 30000, 1.0, '2026-04-01', '2026-12-31', 'activo');

  const insertContrato = db.prepare(`
    INSERT INTO contratos_clientes (
      cliente_id, nombre, fecha_inicio, fecha_fin, condicion_pago,
      limite_credito, tarifario_id, estado, observaciones
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertContrato.run(1, 'Contrato corporativo Tech SRL', '2026-04-01', '2027-03-31', 'Credito 30 dias', 10000000, 1, 'activo', 'Incluye retiro programado dos veces por semana.');
  insertContrato.run(2, 'Acuerdo contado clientes retail', '2026-04-01', '2026-12-31', 'Contado', 500000, 2, 'activo', 'Tarifa promocional por volumen.');
}

export default db;
