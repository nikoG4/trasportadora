import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import fs from 'fs';
import path from 'path';
import db, { initDb } from './db';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        tenant_id: number;
        role: string;
        permisos: string[];
      };
      tenantId?: number;
    }
  }
}

const app = express();
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false
}));
app.use(cors({
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : true,
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

initDb();

const SECRET = process.env.JWT_SECRET || 'transportadora_secret_123';
const REFRESH_SECRET = process.env.REFRESH_TOKEN_SECRET || 'transportadora_refresh_secret_123';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false
});

function getRolePermissions(role: string) {
  return db.prepare("SELECT permiso FROM roles_permisos WHERE role = ?").all(role).map((row: any) => row.permiso);
}

function signAccessToken(user: any) {
  const permisos = getRolePermissions(user.role);
  return jwt.sign(
    { id: user.id, tenant_id: user.tenant_id || 1, role: user.role, permisos },
    SECRET,
    { expiresIn: (process.env.JWT_EXPIRES_IN || '1h') as any }
  );
}

function createRefreshToken(user: any) {
  const token = crypto.randomBytes(48).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token + REFRESH_SECRET).digest('hex');
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();
  db.prepare("INSERT INTO refresh_tokens (tenant_id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)").run(user.tenant_id || 1, user.id, tokenHash, expiresAt);
  return token;
}

function hashRefreshToken(token: string) {
  return crypto.createHash('sha256').update(token + REFRESH_SECRET).digest('hex');
}

function authenticate(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'Token requerido' });
  try {
    const payload = jwt.verify(token, SECRET) as any;
    req.user = {
      id: Number(payload.id),
      tenant_id: Number(payload.tenant_id || 1),
      role: String(payload.role),
      permisos: Array.isArray(payload.permisos) ? payload.permisos : getRolePermissions(String(payload.role))
    };
    req.tenantId = req.user.tenant_id;
    next();
  } catch {
    res.status(401).json({ error: 'Token invalido o expirado' });
  }
}

function requirePermission(permission: string) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Token requerido' });
    if (req.user.role === 'superadmin_saas' || req.user.permisos.includes(permission)) return next();
    return res.status(403).json({ error: 'Permiso insuficiente', permission });
  };
}

function resolveTenant(req: express.Request, _res: express.Response, next: express.NextFunction) {
  const headerTenant = Number(req.headers['x-tenant-id']);
  req.tenantId = req.user?.tenant_id || (Number.isFinite(headerTenant) && headerTenant > 0 ? headerTenant : 1);
  next();
}

function tenantIdFromRequest(req: express.Request) {
  if (req.user?.tenant_id) return req.user.tenant_id;

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (token) {
    try {
      const payload = jwt.verify(token, SECRET) as any;
      const tenantId = Number(payload.tenant_id || 1);
      if (Number.isFinite(tenantId) && tenantId > 0) return tenantId;
    } catch {}
  }

  const headerTenant = Number(req.headers['x-tenant-id']);
  return Number.isFinite(headerTenant) && headerTenant > 0 ? headerTenant : 1;
}

