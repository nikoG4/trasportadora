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
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
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
  fecha TEXT DEFAULT CURRENT_TIMESTAMP
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
  activo INTEGER DEFAULT 1
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
  fecha TEXT DEFAULT CURRENT_TIMESTAMP
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
  fecha_resolucion TEXT
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
  fecha_creacion TEXT DEFAULT CURRENT_TIMESTAMP
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
  evidencia_json TEXT DEFAULT '{}'
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
  pdf_url TEXT
);

CREATE TABLE IF NOT EXISTS factura_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  factura_id INTEGER NOT NULL,
  pedido_id INTEGER,
  descripcion TEXT NOT NULL,
  cantidad REAL DEFAULT 1,
  precio_unitario REAL DEFAULT 0,
  total REAL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS clientes_usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER NOT NULL,
  cliente_id INTEGER NOT NULL,
  nombre TEXT NOT NULL,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  estado TEXT DEFAULT 'activo'
);