function audit(req: express.Request, accion: string, entidad: string, entidadId: string | number | null, antes: any, despues: any) {
  db.prepare(`
    INSERT INTO audit_logs (tenant_id, user_id, accion, entidad, entidad_id, antes_json, despues_json, ip, user_agent)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    req.tenantId || req.user?.tenant_id || 1,
    req.user?.id || null,
    accion,
    entidad,
    entidadId == null ? null : String(entidadId),
    antes == null ? null : JSON.stringify(antes),
    despues == null ? null : JSON.stringify(despues),
    req.ip,
    req.headers['user-agent'] || ''
  );
}

const rrhhFields: Record<string, string[]> = {
  empleados: [
    'nombre',
    'documento',
    'telefono',
    'email',
    'cargo',
    'area',
    'sucursal_id',
    'fecha_ingreso',
    'salario_base',
    'estado',
    'vencimiento_contrato',
    'contacto_emergencia',
    'observaciones'
  ],
  asistencias: [
    'empleado_id',
    'fecha',
    'entrada',
    'salida',
    'tipo',
    'estado',
    'observaciones'
  ],
  licencias: [
    'empleado_id',
    'tipo',
    'fecha_inicio',
    'fecha_fin',
    'estado',
    'motivo'
  ],
  nomina: [
    'empleado_id',
    'periodo',
    'salario_base',
    'horas_extra',
    'bonificaciones',
    'descuentos',
    'total_neto',
    'estado',
    'fecha_pago'
  ],
  capacitaciones: [
    'empleado_id',
    'tema',
    'fecha',
    'vencimiento',
    'resultado',
    'certificado_url',
    'observaciones'
  ]
};

const rrhhTables: Record<string, string> = {
  empleados: 'rrhh_empleados',
  asistencias: 'rrhh_asistencias',
  licencias: 'rrhh_licencias',
  nomina: 'rrhh_nomina',
  capacitaciones: 'rrhh_capacitaciones'
};

const gestionFields: Record<string, string[]> = {
  proveedores: [
    'nombre',
    'ruc',
    'telefono',
    'email',
    'direccion',
    'categoria',
    'contacto',
    'estado',
    'observaciones'
  ],
  compras: [
    'proveedor_id',
    'fecha',
    'concepto',
    'categoria',
    'monto',
    'estado',
    'metodo_pago',
    'comprobante',
    'observaciones'
  ],
  mantenimientos: [
    'vehiculo_id',
    'proveedor_id',
    'tipo',
    'descripcion',
    'fecha_programada',
    'fecha_realizada',
    'kilometraje_programado',
    'costo_estimado',
    'costo_real',
    'prioridad',
    'estado',
    'observaciones'
  ],
  incidencias: [
    'tipo',
    'referencia_tipo',
    'referencia_id',
    'cliente_id',
    'pedido_id',
    'viaje_id',
    'prioridad',
    'estado',
    'titulo',
    'descripcion',
    'fecha_reporte',
    'fecha_cierre',
    'responsable',
    'resolucion'
  ],
  inventario: [
    'sucursal_id',
    'codigo',
    'descripcion',
    'categoria',
    'cantidad',
    'unidad',
    'ubicacion',
    'estado',
    'fecha_actualizacion',
    'observaciones'
  ],
  tarifarios: [
    'nombre',
    'origen_sucursal_id',
    'destino_sucursal_id',
    'tipo_carga',
    'modalidad',
    'precio_base',
    'precio_kg',
    'precio_m3',
    'seguro_porcentaje',
    'vigencia_desde',
    'vigencia_hasta',
    'estado'
  ],
  contratos: [
    'cliente_id',
    'nombre',
    'fecha_inicio',
    'fecha_fin',
    'condicion_pago',
    'limite_credito',
    'tarifario_id',
    'estado',
    'observaciones'
  ]
};

const gestionTables: Record<string, string> = {
  proveedores: 'proveedores',
  compras: 'compras',
  mantenimientos: 'mantenimientos_vehiculo',
  incidencias: 'incidencias_operativas',
  inventario: 'inventario_deposito',
  tarifarios: 'tarifarios',
  contratos: 'contratos_clientes'
};

function pickAllowedFields(payload: Record<string, any>, allowedFields: string[]) {
  return allowedFields.filter(field => Object.prototype.hasOwnProperty.call(payload, field));
}

function insertAllowedRecord(table: string, payload: Record<string, any>, allowedFields: string[]) {
  const fields = pickAllowedFields(payload, allowedFields);
  if (Object.prototype.hasOwnProperty.call(payload, 'tenant_id') && !fields.includes('tenant_id')) {
    fields.unshift('tenant_id');
  }
  if (fields.length === 0) throw new Error('No hay datos validos para guardar');
  const placeholders = fields.map(() => '?').join(', ');
  const values = fields.map(field => payload[field]);
  return db.prepare(`INSERT INTO ${table} (${fields.join(', ')}) VALUES (${placeholders})`).run(...values);
}

function updateAllowedRecord(table: string, id: string, payload: Record<string, any>, allowedFields: string[], tenantId?: number) {
  const fields = pickAllowedFields(payload, allowedFields);
  if (fields.length === 0) throw new Error('No hay datos validos para actualizar');
  const setClause = fields.map(field => `${field} = ?`).join(', ');
  const values = fields.map(field => payload[field]);
  if (tenantId) {
    return db.prepare(`UPDATE ${table} SET ${setClause} WHERE id = ? AND tenant_id = ?`).run(...values, id, tenantId);
  }
  return db.prepare(`UPDATE ${table} SET ${setClause} WHERE id = ?`).run(...values, id);
}

app.post('/api/login', loginLimiter, resolveTenant, (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare(`
    SELECT u.*, t.nombre as tenant_nombre
    FROM users u
    LEFT JOIN tenants t ON t.id = u.tenant_id
    WHERE u.username = ? AND COALESCE(u.estado, 'activo') = 'activo'
  `).get(username) as any;
  const validPassword = user?.password_hash
    ? bcrypt.compareSync(password, user.password_hash)
    : user?.password === password;

  if (user && validPassword) {
    const token = signAccessToken(user);
    const refreshToken = createRefreshToken(user);
    audit(req, 'login.exitoso', 'users', user.id, null, { username: user.username });
    res.json({
      token,
      refreshToken,
      role: user.role,
      permisos: getRolePermissions(user.role),
      tenant: { id: user.tenant_id || 1, nombre: user.tenant_nombre || 'Empresa Demo Transportadora' }
    });
  } else {
    res.status(401).json({ error: 'Credenciales invalidas' });
  }
});

app.post('/api/chofer/login', loginLimiter, resolveTenant, (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare(`
    SELECT u.*, c.id as chofer_id_resuelto, c.nombre as chofer_nombre, c.estado as chofer_estado
    FROM users u
    LEFT JOIN choferes c ON c.id = u.chofer_id AND c.tenant_id = u.tenant_id
    WHERE u.username = ? AND COALESCE(u.estado, 'activo') = 'activo'
  `).get(username) as any;
  const validPassword = user?.password_hash
    ? bcrypt.compareSync(password, user.password_hash)
    : user?.password === password;

  if (!user || !validPassword) {
    return res.status(401).json({ error: 'Credenciales invalidas' });
  }

  if (user.role !== 'chofer') {
    return res.status(403).json({ error: 'El usuario no tiene rol de chofer' });
  }

  const choferId = user.chofer_id_resuelto || user.chofer_id;
  if (!choferId || user.chofer_estado === 'inactivo') {
    return res.status(403).json({ error: 'Usuario de chofer sin perfil activo asignado' });
  }

  const token = signAccessToken(user);
  const refreshToken = createRefreshToken(user);
  audit(req, 'login_chofer.exitoso', 'users', user.id, null, { username: user.username, chofer_id: choferId });
  res.json({
    token,
    refreshToken,
    role: user.role,
    chofer: {
      id: choferId,
      nombre: user.chofer_nombre || user.nombre || user.username
    }
  });
});

app.get('/api/chofer/me', authenticate, (req, res) => {
  if (req.user?.role !== 'chofer') return res.status(403).json({ error: 'Rol de chofer requerido' });
  const row = db.prepare(`
    SELECT c.id, c.nombre, c.documento, c.licencia, c.telefono, c.estado
    FROM users u
    JOIN choferes c ON c.id = u.chofer_id AND c.tenant_id = u.tenant_id
    WHERE u.id = ? AND u.tenant_id = ? AND COALESCE(c.estado, 'activo') = 'activo'
  `).get(req.user.id, req.user.tenant_id) as any;
  if (!row) return res.status(404).json({ error: 'Perfil de chofer no encontrado' });
  res.json({ chofer: row });
});

app.post('/api/auth/refresh', (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: 'Refresh token requerido' });
  const tokenHash = hashRefreshToken(refreshToken);
  const stored = db.prepare(`
    SELECT rt.*, u.username, u.role, u.estado
    FROM refresh_tokens rt
    JOIN users u ON u.id = rt.user_id
    WHERE rt.token_hash = ? AND rt.revoked_at IS NULL AND datetime(rt.expires_at) > datetime('now')
  `).get(tokenHash) as any;
  if (!stored || stored.estado !== 'activo') return res.status(401).json({ error: 'Refresh token invalido' });
  res.json({ token: signAccessToken(stored) });
});

app.post('/api/auth/logout', authenticate, (req, res) => {
  const { refreshToken } = req.body;
  if (refreshToken) {
    db.prepare("UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE token_hash = ?").run(hashRefreshToken(refreshToken));
  }
  res.json({ success: true });
});

app.get('/api/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

// --- Public Endpoints for Tenant Registration ---
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  limit: 5, // Máximo 5 registros por hora por IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos de registro. Por favor espera 1 hora.' }
});

app.post('/api/public/check-availability', registerLimiter, (req, res) => {
  const { email, ruc, dominio } = req.body;
  const checks: any = {};

  if (email) {
    const emailExists = db.prepare("SELECT id FROM users WHERE username = ?").get(email);
    checks.email = !emailExists;
  }

  if (ruc) {
    const rucExists = db.prepare("SELECT id FROM tenants WHERE ruc = ?").get(ruc);
    checks.ruc = !rucExists;
  }

  if (dominio) {
    const dominioExists = db.prepare("SELECT id FROM tenants WHERE dominio = ?").get(dominio);
    checks.dominio = !dominioExists;
  }

  res.json(checks);
});

app.post('/api/public/register-tenant', registerLimiter, async (req, res) => {
  const {
    nombre_empresa,
    ruc,
    email_admin,
    password_admin,
    confirm_password,
    dominio_personalizado
  } = req.body;

  // Validaciones básicas
  if (!nombre_empresa || !email_admin || !password_admin) {
    return res.status(400).json({ error: 'Faltan datos requeridos: nombre_empresa, email_admin, password_admin' });
  }

  if (password_admin !== confirm_password) {
    return res.status(400).json({ error: 'Las contraseñas no coinciden' });
  }

  if (password_admin.length < 8) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
  }

  // Validar formato de email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email_admin)) {
    return res.status(400).json({ error: 'Formato de email inválido' });
  }

  // Validar formato de RUC si se proporciona
  if (ruc && !/^\d{7,10}-\d$/.test(ruc)) {
    return res.status(400).json({ error: 'Formato de RUC inválido. Debe ser: NNNNNNN-N' });
  }

  // Validar formato de dominio si se proporciona
  if (dominio_personalizado && !/^[a-z0-9-]+\.transposaas\.com$/.test(dominio_personalizado)) {
    return res.status(400).json({ error: 'Formato de dominio inválido. Debe ser: nombre.transposaas.com' });
  }

  try {
    // Verificar disponibilidad
    const emailExists = db.prepare("SELECT id FROM users WHERE username = ?").get(email_admin);
    if (emailExists) {
      return res.status(400).json({ error: 'El email ya está registrado' });
    }

    if (ruc) {
      const rucExists = db.prepare("SELECT id FROM tenants WHERE ruc = ?").get(ruc);
      if (rucExists) {
        return res.status(400).json({ error: 'El RUC ya está registrado' });
      }
    }

    if (dominio_personalizado) {
      const dominioExists = db.prepare("SELECT id FROM tenants WHERE dominio = ?").get(dominio_personalizado);
      if (dominioExists) {
        return res.status(400).json({ error: 'El dominio ya está registrado' });
      }
    }

    // Crear tenant
    const tenantResult = db.prepare(`
      INSERT INTO tenants (nombre, ruc, dominio, plan, estado, fecha_alta, configuracion_json)
      VALUES (?, ?, ?, 'demo', 'activo', datetime('now'), '{}')
    `).run(nombre_empresa, ruc || null, dominio_personalizado || null);

    const tenantId = tenantResult.lastInsertRowid;

    // Crear usuario admin para el tenant
    const passwordHash = bcrypt.hashSync(password_admin, 10);
    const userResult = db.prepare(`
      INSERT INTO users (tenant_id, username, password, password_hash, role, nombre, estado)
      VALUES (?, ?, '', ?, 'admin_empresa', ?, 'activo')
    `).run(tenantId, email_admin, passwordHash, `Admin ${nombre_empresa}`);

    const userId = userResult.lastInsertRowid;

    /*
    El alta publica deja el tenant limpio: solo empresa y admin.
    Este bloque historico creaba una sucursal y configuracion global por defecto.

    // Crear sucursal base para el tenant
    const sucursalResult = db.prepare(`
      INSERT INTO sucursales (nombre, codigo, direccion, ciudad, departamento, telefono, responsable, estado, tenant_id)
      VALUES (?, 'SUC-001', 'Dirección Principal', 'Ciudad', 'Departamento', '', 'Administrador', 'activo', ?)
    `).run(`Sucursal Principal ${nombre_empresa}`, tenantId);

    const sucursalId = sucursalResult.lastInsertRowid;

    // Inicializar configuración básica del tenant
    const configInserts = [
      ['membrete', `${nombre_empresa}\\nRUC: ${ruc || 'Pendiente'}\\nTel: Pendiente`],
      ['ticket_width_chars', '32'],
      ['ticket_copies', '2'],
      ['moneda', 'PYG'],
      ['idioma', 'es']
    ];

    const insertConfig = db.prepare("INSERT INTO configuracion (clave, valor) VALUES (?, ?)");
    configInserts.forEach(([clave, valor]) => {
      insertConfig.run(clave, valor);
    });

    // Crear registro de auditoría
    */

    db.prepare(`
      INSERT INTO audit_logs (tenant_id, user_id, accion, entidad, entidad_id, antes_json, despues_json, ip, user_agent, fecha)
      VALUES (?, ?, 'tenant.creado', 'tenants', ?, NULL, ?, ?, ?, datetime('now'))
    `).run(tenantId, userId, String(tenantId), JSON.stringify({
      nombre: nombre_empresa,
      ruc: ruc || null,
      dominio: dominio_personalizado || null,
      creado_por: email_admin
    }), req.ip, req.headers['user-agent'] || '');

    res.json({
      success: true,
      message: 'Tenant registrado exitosamente',
      tenant: {
        id: tenantId,
        nombre: nombre_empresa,
        ruc: ruc || null,
        dominio: dominio_personalizado || null,
        plan: 'demo',
        estado: 'activo',
        limpio: true
      },
      admin: {
        id: userId,
        email: email_admin,
        role: 'admin_empresa'
      },
      credentials: {
        email: email_admin,
        password: password_admin // Solo devolver en el momento de registro
      },
      next_steps: [
        'Inicia sesión con tus credenciales',
        'Completa tu perfil de empresa',
        'Configura tu primera sucursal',
        'Agrega tus primeros clientes',
        'Registra tus vehículos y choferes',
        'Crea tu primer pedido de transporte'
      ]
    });

  } catch (error: any) {
    console.error('Error registrando tenant:', error);
    res.status(500).json({ error: 'Error al registrar tenant', details: error.message });
  }
});

app.get('/api/tenants', authenticate, requirePermission('configuracion.manage'), (_req, res) => {
  res.json(db.prepare("SELECT id, nombre, ruc, dominio, plan, estado, fecha_alta, configuracion_json FROM tenants ORDER BY id").all());
});

app.get('/api/auditoria', authenticate, requirePermission('configuracion.manage'), (req, res) => {
  const tenantId = req.user?.role === 'superadmin_saas' && req.query.tenant_id ? Number(req.query.tenant_id) : req.user?.tenant_id || 1;
  const accion = req.query.accion ? `%${String(req.query.accion)}%` : null;
  const entidad = req.query.entidad ? String(req.query.entidad) : null;
  const rows = db.prepare(`
    SELECT a.*, u.username
    FROM audit_logs a
    LEFT JOIN users u ON u.id = a.user_id
    WHERE a.tenant_id = ?
      AND (? IS NULL OR a.accion LIKE ?)
      AND (? IS NULL OR a.entidad = ?)
    ORDER BY datetime(a.fecha) DESC
    LIMIT 300
  `).all(tenantId, accion, accion, entidad, entidad);
  res.json(rows);
});

app.post('/api/login-old-disabled', (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare("SELECT * FROM users WHERE username = ? AND password = ?").get(username, password) as any;
  if (user) {
    const token = jwt.sign({ id: user.id, role: user.role }, SECRET, { expiresIn: '1d' });
    res.json({ token, role: user.role });
  } else {
    res.status(401).json({ error: 'Credenciales inválidas' });
  }
});

// --- Usuarios ---
app.get('/api/usuarios', authenticate, requirePermission('users.manage'), (req, res) => {
  res.json(db.prepare("SELECT id, tenant_id, username, role, nombre, estado, chofer_id FROM users WHERE tenant_id = ? OR ? = 'superadmin_saas'").all(req.user?.tenant_id || 1, req.user?.role || ''));
});
app.post('/api/usuarios', authenticate, requirePermission('users.manage'), (req, res) => {
  const { username, password, role, nombre, tenant_id, chofer_id } = req.body;
  try {
    const passwordHash = bcrypt.hashSync(password, 10);
    const resolvedTenantId = req.user?.role === 'superadmin_saas' && tenant_id ? tenant_id : req.user?.tenant_id || 1;
    const info = db.prepare("INSERT INTO users (tenant_id, username, password, password_hash, role, nombre, estado, chofer_id) VALUES (?, ?, ?, ?, ?, ?, 'activo', ?)").run(resolvedTenantId, username, '', passwordHash, role || 'operador', nombre || username, role === 'chofer' ? chofer_id || null : null);
    audit(req, 'usuario.creado', 'users', String(info.lastInsertRowid), null, { username, role, tenant_id: resolvedTenantId, chofer_id });
    res.json({ id: info.lastInsertRowid });
  } catch (e) {
    res.status(400).json({ error: 'El usuario ya existe o hubo un error' });
  }
});
app.delete('/api/usuarios/:id', authenticate, requirePermission('users.manage'), (req, res) => {
  const before = db.prepare("SELECT id, username, role, tenant_id FROM users WHERE id = ? AND (tenant_id = ? OR ? = 'superadmin_saas')").get(req.params.id, req.user?.tenant_id || 1, req.user?.role || '');
  db.prepare("UPDATE users SET estado = 'inactivo' WHERE id = ? AND (tenant_id = ? OR ? = 'superadmin_saas')").run(req.params.id, req.user?.tenant_id || 1, req.user?.role || '');
  audit(req, 'usuario.inactivado', 'users', req.params.id, before, { estado: 'inactivo' });
  res.json({ success: true });
});

// --- Sucursales ---
app.get('/api/sucursales', (req, res) => {
  res.json(db.prepare("SELECT * FROM sucursales WHERE tenant_id = ? ORDER BY id").all(tenantIdFromRequest(req)));
});
app.post('/api/sucursales', (req, res) => {
  const { nombre, codigo, direccion, ciudad, departamento, telefono, responsable, estado, latitud, longitud } = req.body;
  const info = db.prepare("INSERT INTO sucursales (tenant_id, nombre, codigo, direccion, ciudad, departamento, telefono, responsable, estado, latitud, longitud) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(tenantIdFromRequest(req), nombre, codigo, direccion, ciudad, departamento, telefono, responsable, estado || 'activo', latitud || null, longitud || null);
  res.json({ id: info.lastInsertRowid });
});

// --- Clientes ---
app.get('/api/clientes', (req, res) => res.json(db.prepare("SELECT * FROM clientes WHERE tenant_id = ? ORDER BY id").all(tenantIdFromRequest(req))));
app.post('/api/clientes', (req, res) => {
  const { nombre, ruc, direccion, telefono, tipo, email, condiciones_comerciales, latitud, longitud } = req.body;
  const info = db.prepare("INSERT INTO clientes (tenant_id, nombre, ruc, direccion, telefono, tipo, email, condiciones_comerciales, latitud, longitud) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(tenantIdFromRequest(req), nombre, ruc, direccion, telefono, tipo || 'persona', email, condiciones_comerciales, latitud || null, longitud || null);
  res.json({ id: info.lastInsertRowid });
});

// --- Choferes ---
app.get('/api/choferes', (req, res) => res.json(db.prepare(`
  SELECT c.*, u.username
  FROM choferes c
  LEFT JOIN users u ON u.chofer_id = c.id AND u.role = 'chofer' AND COALESCE(u.estado, 'activo') = 'activo'
  WHERE c.tenant_id = ?
  ORDER BY c.id
`).all(tenantIdFromRequest(req))));
app.post('/api/choferes', (req, res) => {
  const { nombre, documento, licencia, telefono, vencimiento_licencia, username, password } = req.body;
  const tenantId = tenantIdFromRequest(req);
  const tx = db.transaction(() => {
    const info = db.prepare("INSERT INTO choferes (tenant_id, nombre, documento, licencia, telefono, vencimiento_licencia) VALUES (?, ?, ?, ?, ?, ?)").run(tenantId, nombre, documento, licencia, telefono, vencimiento_licencia || '2026-12-31');
    if (username && password) {
      const passwordHash = bcrypt.hashSync(password, 10);
      db.prepare(`
        INSERT INTO users (tenant_id, username, password, password_hash, role, nombre, estado, chofer_id)
        VALUES (?, ?, '', ?, 'chofer', ?, 'activo', ?)
      `).run(tenantId, username, passwordHash, nombre, info.lastInsertRowid);
    }
    return info;
  });
  const info = tx();
  res.json({ id: info.lastInsertRowid });
});

// --- Vehiculos ---
app.get('/api/vehiculos', (req, res) => res.json(db.prepare("SELECT * FROM vehiculos WHERE tenant_id = ? ORDER BY id").all(tenantIdFromRequest(req))));
app.post('/api/vehiculos', (req, res) => {
  const { chapa, marca, modelo, capacidad, vencimiento_seguro, vencimiento_habilitacion } = req.body;
  const info = db.prepare("INSERT INTO vehiculos (tenant_id, chapa, marca, modelo, capacidad, vencimiento_seguro, vencimiento_habilitacion) VALUES (?, ?, ?, ?, ?, ?, ?)").run(tenantIdFromRequest(req), chapa, marca, modelo, capacidad, vencimiento_seguro || '2026-12-31', vencimiento_habilitacion || '2026-12-31');
  res.json({ id: info.lastInsertRowid });
});

// --- Pedidos ---
app.get('/api/pedidos', (req, res) => {
  const rows = db.prepare(`
    SELECT p.*, 
           c.nombre as cliente_pagador_nombre,
           so.nombre as sucursal_origen_nombre,
           sd.nombre as sucursal_destino_nombre
    FROM pedidos p 
    LEFT JOIN clientes c ON p.cliente_pagador_id = c.id
    LEFT JOIN sucursales so ON p.sucursal_origen_id = so.id
    LEFT JOIN sucursales sd ON p.sucursal_destino_id = sd.id
    WHERE p.tenant_id = ?
    ORDER BY p.id DESC
  `).all(tenantIdFromRequest(req));
  res.json(rows);
});
app.post('/api/pedidos', (req, res) => {
  const { 
    numero_guia, cliente_pagador_id, remitente_nombre, remitente_doc, remitente_tel, remitente_direccion,
    destinatario_nombre, destinatario_doc, destinatario_tel, destinatario_direccion,
    sucursal_origen_id, sucursal_destino_id, modalidad_retiro, modalidad_entrega,
    cantidad_bultos, peso, volumen, valor_declarado, precio, tipo_pago,
    fecha_prevista, tipo_carga, estado
  } = req.body;
  
  if (!cliente_pagador_id || !sucursal_origen_id || !sucursal_destino_id || !remitente_nombre || !destinatario_nombre || !tipo_carga) {
    return res.status(400).json({ error: 'Faltan datos requeridos (cliente pagador, origen, destino, remitente, destinatario, tipo carga)' });
  }
  if ((cantidad_bultos || 1) <= 0 || (peso || 0) < 0) {
    return res.status(400).json({ error: 'Cantidad de bultos o peso inválidos' });
  }

  try {
    const tenantId = tenantIdFromRequest(req);
    const info = db.prepare(`
      INSERT INTO pedidos (
        tenant_id, numero_guia, cliente_pagador_id, remitente_nombre, remitente_doc, remitente_tel, remitente_direccion,
        destinatario_nombre, destinatario_doc, destinatario_tel, destinatario_direccion,
        sucursal_origen_id, sucursal_destino_id, modalidad_retiro, modalidad_entrega,
        cantidad_bultos, peso, volumen, valor_declarado, precio, tipo_pago, estado,
        fecha_prevista, tipo_carga
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
    `).run(
      tenantId, numero_guia, cliente_pagador_id, remitente_nombre, remitente_doc, remitente_tel, remitente_direccion,
      destinatario_nombre, destinatario_doc, destinatario_tel, destinatario_direccion,
      sucursal_origen_id, sucursal_destino_id, modalidad_retiro, modalidad_entrega,
      cantidad_bultos || 1, peso || 0, volumen || 0, valor_declarado || 0, precio || 0, tipo_pago, estado || 'pendiente_planificacion',
      fecha_prevista, tipo_carga
    );
    res.json({ id: info.lastInsertRowid });
  } catch (e: any) {
    res.status(500).json({ error: 'Error guardando pedido', details: e.message });
  }
});
app.get('/api/pedidos/:id', (req, res) => {
  const row = db.prepare("SELECT * FROM pedidos WHERE id = ? AND tenant_id = ?").get(req.params.id, tenantIdFromRequest(req));
  if (!row) return res.status(404).json({ error: 'Pedido no encontrado' });
  res.json(row);
});
app.put('/api/pedidos/:id', (req, res) => {
  const fields = Object.keys(req.body);
  const values = Object.values(req.body);
  if (fields.length === 0) return res.status(400).json({ error: 'No data' });
  const setClause = fields.map(f => `${f} = ?`).join(', ');
  try {
    db.prepare(`UPDATE pedidos SET ${setClause} WHERE id = ? AND tenant_id = ?`).run(...values, req.params.id, tenantIdFromRequest(req));
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: 'Error actualizando pedido', details: e.message });
  }
});
app.delete('/api/pedidos/:id', (req, res) => {
  db.prepare("UPDATE pedidos SET estado = 'cancelado' WHERE id = ? AND tenant_id = ?").run(req.params.id, tenantIdFromRequest(req));
  res.json({ success: true });
});
app.put('/api/pedidos/:id/estado', (req, res) => {
  const { estado, foto_pod } = req.body;
  if (foto_pod) {
    db.prepare("UPDATE pedidos SET estado = ?, foto_pod = ? WHERE id = ? AND tenant_id = ?").run(estado, foto_pod, req.params.id, tenantIdFromRequest(req));
  } else {
    db.prepare("UPDATE pedidos SET estado = ? WHERE id = ? AND tenant_id = ?").run(estado, req.params.id, tenantIdFromRequest(req));
  }
  res.json({ success: true });
});
app.put('/api/pedidos/:id/pod', (req, res) => {
  const { estado, foto_pod, firma_pod, observaciones, bultos_reales, motivo_devolucion } = req.body;
  db.prepare(`
    UPDATE pedidos 
    SET estado = ?, foto_pod = COALESCE(?, foto_pod), firma_pod = ?, observaciones = ?, bultos_reales = ?, motivo_devolucion = ?
    WHERE id = ? AND tenant_id = ?
  `).run(estado, foto_pod || null, firma_pod, observaciones, bultos_reales, motivo_devolucion || null, req.params.id, tenantIdFromRequest(req));
  res.json({ success: true });
});

// --- Viajes ---
app.get('/api/viajes', (req, res) => {
  const rows = db.prepare(`
    SELECT v.*, ch.nombre as chofer_nombre, veh.chapa as vehiculo_chapa,
           so.nombre as sucursal_origen_nombre, sd.nombre as sucursal_destino_nombre
    FROM viajes v 
    LEFT JOIN choferes ch ON v.chofer_id = ch.id 
    LEFT JOIN vehiculos veh ON v.vehiculo_id = veh.id
    LEFT JOIN sucursales so ON v.sucursal_origen_id = so.id
    LEFT JOIN sucursales sd ON v.sucursal_destino_id = sd.id
    WHERE v.tenant_id = ?
    ORDER BY v.id DESC
  `).all(tenantIdFromRequest(req));
  res.json(rows);
});
app.post('/api/viajes', (req, res) => {
  const { chofer_id, vehiculo_id, sucursal_origen_id, sucursal_destino_id, fecha_inicio, costo_estimado, pedido_ids, tipo_viaje } = req.body;
  const tenantId = tenantIdFromRequest(req);
  
  if (!chofer_id || !vehiculo_id || !sucursal_origen_id || !sucursal_destino_id || !fecha_inicio) {
    return res.status(400).json({ error: 'Faltan datos requeridos (chofer, vehículo, origen, destino, fecha)' });
  }
  if (!pedido_ids || pedido_ids.length === 0) {
    return res.status(400).json({ error: 'Un viaje debe tener al menos un pedido' });
  }

  const vehiculo = db.prepare("SELECT estado FROM vehiculos WHERE id = ? AND tenant_id = ?").get(vehiculo_id, tenantId) as any;
  if (vehiculo?.estado === 'en viaje') {
    return res.status(400).json({ error: 'El vehículo seleccionado ya está en un viaje activo' });
  }

  const chofer = db.prepare("SELECT 1 FROM viajes WHERE chofer_id = ? AND tenant_id = ? AND estado != 'finalizado' AND estado != 'cancelado'").get(chofer_id, tenantId) as any;
  if (chofer) {
    return res.status(400).json({ error: 'El chofer seleccionado ya está en un viaje activo' });
  }

  const transaction = db.transaction(() => {
    const info = db.prepare("INSERT INTO viajes (tenant_id, chofer_id, vehiculo_id, sucursal_origen_id, sucursal_destino_id, fecha_inicio, costo_estimado, estado, tipo_viaje) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(tenantId, chofer_id, vehiculo_id, sucursal_origen_id, sucursal_destino_id, fecha_inicio, costo_estimado || 0, 'planificado', tipo_viaje || 'larga_distancia');
    const viajeId = info.lastInsertRowid;
    const stmt = db.prepare("UPDATE pedidos SET viaje_id = ?, estado = 'planificado' WHERE id = ? AND tenant_id = ? AND estado IN ('pendiente_planificacion', 'registrado', 'borrador')");
    let assigned = 0;
    for (const pId of pedido_ids) {
      const res = stmt.run(viajeId, pId, tenantId);
      assigned += res.changes;
    }
    if (assigned !== pedido_ids.length) {
      throw new Error('Algunos pedidos no son válidos para planificar');
    }
    return viajeId;
  });

  try {
    const id = transaction();
    db.prepare("UPDATE vehiculos SET estado = 'en viaje' WHERE id = ? AND tenant_id = ?").run(vehiculo_id, tenantId);
    res.json({ id });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error creando viaje' });
  }
});
app.get('/api/viajes/chofer/:id', (req, res) => {
  const tenantId = tenantIdFromRequest(req);
  const rows = db.prepare(`SELECT v.*, veh.chapa as vehiculo_chapa FROM viajes v LEFT JOIN vehiculos veh ON v.vehiculo_id = veh.id WHERE v.chofer_id = ? AND v.tenant_id = ? AND v.estado != 'finalizado'`).all(req.params.id, tenantId);
  const getPedidos = db.prepare(`
    SELECT p.*,
           so.nombre as sucursal_origen_nombre,
           sd.nombre as sucursal_destino_nombre
    FROM pedidos p
    LEFT JOIN sucursales so ON p.sucursal_origen_id = so.id
    LEFT JOIN sucursales sd ON p.sucursal_destino_id = sd.id
    WHERE p.viaje_id = ? AND p.tenant_id = ?
  `);
  res.json(rows.map((v: any) => ({ ...v, pedidos: getPedidos.all(v.id, tenantId) })));
});
app.put('/api/viajes/:id/estado', (req, res) => {
  const { estado, incidencias } = req.body;
  const viajeId = req.params.id;
  const tenantId = tenantIdFromRequest(req);
  
  if (incidencias) {
    db.prepare("UPDATE viajes SET estado = ?, incidencias = ? WHERE id = ? AND tenant_id = ?").run(estado, incidencias, viajeId, tenantId);
  } else {
    db.prepare("UPDATE viajes SET estado = ? WHERE id = ? AND tenant_id = ?").run(estado, viajeId, tenantId);
  }
  
  if (estado === 'en_ruta') {
    db.prepare("UPDATE pedidos SET estado = 'en_transito' WHERE viaje_id = ? AND tenant_id = ? AND estado = 'planificado'").run(viajeId, tenantId);
  } else if (estado === 'finalizado') {
    const viaje = db.prepare("SELECT vehiculo_id FROM viajes WHERE id = ? AND tenant_id = ?").get(viajeId, tenantId) as any;
    if (viaje) {
      db.prepare("UPDATE vehiculos SET estado = 'disponible' WHERE id = ? AND tenant_id = ?").run(viaje.vehiculo_id, tenantId);
    }
  }
  res.json({ success: true });
});

// --- Tracking ---
app.post('/api/tracking', (req, res) => {
  const { vehiculo_id, chofer_id, latitud, longitud } = req.body;
  db.prepare("INSERT INTO tracking (tenant_id, vehiculo_id, chofer_id, latitud, longitud, timestamp) VALUES (?, ?, ?, ?, ?, datetime('now'))").run(tenantIdFromRequest(req), vehiculo_id, chofer_id || null, latitud, longitud);
  res.json({ success: true });
});
app.get('/api/tracking/latest', (req, res) => {
  const tenantId = tenantIdFromRequest(req);
  const rows = db.prepare(`
    SELECT t.id, t.vehiculo_id, t.chofer_id, t.latitud, t.longitud, t.timestamp,
           COALESCE(v.chapa, 'GPS Chofer') as chapa,
           c.nombre as chofer_nombre
    FROM tracking t
    INNER JOIN (
      SELECT COALESCE('vehiculo-' || vehiculo_id, 'chofer-' || chofer_id) as ref, MAX(timestamp) as max_time
      FROM tracking
      WHERE tenant_id = ? AND latitud IS NOT NULL AND longitud IS NOT NULL
      GROUP BY COALESCE('vehiculo-' || vehiculo_id, 'chofer-' || chofer_id)
    ) tm ON COALESCE('vehiculo-' || t.vehiculo_id, 'chofer-' || t.chofer_id) = tm.ref AND t.timestamp = tm.max_time
    LEFT JOIN vehiculos v ON t.vehiculo_id = v.id
    LEFT JOIN choferes c ON t.chofer_id = c.id
    WHERE t.tenant_id = ?
  `).all(tenantId, tenantId);
  res.json(rows);
});

// --- Combustible ---
app.get('/api/combustible', (req, res) => {
  const tenantId = tenantIdFromRequest(req);
  res.json(db.prepare(`
    SELECT c.*, v.chapa
    FROM combustible c
    JOIN vehiculos v ON c.vehiculo_id = v.id AND v.tenant_id = c.tenant_id
    WHERE c.tenant_id = ?
    ORDER BY c.fecha DESC
  `).all(tenantId));
});
app.post('/api/combustible', (req, res) => {
  const { vehiculo_id, litros, monto, fecha, kilometraje } = req.body;
  db.prepare("INSERT INTO combustible (tenant_id, vehiculo_id, litros, monto, fecha, kilometraje) VALUES (?, ?, ?, ?, ?, ?)").run(tenantIdFromRequest(req), vehiculo_id, litros, monto, fecha, kilometraje);
  res.json({ success: true });
});

// --- Alertas y Reportes ---
app.get('/api/alertas/vencimientos', (req, res) => {
  const tenantId = tenantIdFromRequest(req);
  const vehiculos = db.prepare("SELECT id, chapa, vencimiento_seguro, vencimiento_habilitacion FROM vehiculos WHERE tenant_id = ?").all(tenantId);
  const choferes = db.prepare("SELECT id, nombre, vencimiento_licencia FROM choferes WHERE tenant_id = ?").all(tenantId);
  res.json({ vehiculos, choferes });
});

// --- Configuracion ---
app.get('/api/configuracion', (req, res) => res.json(db.prepare("SELECT * FROM configuracion WHERE tenant_id = ?").all(tenantIdFromRequest(req))));
app.put('/api/configuracion', (req, res) => {
  const { clave, valor } = req.body;
  db.prepare(`
    INSERT INTO configuracion (tenant_id, clave, valor) VALUES (?, ?, ?)
    ON CONFLICT(tenant_id, clave) DO UPDATE SET valor = excluded.valor
  `).run(tenantIdFromRequest(req), clave, valor);
  res.json({ success: true });
});
app.put('/api/configuracion/bulk', (req, res) => {
  const entries = Object.entries(req.body || {});
  const stmt = db.prepare(`
    INSERT INTO configuracion (tenant_id, clave, valor) VALUES (?, ?, ?)
    ON CONFLICT(tenant_id, clave) DO UPDATE SET valor = excluded.valor
  `);
  const tenantId = tenantIdFromRequest(req);
  const tx = db.transaction(() => {
    for (const [clave, valor] of entries) {
      stmt.run(tenantId, clave, typeof valor === 'string' ? valor : JSON.stringify(valor));
    }
  });
  tx();
  res.json({ success: true });
});

app.get('/api/alertas', authenticate, (req, res) => {
  const estado = req.query.estado ? String(req.query.estado) : null;
  res.json(db.prepare(`
    SELECT *
    FROM alertas
    WHERE tenant_id = ? AND (? IS NULL OR estado = ?)
    ORDER BY CASE severidad WHEN 'critica' THEN 0 WHEN 'alta' THEN 1 WHEN 'media' THEN 2 ELSE 3 END,
             datetime(fecha_creacion) DESC
    LIMIT 300
  `).all(req.user?.tenant_id || 1, estado, estado));
});

app.post('/api/alertas', authenticate, (req, res) => {
  const { tipo, severidad, titulo, descripcion, entidad, entidad_id, asignado_a } = req.body;
  const info = db.prepare(`
    INSERT INTO alertas (tenant_id, tipo, severidad, titulo, descripcion, entidad, entidad_id, asignado_a)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(req.user?.tenant_id || 1, tipo, severidad || 'media', titulo, descripcion, entidad, entidad_id, asignado_a || null);
  audit(req, 'alerta.creada', 'alertas', String(info.lastInsertRowid), null, req.body);
  res.json({ id: info.lastInsertRowid });
});

app.put('/api/alertas/:id', authenticate, (req, res) => {
  const before = db.prepare("SELECT * FROM alertas WHERE id = ? AND tenant_id = ?").get(req.params.id, req.user?.tenant_id || 1);
  const estado = req.body.estado || 'leida';
  const fechaResolucion = estado === 'resuelta' ? new Date().toISOString() : null;
  db.prepare("UPDATE alertas SET estado = ?, fecha_resolucion = COALESCE(?, fecha_resolucion) WHERE id = ? AND tenant_id = ?").run(estado, fechaResolucion, req.params.id, req.user?.tenant_id || 1);
  audit(req, 'alerta.actualizada', 'alertas', req.params.id, before, { estado });
  res.json({ success: true });
});

app.get('/api/reglas', authenticate, requirePermission('configuracion.manage'), (req, res) => {
  res.json(db.prepare("SELECT * FROM reglas_operativas WHERE tenant_id = ? ORDER BY prioridad ASC, id DESC").all(req.user?.tenant_id || 1));
});

app.post('/api/reglas', authenticate, requirePermission('configuracion.manage'), (req, res) => {
  const { nombre, descripcion, entidad, evento, condicion_json, accion_json, prioridad, activo } = req.body;
  const info = db.prepare(`
    INSERT INTO reglas_operativas (tenant_id, nombre, descripcion, entidad, evento, condicion_json, accion_json, prioridad, activo)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(req.user?.tenant_id || 1, nombre, descripcion, entidad, evento, JSON.stringify(condicion_json || {}), JSON.stringify(accion_json || {}), prioridad || 100, activo === false ? 0 : 1);
  audit(req, 'regla.creada', 'reglas_operativas', String(info.lastInsertRowid), null, req.body);
  res.json({ id: info.lastInsertRowid });
});

app.put('/api/reglas/:id', authenticate, requirePermission('configuracion.manage'), (req, res) => {
  const before = db.prepare("SELECT * FROM reglas_operativas WHERE id = ? AND tenant_id = ?").get(req.params.id, req.user?.tenant_id || 1);
  const { nombre, descripcion, entidad, evento, condicion_json, accion_json, prioridad, activo } = req.body;
  db.prepare(`
    UPDATE reglas_operativas
    SET nombre = ?, descripcion = ?, entidad = ?, evento = ?, condicion_json = ?, accion_json = ?, prioridad = ?, activo = ?
    WHERE id = ? AND tenant_id = ?
  `).run(nombre, descripcion, entidad, evento, JSON.stringify(condicion_json || {}), JSON.stringify(accion_json || {}), prioridad || 100, activo ? 1 : 0, req.params.id, req.user?.tenant_id || 1);
  audit(req, 'regla.actualizada', 'reglas_operativas', req.params.id, before, req.body);
  res.json({ success: true });
});

app.get('/api/reglas/ejecuciones', authenticate, requirePermission('configuracion.manage'), (req, res) => {
  res.json(db.prepare("SELECT * FROM reglas_ejecuciones WHERE tenant_id = ? ORDER BY datetime(fecha) DESC LIMIT 300").all(req.user?.tenant_id || 1));
});

function haversineKm(a: { latitud: number; longitud: number }, b: { latitud: number; longitud: number }) {
  const toRad = (value: number) => value * Math.PI / 180;
  const radius = 6371;
  const dLat = toRad(b.latitud - a.latitud);
  const dLon = toRad(b.longitud - a.longitud);
  const lat1 = toRad(a.latitud);
  const lat2 = toRad(b.latitud);
  const sin = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * radius * Math.asin(Math.sqrt(sin));
}

app.post('/api/rutas/optimizar', authenticate, requirePermission('viajes.manage'), (req, res) => {
  const tenantId = req.user?.tenant_id || 1;
  const pedidoIds = Array.isArray(req.body.pedido_ids) ? req.body.pedido_ids : [];
  if (pedidoIds.length === 0) return res.status(400).json({ error: 'Seleccione pedidos para optimizar' });

  const pedidos = db.prepare(`
    SELECT *
    FROM pedidos
    WHERE tenant_id = ? AND id IN (${pedidoIds.map(() => '?').join(',')})
  `).all(tenantId, ...pedidoIds) as any[];
  const validStops = pedidos
    .map(p => ({
      pedido: p,
      latitud: Number(p.latitud_entrega || p.latitud_retiro),
      longitud: Number(p.longitud_entrega || p.longitud_retiro),
      direccion: p.destinatario_direccion || p.remitente_direccion || ''
    }))
    .filter(p => Number.isFinite(p.latitud) && Number.isFinite(p.longitud));
  if (validStops.length === 0) return res.status(400).json({ error: 'Los pedidos no tienen coordenadas reales de retiro/entrega' });

  const vehiculo = db.prepare("SELECT * FROM vehiculos WHERE tenant_id = ? AND estado = 'disponible' ORDER BY capacidad_kg DESC, capacidad DESC LIMIT 1").get(tenantId) as any;
  const chofer = db.prepare("SELECT * FROM choferes WHERE tenant_id = ? AND estado = 'activo' ORDER BY id LIMIT 1").get(tenantId) as any;
  let current = { latitud: validStops[0].latitud, longitud: validStops[0].longitud };
  const remaining = [...validStops];
  const ordered: any[] = [];
  let totalKm = 0;
  while (remaining.length) {
    remaining.sort((a, b) => haversineKm(current, a) - haversineKm(current, b));
    const next = remaining.shift()!;
    totalKm += ordered.length ? haversineKm(current, next) : 0;
    ordered.push(next);
    current = { latitud: next.latitud, longitud: next.longitud };
  }
  const duracionMin = Math.round((totalKm / 35) * 60 + ordered.length * 8);
  const costoEstimado = Math.round(totalKm * Number(vehiculo?.costo_km || 0));
  const ruta = {
    vehiculo,
    chofer,
    distancia_total_km: Number(totalKm.toFixed(2)),
    duracion_total_min: duracionMin,
    costo_estimado: costoEstimado,
    paradas: ordered.map((stop, index) => ({
      pedido_id: stop.pedido.id,
      numero_guia: stop.pedido.numero_guia,
      orden: index + 1,
      tipo_parada: 'entrega',
      direccion: stop.direccion,
      latitud: stop.latitud,
      longitud: stop.longitud,
      eta_min_desde_inicio: Math.round((index + 1) * (duracionMin / ordered.length))
    }))
  };
  res.json(ruta);
});

app.post('/api/rutas', authenticate, requirePermission('viajes.manage'), (req, res) => {
  const tenantId = req.user?.tenant_id || 1;
  const { viaje_id, vehiculo_id, chofer_id, distancia_total_km, duracion_total_min, costo_estimado, paradas } = req.body;
  const tx = db.transaction(() => {
    const info = db.prepare(`
      INSERT INTO rutas_planificadas (tenant_id, viaje_id, vehiculo_id, chofer_id, distancia_total_km, duracion_total_min, costo_estimado, estado)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'planificada')
    `).run(tenantId, viaje_id || null, vehiculo_id || null, chofer_id || null, distancia_total_km || 0, duracion_total_min || 0, costo_estimado || 0);
    const insertStop = db.prepare(`
      INSERT INTO paradas_ruta (ruta_id, pedido_id, orden, tipo_parada, direccion, latitud, longitud, eta, estado)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pendiente')
    `);
    for (const stop of paradas || []) {
      insertStop.run(info.lastInsertRowid, stop.pedido_id, stop.orden, stop.tipo_parada || 'entrega', stop.direccion, stop.latitud, stop.longitud, stop.eta || null);
    }
    return info.lastInsertRowid;
  });
  const id = tx();
  audit(req, 'ruta.creada', 'rutas_planificadas', String(id), null, req.body);
  res.json({ id });
});

app.get('/api/rutas/:id', authenticate, requirePermission('viajes.manage'), (req, res) => {
  const ruta = db.prepare("SELECT * FROM rutas_planificadas WHERE id = ? AND tenant_id = ?").get(req.params.id, req.user?.tenant_id || 1) as any;
  if (!ruta) return res.status(404).json({ error: 'Ruta no encontrada' });
  ruta.paradas = db.prepare("SELECT * FROM paradas_ruta WHERE ruta_id = ? ORDER BY orden ASC").all(req.params.id);
  res.json(ruta);
});

app.post('/api/facturas', authenticate, requirePermission('finanzas.manage'), (req, res) => {
  const tenantId = req.user?.tenant_id || 1;
  const { cliente_id, pedido_ids, condicion_pago, timbrado } = req.body;
  const pedidos = db.prepare(`
    SELECT * FROM pedidos
    WHERE tenant_id = ? AND cliente_pagador_id = ? AND id IN (${(pedido_ids || []).map(() => '?').join(',')})
  `).all(tenantId, cliente_id, ...(pedido_ids || [])) as any[];
  if (pedidos.length === 0) return res.status(400).json({ error: 'No hay pedidos validos para facturar' });
  const subtotal = pedidos.reduce((sum, p) => sum + Number(p.precio || 0), 0);
  const iva = Math.round(subtotal / 11);
  const total = subtotal;
  const numero = `FAC-${Date.now()}`;
  const tx = db.transaction(() => {
    const factura = db.prepare(`
      INSERT INTO facturas (tenant_id, cliente_id, numero, timbrado, fecha, vencimiento, subtotal, iva, total, estado, condicion_pago)
      VALUES (?, ?, ?, ?, date('now'), date('now', '+30 days'), ?, ?, ?, 'emitida', ?)
    `).run(tenantId, cliente_id, numero, timbrado || '', subtotal, iva, total, condicion_pago || 'contado');
    const insertItem = db.prepare("INSERT INTO factura_items (factura_id, pedido_id, descripcion, cantidad, precio_unitario, total) VALUES (?, ?, ?, 1, ?, ?)");
    for (const pedido of pedidos) {
      insertItem.run(factura.lastInsertRowid, pedido.id, `Servicio logistico ${pedido.numero_guia || pedido.id}`, pedido.precio || 0, pedido.precio || 0);
    }
    return factura.lastInsertRowid;
  });
  const id = tx();
  audit(req, 'factura.generada', 'facturas', String(id), null, { cliente_id, pedido_ids, total });
  res.json({ id, numero, subtotal, iva, total });
});

// --- Dashboard ---
app.get('/api/dashboard', (req, res) => {
  const tenantId = tenantIdFromRequest(req);
  const viajesActivos = db.prepare("SELECT COUNT(*) as count FROM viajes WHERE tenant_id = ? AND estado IN ('planificado', 'cargando', 'en_ruta', 'arribado')").get(tenantId) as any;
  const vehiculosDisponibles = db.prepare("SELECT COUNT(*) as count FROM vehiculos WHERE tenant_id = ? AND estado = 'disponible'").get(tenantId) as any;
  const pedidosPendientes = db.prepare("SELECT COUNT(*) as count FROM pedidos WHERE tenant_id = ? AND estado IN ('borrador', 'registrado', 'pendiente_retiro', 'en_sucursal_origen', 'pendiente_planificacion')").get(tenantId) as any;
  res.json({ viajesActivos: viajesActivos.count, vehiculosDisponibles: vehiculosDisponibles.count, pedidosPendientes: pedidosPendientes.count });
});

// --- Utils ---
app.post('/api/utils/parse-maps-link', (req, res) => {
  const { link } = req.body;
  if (!link) return res.status(400).json({ error: 'Falta el link' });
  // Simulamos extracción
  const latitud = -25.2637;
  const longitud = -57.5759;
  res.json({ latitud, longitud });
});

// --- Caja ---
app.get('/api/caja/movimientos', (req, res) => {
  res.json(db.prepare("SELECT * FROM movimientos_caja WHERE tenant_id = ? ORDER BY fecha DESC").all(tenantIdFromRequest(req)));
});
app.post('/api/caja/movimientos', (req, res) => {
  const { tipo, concepto, monto, fecha, usuario_id, referencia_id, metodo_pago, observaciones } = req.body;
  try {
    const info = db.prepare("INSERT INTO movimientos_caja (tenant_id, tipo, concepto, monto, fecha, usuario_id, referencia_id, metodo_pago, observaciones) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(tenantIdFromRequest(req), tipo, concepto, monto, fecha, usuario_id, referencia_id, metodo_pago, observaciones);
    res.json({ id: info.lastInsertRowid });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/caja/rendiciones', (req, res) => {
  res.json(db.prepare("SELECT * FROM rendiciones_chofer WHERE tenant_id = ? ORDER BY fecha DESC").all(tenantIdFromRequest(req)));
});
app.post('/api/caja/rendiciones', (req, res) => {
  const { chofer_id, viaje_id, fecha, monto_recibido, monto_gastado, monto_cobrado, saldo_entregado, estado } = req.body;
  try {
    const info = db.prepare("INSERT INTO rendiciones_chofer (tenant_id, chofer_id, viaje_id, fecha, monto_recibido, monto_gastado, monto_cobrado, saldo_entregado, estado) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(tenantIdFromRequest(req), chofer_id, viaje_id, fecha, monto_recibido, monto_gastado, monto_cobrado, saldo_entregado, estado || 'borrador');
    res.json({ id: info.lastInsertRowid });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});
app.put('/api/caja/rendiciones/:id', (req, res) => {
  const { estado } = req.body;
  try {
    db.prepare("UPDATE rendiciones_chofer SET estado = ? WHERE id = ? AND tenant_id = ?").run(estado, req.params.id, tenantIdFromRequest(req));
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/caja/gastos', (req, res) => {
  res.json(db.prepare("SELECT * FROM gastos_operativos WHERE tenant_id = ? ORDER BY fecha DESC").all(tenantIdFromRequest(req)));
});
app.post('/api/caja/gastos', (req, res) => {
  const { chofer_id, viaje_id, tipo_gasto, monto, fecha, comprobante_url, estado } = req.body;
  try {
    const info = db.prepare("INSERT INTO gastos_operativos (tenant_id, chofer_id, viaje_id, tipo_gasto, monto, fecha, comprobante_url, estado) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(tenantIdFromRequest(req), chofer_id, viaje_id, tipo_gasto, monto, fecha, comprobante_url, estado || 'pendiente');
    res.json({ id: info.lastInsertRowid });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// --- Clientes Cuenta Corriente y Pagos ---
app.get('/api/clientes/:id/cuenta', (req, res) => {
  const cuenta = db.prepare("SELECT * FROM cuentas_corrientes_clientes WHERE cliente_id = ? AND tenant_id = ?").get(req.params.id, tenantIdFromRequest(req));
  res.json(cuenta || { error: 'Cuenta no encontrada' });
});
app.post('/api/pagos', (req, res) => {
  const { cliente_id, pedido_id, monto, fecha, metodo_pago, referencia_comprobante, usuario_id } = req.body;
  const tenantId = tenantIdFromRequest(req);
  const transaction = db.transaction(() => {
    const info = db.prepare("INSERT INTO pagos_clientes (tenant_id, cliente_id, pedido_id, monto, fecha, metodo_pago, referencia_comprobante, usuario_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(tenantId, cliente_id, pedido_id, monto, fecha, metodo_pago, referencia_comprobante, usuario_id);
    
    db.prepare("UPDATE cuentas_corrientes_clientes SET saldo_deudor = saldo_deudor - ? WHERE cliente_id = ? AND tenant_id = ?").run(monto, cliente_id, tenantId);
    
    return info.lastInsertRowid;
  });
  
  try {
    const id = transaction();
    res.json({ id });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// --- Evidencias ---
app.post('/api/evidencias', (req, res) => {
  const { pedido_id, tipo, foto_url, fecha } = req.body;
  try {
    const tenantId = tenantIdFromRequest(req);
    const pedido = db.prepare("SELECT id FROM pedidos WHERE id = ? AND tenant_id = ?").get(pedido_id, tenantId);
    if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });
    const info = db.prepare("INSERT INTO evidencias_pedido (tenant_id, pedido_id, tipo, foto_url, fecha) VALUES (?, ?, ?, ?, ?)").run(tenantId, pedido_id, tipo, foto_url, fecha);
    res.json({ id: info.lastInsertRowid });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// --- Recursos Humanos ---
app.get('/api/rrhh/resumen', (req, res) => {
  const tenantId = tenantIdFromRequest(req);
  const empleadosActivos = db.prepare("SELECT COUNT(*) as count FROM rrhh_empleados WHERE tenant_id = ? AND estado = 'activo'").get(tenantId) as any;
  const empleadosInactivos = db.prepare("SELECT COUNT(*) as count FROM rrhh_empleados WHERE tenant_id = ? AND estado != 'activo'").get(tenantId) as any;
  const presentesHoy = db.prepare("SELECT COUNT(*) as count FROM rrhh_asistencias WHERE tenant_id = ? AND fecha = date('now', 'localtime') AND estado = 'presente'").get(tenantId) as any;
  const permisosHoy = db.prepare("SELECT COUNT(*) as count FROM rrhh_asistencias WHERE tenant_id = ? AND fecha = date('now', 'localtime') AND estado IN ('permiso', 'ausente')").get(tenantId) as any;
  const nominaPendiente = db.prepare("SELECT COUNT(*) as count, COALESCE(SUM(total_neto), 0) as total FROM rrhh_nomina WHERE tenant_id = ? AND estado = 'pendiente'").get(tenantId) as any;
  const licenciasPendientes = db.prepare("SELECT COUNT(*) as count FROM rrhh_licencias WHERE tenant_id = ? AND estado = 'pendiente'").get(tenantId) as any;
  const masaSalarial = db.prepare("SELECT COALESCE(SUM(salario_base), 0) as total FROM rrhh_empleados WHERE tenant_id = ? AND estado = 'activo'").get(tenantId) as any;
  const contratosPorVencer = db.prepare(`
    SELECT id, nombre, cargo, vencimiento_contrato
    FROM rrhh_empleados
    WHERE tenant_id = ? AND estado = 'activo'
      AND vencimiento_contrato IS NOT NULL
      AND date(vencimiento_contrato) <= date('now', '+45 days')
    ORDER BY vencimiento_contrato ASC
  `).all(tenantId);
  const capacitacionesPorVencer = db.prepare(`
    SELECT c.id, c.tema, c.vencimiento, e.nombre as empleado_nombre
    FROM rrhh_capacitaciones c
    LEFT JOIN rrhh_empleados e ON c.empleado_id = e.id
    WHERE c.tenant_id = ? AND c.vencimiento IS NOT NULL
      AND date(c.vencimiento) <= date('now', '+60 days')
    ORDER BY c.vencimiento ASC
  `).all(tenantId);

  res.json({
    empleadosActivos: empleadosActivos.count,
    empleadosInactivos: empleadosInactivos.count,
    presentesHoy: presentesHoy.count,
    permisosHoy: permisosHoy.count,
    licenciasPendientes: licenciasPendientes.count,
    nominaPendiente: nominaPendiente.count,
    totalNominaPendiente: nominaPendiente.total,
    masaSalarial: masaSalarial.total,
    contratosPorVencer,
    capacitacionesPorVencer
  });
});

app.get('/api/rrhh/empleados', (req, res) => {
  res.json(db.prepare(`
    SELECT e.*, s.nombre as sucursal_nombre
    FROM rrhh_empleados e
    LEFT JOIN sucursales s ON e.sucursal_id = s.id
    WHERE e.tenant_id = ?
    ORDER BY CASE e.estado WHEN 'activo' THEN 0 ELSE 1 END, e.nombre ASC
  `).all(tenantIdFromRequest(req)));
});
app.post('/api/rrhh/empleados', (req, res) => {
  if (!req.body.nombre) return res.status(400).json({ error: 'El nombre es obligatorio' });
  try {
    const info = insertAllowedRecord(rrhhTables.empleados, { ...req.body, tenant_id: tenantIdFromRequest(req) }, rrhhFields.empleados);
    res.json({ id: info.lastInsertRowid });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});
app.put('/api/rrhh/empleados/:id', (req, res) => {
  try {
    updateAllowedRecord(rrhhTables.empleados, req.params.id, req.body, rrhhFields.empleados, tenantIdFromRequest(req));
    res.json({ success: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});
app.delete('/api/rrhh/empleados/:id', (req, res) => {
  db.prepare("UPDATE rrhh_empleados SET estado = 'inactivo' WHERE id = ? AND tenant_id = ?").run(req.params.id, tenantIdFromRequest(req));
  res.json({ success: true });
});

app.get('/api/rrhh/asistencias', (req, res) => {
  res.json(db.prepare(`
    SELECT a.*, e.nombre as empleado_nombre, e.area
    FROM rrhh_asistencias a
    LEFT JOIN rrhh_empleados e ON a.empleado_id = e.id
    WHERE a.tenant_id = ?
    ORDER BY a.fecha DESC, a.entrada DESC
  `).all(tenantIdFromRequest(req)));
});
app.post('/api/rrhh/asistencias', (req, res) => {
  if (!req.body.empleado_id || !req.body.fecha) return res.status(400).json({ error: 'Empleado y fecha son obligatorios' });
  try {
    const info = insertAllowedRecord(rrhhTables.asistencias, { ...req.body, tenant_id: tenantIdFromRequest(req) }, rrhhFields.asistencias);
    res.json({ id: info.lastInsertRowid });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});
app.put('/api/rrhh/asistencias/:id', (req, res) => {
  try {
    updateAllowedRecord(rrhhTables.asistencias, req.params.id, req.body, rrhhFields.asistencias, tenantIdFromRequest(req));
    res.json({ success: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});
app.delete('/api/rrhh/asistencias/:id', (req, res) => {
  db.prepare("DELETE FROM rrhh_asistencias WHERE id = ? AND tenant_id = ?").run(req.params.id, tenantIdFromRequest(req));
  res.json({ success: true });
});

app.get('/api/rrhh/licencias', (req, res) => {
  res.json(db.prepare(`
    SELECT l.*, e.nombre as empleado_nombre, e.area
    FROM rrhh_licencias l
    LEFT JOIN rrhh_empleados e ON l.empleado_id = e.id
    WHERE l.tenant_id = ?
    ORDER BY l.fecha_inicio DESC
  `).all(tenantIdFromRequest(req)));
});
app.post('/api/rrhh/licencias', (req, res) => {
  if (!req.body.empleado_id || !req.body.tipo || !req.body.fecha_inicio || !req.body.fecha_fin) {
    return res.status(400).json({ error: 'Empleado, tipo y fechas son obligatorios' });
  }
  try {
    const info = insertAllowedRecord(rrhhTables.licencias, { ...req.body, tenant_id: tenantIdFromRequest(req) }, rrhhFields.licencias);
    res.json({ id: info.lastInsertRowid });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});
app.put('/api/rrhh/licencias/:id', (req, res) => {
  try {
    updateAllowedRecord(rrhhTables.licencias, req.params.id, req.body, rrhhFields.licencias, tenantIdFromRequest(req));
    res.json({ success: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});
app.delete('/api/rrhh/licencias/:id', (req, res) => {
  db.prepare("DELETE FROM rrhh_licencias WHERE id = ? AND tenant_id = ?").run(req.params.id, tenantIdFromRequest(req));
  res.json({ success: true });
});

app.get('/api/rrhh/nomina', (req, res) => {
  res.json(db.prepare(`
    SELECT n.*, e.nombre as empleado_nombre, e.cargo, e.area
    FROM rrhh_nomina n
    LEFT JOIN rrhh_empleados e ON n.empleado_id = e.id
    WHERE n.tenant_id = ?
    ORDER BY n.periodo DESC, e.nombre ASC
  `).all(tenantIdFromRequest(req)));
});
app.post('/api/rrhh/nomina', (req, res) => {
  if (!req.body.empleado_id || !req.body.periodo) return res.status(400).json({ error: 'Empleado y periodo son obligatorios' });
  try {
    const payload = {
      ...req.body,
      total_neto: Number(req.body.total_neto || 0) || (
        Number(req.body.salario_base || 0) +
        Number(req.body.horas_extra || 0) +
        Number(req.body.bonificaciones || 0) -
        Number(req.body.descuentos || 0)
      )
    };
    const info = insertAllowedRecord(rrhhTables.nomina, { ...payload, tenant_id: tenantIdFromRequest(req) }, rrhhFields.nomina);
    res.json({ id: info.lastInsertRowid });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});
app.put('/api/rrhh/nomina/:id', (req, res) => {
  try {
    updateAllowedRecord(rrhhTables.nomina, req.params.id, req.body, rrhhFields.nomina, tenantIdFromRequest(req));
    res.json({ success: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});
app.delete('/api/rrhh/nomina/:id', (req, res) => {
  db.prepare("DELETE FROM rrhh_nomina WHERE id = ? AND tenant_id = ?").run(req.params.id, tenantIdFromRequest(req));
  res.json({ success: true });
});

app.get('/api/rrhh/capacitaciones', (req, res) => {
  res.json(db.prepare(`
    SELECT c.*, e.nombre as empleado_nombre, e.area
    FROM rrhh_capacitaciones c
    LEFT JOIN rrhh_empleados e ON c.empleado_id = e.id
    WHERE c.tenant_id = ?
    ORDER BY c.fecha DESC
  `).all(tenantIdFromRequest(req)));
});
app.post('/api/rrhh/capacitaciones', (req, res) => {
  if (!req.body.tema) return res.status(400).json({ error: 'El tema es obligatorio' });
  try {
    const info = insertAllowedRecord(rrhhTables.capacitaciones, { ...req.body, tenant_id: tenantIdFromRequest(req) }, rrhhFields.capacitaciones);
    res.json({ id: info.lastInsertRowid });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});
app.put('/api/rrhh/capacitaciones/:id', (req, res) => {
  try {
    updateAllowedRecord(rrhhTables.capacitaciones, req.params.id, req.body, rrhhFields.capacitaciones, tenantIdFromRequest(req));
    res.json({ success: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});
app.delete('/api/rrhh/capacitaciones/:id', (req, res) => {
  db.prepare("DELETE FROM rrhh_capacitaciones WHERE id = ? AND tenant_id = ?").run(req.params.id, tenantIdFromRequest(req));
  res.json({ success: true });
});

// --- Gestion integral ---
app.get('/api/gestion/resumen', (req, res) => {
  const tenantId = tenantIdFromRequest(req);
  const mantenimientosPendientes = db.prepare("SELECT COUNT(*) as count FROM mantenimientos_vehiculo WHERE tenant_id = ? AND estado IN ('programado', 'en_proceso')").get(tenantId) as any;
  const mantenimientosCosto = db.prepare("SELECT COALESCE(SUM(costo_estimado), 0) as total FROM mantenimientos_vehiculo WHERE tenant_id = ? AND estado IN ('programado', 'en_proceso')").get(tenantId) as any;
  const incidenciasAbiertas = db.prepare("SELECT COUNT(*) as count FROM incidencias_operativas WHERE tenant_id = ? AND estado != 'cerrada'").get(tenantId) as any;
  const incidenciasCriticas = db.prepare("SELECT COUNT(*) as count FROM incidencias_operativas WHERE tenant_id = ? AND estado != 'cerrada' AND prioridad IN ('alta', 'critica')").get(tenantId) as any;
  const comprasPendientes = db.prepare("SELECT COUNT(*) as count, COALESCE(SUM(monto), 0) as total FROM compras WHERE tenant_id = ? AND estado = 'pendiente'").get(tenantId) as any;
  const bajoStock = db.prepare("SELECT COUNT(*) as count FROM inventario_deposito WHERE tenant_id = ? AND (estado IN ('bajo_stock', 'retenido') OR cantidad <= 20)").get(tenantId) as any;
  const contratosVigentes = db.prepare("SELECT COUNT(*) as count, COALESCE(SUM(limite_credito), 0) as limite FROM contratos_clientes WHERE tenant_id = ? AND estado = 'activo'").get(tenantId) as any;
  const tarifariosActivos = db.prepare("SELECT COUNT(*) as count FROM tarifarios WHERE tenant_id = ? AND estado = 'activo'").get(tenantId) as any;
  const proximosMantenimientos = db.prepare(`
    SELECT m.id, m.tipo, m.descripcion, m.fecha_programada, m.prioridad, v.chapa
    FROM mantenimientos_vehiculo m
    LEFT JOIN vehiculos v ON m.vehiculo_id = v.id
    WHERE m.tenant_id = ? AND m.estado IN ('programado', 'en_proceso')
    ORDER BY date(m.fecha_programada) ASC
    LIMIT 5
  `).all(tenantId);
  const incidenciasRecientes = db.prepare(`
    SELECT i.id, i.tipo, i.titulo, i.prioridad, i.estado, i.fecha_reporte, c.nombre as cliente_nombre
    FROM incidencias_operativas i
    LEFT JOIN clientes c ON i.cliente_id = c.id
    WHERE i.tenant_id = ?
    ORDER BY date(i.fecha_reporte) DESC, i.id DESC
    LIMIT 5
  `).all(tenantId);

  res.json({
    mantenimientosPendientes: mantenimientosPendientes.count,
    costoMantenimientoPendiente: mantenimientosCosto.total,
    incidenciasAbiertas: incidenciasAbiertas.count,
    incidenciasCriticas: incidenciasCriticas.count,
    comprasPendientes: comprasPendientes.count,
    totalComprasPendientes: comprasPendientes.total,
    bajoStock: bajoStock.count,
    contratosVigentes: contratosVigentes.count,
    limiteCreditoContratado: contratosVigentes.limite,
    tarifariosActivos: tarifariosActivos.count,
    proximosMantenimientos,
    incidenciasRecientes
  });
});

app.get('/api/gestion/proveedores', (req, res) => {
  res.json(db.prepare("SELECT * FROM proveedores WHERE tenant_id = ? ORDER BY CASE estado WHEN 'activo' THEN 0 ELSE 1 END, nombre ASC").all(tenantIdFromRequest(req)));
});
app.post('/api/gestion/proveedores', (req, res) => {
  if (!req.body.nombre) return res.status(400).json({ error: 'El nombre es obligatorio' });
  try {
    const info = insertAllowedRecord(gestionTables.proveedores, { ...req.body, tenant_id: tenantIdFromRequest(req) }, gestionFields.proveedores);
    res.json({ id: info.lastInsertRowid });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});
app.put('/api/gestion/proveedores/:id', (req, res) => {
  try {
    updateAllowedRecord(gestionTables.proveedores, req.params.id, req.body, gestionFields.proveedores, tenantIdFromRequest(req));
    res.json({ success: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});
app.delete('/api/gestion/proveedores/:id', (req, res) => {
  db.prepare("UPDATE proveedores SET estado = 'inactivo' WHERE id = ? AND tenant_id = ?").run(req.params.id, tenantIdFromRequest(req));
  res.json({ success: true });
});

app.get('/api/gestion/compras', (req, res) => {
  res.json(db.prepare(`
    SELECT c.*, p.nombre as proveedor_nombre
    FROM compras c
    LEFT JOIN proveedores p ON c.proveedor_id = p.id
    WHERE c.tenant_id = ?
    ORDER BY c.fecha DESC, c.id DESC
  `).all(tenantIdFromRequest(req)));
});
app.post('/api/gestion/compras', (req, res) => {
  if (!req.body.fecha || !req.body.concepto) return res.status(400).json({ error: 'Fecha y concepto son obligatorios' });
  try {
    const info = insertAllowedRecord(gestionTables.compras, { ...req.body, tenant_id: tenantIdFromRequest(req) }, gestionFields.compras);
    res.json({ id: info.lastInsertRowid });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});
app.put('/api/gestion/compras/:id', (req, res) => {
  try {
    updateAllowedRecord(gestionTables.compras, req.params.id, req.body, gestionFields.compras, tenantIdFromRequest(req));
    res.json({ success: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});
app.delete('/api/gestion/compras/:id', (req, res) => {
  db.prepare("DELETE FROM compras WHERE id = ? AND tenant_id = ?").run(req.params.id, tenantIdFromRequest(req));
  res.json({ success: true });
});

app.get('/api/gestion/mantenimientos', (req, res) => {
  res.json(db.prepare(`
    SELECT m.*, v.chapa as vehiculo_chapa, v.marca as vehiculo_marca, p.nombre as proveedor_nombre
    FROM mantenimientos_vehiculo m
    LEFT JOIN vehiculos v ON m.vehiculo_id = v.id
    LEFT JOIN proveedores p ON m.proveedor_id = p.id
    WHERE m.tenant_id = ?
    ORDER BY date(m.fecha_programada) ASC, m.id DESC
  `).all(tenantIdFromRequest(req)));
});
app.post('/api/gestion/mantenimientos', (req, res) => {
  if (!req.body.vehiculo_id || !req.body.tipo) return res.status(400).json({ error: 'Vehiculo y tipo son obligatorios' });
  try {
    const info = insertAllowedRecord(gestionTables.mantenimientos, { ...req.body, tenant_id: tenantIdFromRequest(req) }, gestionFields.mantenimientos);
    res.json({ id: info.lastInsertRowid });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});
app.put('/api/gestion/mantenimientos/:id', (req, res) => {
  try {
    updateAllowedRecord(gestionTables.mantenimientos, req.params.id, req.body, gestionFields.mantenimientos, tenantIdFromRequest(req));
    res.json({ success: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});
app.delete('/api/gestion/mantenimientos/:id', (req, res) => {
  db.prepare("DELETE FROM mantenimientos_vehiculo WHERE id = ? AND tenant_id = ?").run(req.params.id, tenantIdFromRequest(req));
  res.json({ success: true });
});

app.get('/api/gestion/incidencias', (req, res) => {
  res.json(db.prepare(`
    SELECT i.*, c.nombre as cliente_nombre, p.numero_guia, v.id as viaje_numero
    FROM incidencias_operativas i
    LEFT JOIN clientes c ON i.cliente_id = c.id
    LEFT JOIN pedidos p ON i.pedido_id = p.id
    LEFT JOIN viajes v ON i.viaje_id = v.id
    WHERE i.tenant_id = ?
    ORDER BY CASE i.estado WHEN 'abierta' THEN 0 WHEN 'en_proceso' THEN 1 ELSE 2 END,
             CASE i.prioridad WHEN 'critica' THEN 0 WHEN 'alta' THEN 1 WHEN 'media' THEN 2 ELSE 3 END,
             i.fecha_reporte DESC
  `).all(tenantIdFromRequest(req)));
});
app.post('/api/gestion/incidencias', (req, res) => {
  if (!req.body.tipo || !req.body.titulo || !req.body.fecha_reporte) return res.status(400).json({ error: 'Tipo, titulo y fecha son obligatorios' });
  try {
    const info = insertAllowedRecord(gestionTables.incidencias, { ...req.body, tenant_id: tenantIdFromRequest(req) }, gestionFields.incidencias);
    res.json({ id: info.lastInsertRowid });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});
app.put('/api/gestion/incidencias/:id', (req, res) => {
  try {
    updateAllowedRecord(gestionTables.incidencias, req.params.id, req.body, gestionFields.incidencias, tenantIdFromRequest(req));
    res.json({ success: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});
app.delete('/api/gestion/incidencias/:id', (req, res) => {
  db.prepare("DELETE FROM incidencias_operativas WHERE id = ? AND tenant_id = ?").run(req.params.id, tenantIdFromRequest(req));
  res.json({ success: true });
});

app.get('/api/gestion/inventario', (req, res) => {
  res.json(db.prepare(`
    SELECT i.*, s.nombre as sucursal_nombre
    FROM inventario_deposito i
    LEFT JOIN sucursales s ON i.sucursal_id = s.id
    WHERE i.tenant_id = ?
    ORDER BY i.estado DESC, i.descripcion ASC
  `).all(tenantIdFromRequest(req)));
});
app.post('/api/gestion/inventario', (req, res) => {
  if (!req.body.descripcion) return res.status(400).json({ error: 'La descripcion es obligatoria' });
  try {
    const info = insertAllowedRecord(gestionTables.inventario, { ...req.body, tenant_id: tenantIdFromRequest(req) }, gestionFields.inventario);
    res.json({ id: info.lastInsertRowid });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});
app.put('/api/gestion/inventario/:id', (req, res) => {
  try {
    updateAllowedRecord(gestionTables.inventario, req.params.id, req.body, gestionFields.inventario, tenantIdFromRequest(req));
    res.json({ success: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});
app.delete('/api/gestion/inventario/:id', (req, res) => {
  db.prepare("DELETE FROM inventario_deposito WHERE id = ? AND tenant_id = ?").run(req.params.id, tenantIdFromRequest(req));
  res.json({ success: true });
});

app.get('/api/gestion/tarifarios', (req, res) => {
  res.json(db.prepare(`
    SELECT t.*, so.nombre as origen_nombre, sd.nombre as destino_nombre
    FROM tarifarios t
    LEFT JOIN sucursales so ON t.origen_sucursal_id = so.id
    LEFT JOIN sucursales sd ON t.destino_sucursal_id = sd.id
    WHERE t.tenant_id = ?
    ORDER BY CASE t.estado WHEN 'activo' THEN 0 ELSE 1 END, t.nombre ASC
  `).all(tenantIdFromRequest(req)));
});
app.post('/api/gestion/tarifarios', (req, res) => {
  if (!req.body.nombre) return res.status(400).json({ error: 'El nombre es obligatorio' });
  try {
    const info = insertAllowedRecord(gestionTables.tarifarios, { ...req.body, tenant_id: tenantIdFromRequest(req) }, gestionFields.tarifarios);
    res.json({ id: info.lastInsertRowid });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});
app.put('/api/gestion/tarifarios/:id', (req, res) => {
  try {
    updateAllowedRecord(gestionTables.tarifarios, req.params.id, req.body, gestionFields.tarifarios, tenantIdFromRequest(req));
    res.json({ success: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});
app.delete('/api/gestion/tarifarios/:id', (req, res) => {
  db.prepare("UPDATE tarifarios SET estado = 'inactivo' WHERE id = ? AND tenant_id = ?").run(req.params.id, tenantIdFromRequest(req));
  res.json({ success: true });
});

app.get('/api/gestion/contratos', (req, res) => {
  res.json(db.prepare(`
    SELECT cc.*, c.nombre as cliente_nombre, t.nombre as tarifario_nombre
    FROM contratos_clientes cc
    LEFT JOIN clientes c ON cc.cliente_id = c.id
    LEFT JOIN tarifarios t ON cc.tarifario_id = t.id
    WHERE cc.tenant_id = ?
    ORDER BY CASE cc.estado WHEN 'activo' THEN 0 ELSE 1 END, cc.fecha_fin ASC
  `).all(tenantIdFromRequest(req)));
});
app.post('/api/gestion/contratos', (req, res) => {
  if (!req.body.cliente_id || !req.body.nombre) return res.status(400).json({ error: 'Cliente y nombre son obligatorios' });
  try {
    const info = insertAllowedRecord(gestionTables.contratos, { ...req.body, tenant_id: tenantIdFromRequest(req) }, gestionFields.contratos);
    res.json({ id: info.lastInsertRowid });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});
app.put('/api/gestion/contratos/:id', (req, res) => {
  try {
    updateAllowedRecord(gestionTables.contratos, req.params.id, req.body, gestionFields.contratos, tenantIdFromRequest(req));
    res.json({ success: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});
app.delete('/api/gestion/contratos/:id', (req, res) => {
  db.prepare("UPDATE contratos_clientes SET estado = 'inactivo' WHERE id = ? AND tenant_id = ?").run(req.params.id, tenantIdFromRequest(req));
  res.json({ success: true });
});

// --- Reportes ---
app.get('/api/reportes/rentabilidad', (req, res) => {
  res.json({
    total_ingresos: 15000000,
    total_egresos: 4500000,
    rentabilidad: 10500000,
    viajes: 12
  });
});

const adminDist = path.resolve(__dirname, '../public');
const choferDist = path.resolve(__dirname, '../chofer');
const landingDist = path.resolve(__dirname, '../landing');

if (fs.existsSync(choferDist)) {
  app.use('/chofer', express.static(choferDist));
  app.get('/chofer/*', (_req, res) => res.sendFile(path.join(choferDist, 'index.html')));
}

if (fs.existsSync(landingDist)) {
  app.use('/landing', express.static(landingDist));
  app.get('/landing/*', (_req, res) => res.sendFile(path.join(landingDist, 'index.html')));
}

if (fs.existsSync(adminDist)) {
  app.use(express.static(adminDist));
  app.get('*', (_req, res) => res.sendFile(path.join(adminDist, 'index.html')));
}

const port = Number(process.env.PORT || 3001);
app.listen(port, () => {
  console.log(`Backend listening on port ${port}`);
});
