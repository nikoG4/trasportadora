import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import fs from 'fs';
import path from 'path';
import http from 'http';
import { WebSocket, WebSocketServer } from 'ws';
import admin from 'firebase-admin';
import { Storage } from '@google-cloud/storage';
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
app.set('trust proxy', 1);
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false
}));
app.use(cors({
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : true,
  credentials: true
}));
app.use(express.json({ limit: '30mb' }));
app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

initDb();

const uploadsRoot = path.resolve(process.cwd(), 'uploads');
const headerLogoRoot = path.join(uploadsRoot, 'header-logos');
const downloadsRoot = path.resolve(process.cwd(), 'downloads');
fs.mkdirSync(headerLogoRoot, { recursive: true });
fs.mkdirSync(downloadsRoot, { recursive: true });
app.use('/uploads', express.static(uploadsRoot));
app.use('/downloads', express.static(downloadsRoot));

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
    const userId = Number(payload.id);
    if (!Number.isFinite(userId) || userId <= 0) {
      return res.status(401).json({ error: 'Token invalido o expirado' });
    }

    const user = db.prepare("SELECT id, tenant_id, role FROM users WHERE id = ? AND COALESCE(estado, 'activo') = 'activo'").get(userId) as any;
    if (!user) {
      return res.status(401).json({ error: 'Token invalido o usuario no encontrado' });
    }

    req.user = {
      id: user.id,
      tenant_id: Number(payload.tenant_id || user.tenant_id || 1),
      role: String(user.role || payload.role),
      permisos: Array.isArray(payload.permisos) ? payload.permisos : getRolePermissions(String(user.role || payload.role))
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

function requireSuperadmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!req.user) return res.status(401).json({ error: 'Token requerido' });
  if (req.user.role === 'superadmin_saas') return next();
  return res.status(403).json({ error: 'Solo el superadmin del sistema puede administrar releases de app' });
}

function resolveTenant(req: express.Request, _res: express.Response, next: express.NextFunction) {
  const headerTenant = Number(req.headers['x-tenant-id']);
  req.tenantId = req.user?.tenant_id || (Number.isFinite(headerTenant) && headerTenant > 0 ? headerTenant : 1);
  next();
}

function tenantIdFromRequest(req: express.Request) {
  if (req.tenantId) return req.tenantId;
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

function userFromToken(token: string) {
  const payload = jwt.verify(token, SECRET) as any;
  return {
    id: Number(payload.id),
    tenant_id: Number(payload.tenant_id || 1),
    role: String(payload.role),
    permisos: Array.isArray(payload.permisos) ? payload.permisos : getRolePermissions(String(payload.role))
  };
}

function attachOptionalAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) return next();

  try {
    req.user = userFromToken(token);
    req.tenantId = req.user.tenant_id;
    next();
  } catch {
    if (isPublicApiPath(req.path)) {
      const decoded = jwt.decode(token) as any;
      const tenantId = Number(decoded?.tenant_id || 0);
      if (Number.isFinite(tenantId) && tenantId > 0) req.tenantId = tenantId;
      return next();
    }
    res.status(401).json({ error: 'Token invalido o expirado' });
  }
}

function isPublicApiPath(pathname: string) {
  return pathname === '/login'
    || pathname === '/chofer/login'
    || pathname === '/auth/refresh'
    || pathname.startsWith('/public/')
    || pathname === '/app-updates/chofer/latest'
    || pathname === '/app-updates/chofer/native/latest'
    || pathname === '/app-updates/chofer/native/download'
    || /^\/app-updates\/chofer\/releases\/[^/]+\/download$/.test(pathname)
    || pathname === '/app-updates/chofer/devices'
    || pathname === '/app-updates/chofer/events';
}

function requireTenantAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (req.method === 'OPTIONS' || isPublicApiPath(req.path)) return next();
  if (req.user) return next();
  return res.status(401).json({ error: 'Token requerido' });
}

app.use('/api', attachOptionalAuth, requireTenantAuth);

type DriverEventPayload = {
  type: string;
  title: string;
  body: string;
  viaje_id?: number | string | null;
  tipo_viaje?: string | null;
  reparto?: boolean;
  timestamp?: string;
  [key: string]: any;
};

const driverEventClients = new Map<string, Set<express.Response>>();
type RealtimeClient = {
  ws: WebSocket;
  tenantId: number;
  userId: number;
  role: string;
  clientType: 'driver' | 'backoffice';
  choferId?: number | null;
  alive: boolean;
};

const driverWsClients = new Map<string, Set<RealtimeClient>>();
const monitorWsClients = new Map<number, Set<RealtimeClient>>();

function driverEventKey(tenantId: number, choferId: any) {
  return `${tenantId}:${choferId}`;
}

function writeSse(res: express.Response, event: string, payload: any) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function wsSend(client: RealtimeClient, event: string, payload: any) {
  if (client.ws.readyState !== WebSocket.OPEN) return;
  client.ws.send(JSON.stringify({ event, type: event, payload, timestamp: new Date().toISOString() }));
}

function wsBroadcast(clients: Set<RealtimeClient> | undefined, event: string, payload: any) {
  clients?.forEach(client => wsSend(client, event, payload));
}

function normalizeDriverEventType(payload: DriverEventPayload) {
  const type = String(payload.type || '').toUpperCase();
  if (type.includes('REPARTO') && (type.includes('ASIGNADO') || type.includes('CREADO'))) return 'driver.reparto.assigned';
  if (type.includes('REPARTO') && (type.includes('ACTUALIZADO') || type.includes('RUTA') || type.includes('PARADA'))) return 'driver.route.changed';
  if (type.includes('REPARTO')) return 'driver.reparto.updated';
  if (type.includes('INTERURBANO') && type.includes('ASIGNADO')) return 'driver.viaje.assigned';
  if (type.includes('VIAJE') && type.includes('ASIGNADO')) return 'driver.viaje.assigned';
  if (type.includes('VIAJE') || type.includes('INTERURBANO')) return 'driver.viaje.updated';
  return 'driver.notification';
}

function monitorEventForDriverEvent(payload: DriverEventPayload) {
  const event = normalizeDriverEventType(payload);
  if (event === 'driver.reparto.assigned') return 'monitor.reparto.assigned';
  if (event === 'driver.viaje.assigned') return 'monitor.viaje.assigned';
  if (event.startsWith('driver.reparto') || event === 'driver.route.changed') return 'monitor.reparto.progress.updated';
  if (event.startsWith('driver.viaje')) return 'monitor.viaje.progress.updated';
  return 'monitor.notification';
}

function emitMonitorEvent(tenantId: number, event: string, payload: any) {
  wsBroadcast(monitorWsClients.get(Number(tenantId)), event, { ...payload, tenant_id: tenantId });
}

function getFirebaseApp() {
  if (admin.apps.length) return admin.app();
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const file = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
  try {
    if (json) {
      const credentials = JSON.parse(json);
      return admin.initializeApp({ credential: admin.credential.cert(credentials), projectId: credentials.project_id || projectId });
    }
    if (file && fs.existsSync(file)) {
      const credentials = JSON.parse(fs.readFileSync(file, 'utf8'));
      return admin.initializeApp({ credential: admin.credential.cert(credentials), projectId: credentials.project_id || projectId });
    }
    return admin.initializeApp({ credential: admin.credential.applicationDefault(), projectId });
  } catch (err) {
    console.warn('No se pudo inicializar Firebase Admin', err);
  }
  return null;
}

async function sendDriverPush(tenantId: number, choferId: any, payload: DriverEventPayload) {
  const appInstance = getFirebaseApp();
  if (!appInstance) return;
  const tokens = db.prepare(`
    SELECT token
    FROM chofer_device_tokens
    WHERE tenant_id = ? AND chofer_id = ? AND activo = 1
    ORDER BY datetime(ultimo_registro) DESC
  `).all(tenantId, choferId) as any[];
  if (!tokens.length) return;
  const tokenValues = tokens.map(row => String(row.token)).filter(Boolean);
  const data = Object.fromEntries(Object.entries(payload).map(([key, value]) => [key, value == null ? '' : String(value)]));
  const response = await admin.messaging(appInstance).sendEachForMulticast({
    tokens: tokenValues,
    notification: { title: payload.title, body: payload.body },
    data,
    android: {
      priority: 'high',
      notification: {
        channelId: 'chofer_assignments',
        sound: 'default'
      }
    }
  }).catch(err => {
    console.warn('No se pudo enviar FCM', err);
    return null;
  });
  response?.responses.forEach((item, index) => {
    const code = (item.error as any)?.code || '';
    if (!item.success && ['messaging/registration-token-not-registered', 'messaging/invalid-registration-token'].includes(code)) {
      db.prepare("UPDATE chofer_device_tokens SET activo = 0 WHERE tenant_id = ? AND token = ?").run(tenantId, tokenValues[index]);
    }
  });
}

function emitDriverEvent(tenantId: number, choferId: any, payload: DriverEventPayload) {
  if (!choferId) return;
  const message = { ...payload, timestamp: payload.timestamp || new Date().toISOString() };
  const clients = driverEventClients.get(driverEventKey(tenantId, choferId));
  clients?.forEach(res => writeSse(res, 'driver-event', message));
  const canonicalEvent = normalizeDriverEventType(message);
  wsBroadcast(driverWsClients.get(driverEventKey(tenantId, choferId)), canonicalEvent, message);
  emitMonitorEvent(tenantId, monitorEventForDriverEvent(message), { ...message, chofer_id: choferId });
  sendDriverPush(tenantId, choferId, message).catch(err => console.warn('Push chofer fallido', err));
}

function audit(req: express.Request, accion: string, entidad: string, entidadId: string | number | null, antes: any, despues: any) {
  try {
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
  } catch (err) {
    console.warn('No se pudo registrar auditoria', err);
  }
}

function optionalUser(req: express.Request) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) return null;
  try {
    return userFromToken(token);
  } catch {
    return null;
  }
}

function normalizeUpdateChannel(value: any) {
  const channel = String(value || 'stable').trim().toLowerCase();
  return ['stable', 'beta', 'emergency'].includes(channel) ? channel : 'stable';
}

function normalizeUpdatePlatform(value: any) {
  const platform = String(value || 'android').trim().toLowerCase();
  return ['android', 'ios', 'web'].includes(platform) ? platform : 'android';
}

function normalizeUpdateStatus(value: any) {
  return String(value || 'DRAFT').trim().toUpperCase();
}

function semverParts(value: any) {
  return String(value || '0')
    .split(/[.+\-_]/)
    .map(part => Number(part.replace(/\D/g, '') || 0));
}

function compareVersions(a: any, b: any) {
  const left = semverParts(a);
  const right = semverParts(b);
  const length = Math.max(left.length, right.length);
  for (let i = 0; i < length; i++) {
    const diff = (left[i] || 0) - (right[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function isNativeVersionCompatible(release: any, nativeVersion: any) {
  if (!nativeVersion) return true;
  if (release.min_native_version && compareVersions(nativeVersion, release.min_native_version) < 0) return false;
  if (release.max_native_version && compareVersions(nativeVersion, release.max_native_version) > 0) return false;
  return true;
}

function rolloutBucket(seed: string) {
  const hash = crypto.createHash('sha256').update(seed || 'anonymous-device').digest();
  return hash.readUInt32BE(0) % 100;
}

function updateSignaturePayload(input: {
  app: string;
  platform: string;
  channel: string;
  version_web: string;
  min_native_version?: string | null;
  max_native_version?: string | null;
  sha256: string;
}) {
  return JSON.stringify({
    app: input.app,
    platform: input.platform,
    channel: input.channel,
    version_web: input.version_web,
    min_native_version: input.min_native_version || '',
    max_native_version: input.max_native_version || '',
    sha256: input.sha256
  });
}

function signingPrivateKey() {
  const raw = process.env.APP_UPDATE_SIGNING_PRIVATE_KEY_PEM
    || (process.env.APP_UPDATE_SIGNING_PRIVATE_KEY_PATH && fs.existsSync(process.env.APP_UPDATE_SIGNING_PRIVATE_KEY_PATH)
      ? fs.readFileSync(process.env.APP_UPDATE_SIGNING_PRIVATE_KEY_PATH, 'utf8')
      : '');
  return raw ? raw.replace(/\\n/g, '\n') : '';
}

function signUpdatePayload(payload: string) {
  const privateKey = signingPrivateKey();
  if (!privateKey) return { signature: '', algorithm: 'UNSIGNED_SHA256' };
  const signature = crypto.sign('sha256', Buffer.from(payload), {
    key: privateKey,
    dsaEncoding: 'ieee-p1363'
  } as any);
  return { signature: signature.toString('base64'), algorithm: 'ECDSA_P256_SHA256' };
}

function sanitizeUpdateVersion(value: any) {
  const version = String(value || '').trim();
  if (!version || !/^[a-zA-Z0-9._-]{1,80}$/.test(version)) {
    throw new Error('version_web debe ser alfanumerica y puede incluir punto, guion o guion bajo');
  }
  return version;
}

function releaseDownloadUrl(req: express.Request, release: any) {
  if (release.url_zip && !String(release.url_zip).includes('/api/app-updates/')) return release.url_zip;
  const base = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`;
  return `${base}/api/app-updates/chofer/releases/${release.id}/download?token=${encodeURIComponent(release.download_token || '')}`;
}

function updateReleaseResponse(req: express.Request, row: any) {
  if (!row) return null;
  return {
    ...row,
    rollout_percent: Number(row.rollout_percent || 0),
    obligatorio: Number(row.obligatorio || 0),
    size_bytes: Number(row.size_bytes || 0),
    url_zip: row.url_zip || releaseDownloadUrl(req, row),
    signature_algorithm: row.signature_algorithm || 'UNSIGNED_SHA256'
  };
}

function getConfigValue(tenantId: number, key: string, fallback = '') {
  const row = db.prepare("SELECT valor FROM configuracion WHERE tenant_id = ? AND clave = ?").get(tenantId, key) as any;
  return row?.valor == null ? fallback : String(row.valor);
}

function setConfigValue(tenantId: number, key: string, value: any) {
  db.prepare(`
    INSERT INTO configuracion (tenant_id, clave, valor) VALUES (?, ?, ?)
    ON CONFLICT(tenant_id, clave) DO UPDATE SET valor = excluded.valor
  `).run(tenantId, key, value == null ? '' : String(value));
}

function nativeApkDownloadUrl(req: express.Request, token: string, tenantId = tenantIdFromRequest(req)) {
  const base = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`;
  return `${base}/api/app-updates/chofer/native/download?tenant_id=${encodeURIComponent(String(tenantId))}&token=${encodeURIComponent(token)}`;
}

async function saveNativeApk(version: string, apkBuffer: Buffer) {
  const bucketName = process.env.APP_UPDATE_STORAGE_BUCKET;
  if (bucketName) {
    const objectName = `app-updates/chofer/native/${version}/app.apk`;
    await getGcsStorage().bucket(bucketName).file(objectName).save(apkBuffer, {
      resumable: false,
      metadata: {
        contentType: 'application/vnd.android.package-archive',
        cacheControl: 'private, max-age=31536000, immutable'
      }
    });
    return { provider: 'gcs', ref: `gs://${bucketName}/${objectName}` };
  }

  const dir = path.join(updateBundlesRoot, 'chofer', 'native', version);
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, 'app.apk');
  fs.writeFileSync(filePath, apkBuffer);
  return { provider: 'local', ref: filePath };
}

const updateBundlesRoot = path.join(downloadsRoot, 'app-updates');
fs.mkdirSync(updateBundlesRoot, { recursive: true });
let gcsStorage: Storage | null = null;

function getGcsStorage() {
  if (!gcsStorage) gcsStorage = new Storage();
  return gcsStorage;
}

async function saveReleaseBundle(releaseId: number, version: string, zipBuffer: Buffer) {
  const bucketName = process.env.APP_UPDATE_STORAGE_BUCKET;
  if (bucketName) {
    const objectName = `app-updates/chofer/${releaseId}/${version}.zip`;
    await getGcsStorage().bucket(bucketName).file(objectName).save(zipBuffer, {
      resumable: false,
      metadata: {
        contentType: 'application/zip',
        cacheControl: 'private, max-age=31536000, immutable'
      }
    });
    return { provider: 'gcs', ref: `gs://${bucketName}/${objectName}` };
  }

  const dir = path.join(updateBundlesRoot, 'chofer', String(releaseId));
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `${version}.zip`);
  fs.writeFileSync(filePath, zipBuffer);
  return { provider: 'local', ref: filePath };
}

function parseGsRef(ref: string) {
  const clean = String(ref || '').replace(/^gs:\/\//, '');
  const slash = clean.indexOf('/');
  if (slash <= 0) return null;
  return { bucket: clean.slice(0, slash), object: clean.slice(slash + 1) };
}

async function sendAppUpdatePush(tenantId: number, release: any) {
  const appInstance = getFirebaseApp();
  if (!appInstance) return;
  const tokens = db.prepare(`
    SELECT token
    FROM chofer_device_tokens
    WHERE tenant_id = ? AND activo = 1
    ORDER BY datetime(ultimo_registro) DESC
  `).all(tenantId) as any[];
  const tokenValues = tokens.map(row => String(row.token || '')).filter(Boolean);
  for (let i = 0; i < tokenValues.length; i += 500) {
    const batch = tokenValues.slice(i, i + 500);
    const response = await admin.messaging(appInstance).sendEachForMulticast({
      tokens: batch,
      notification: {
        title: 'Actualizacion de app disponible',
        body: `Version ${release.version_web} lista para descargar`
      },
      data: {
        type: 'APP_UPDATE_AVAILABLE',
        app: 'chofer',
        platform: String(release.platform || 'android'),
        channel: String(release.channel || 'stable'),
        version_web: String(release.version_web || ''),
        release_id: String(release.id || '')
      },
      android: {
        priority: 'normal',
        notification: { channelId: 'chofer_assignments', sound: 'default' }
      }
    }).catch(err => {
      console.warn('No se pudo enviar push OTA', err);
      return null;
    });
    response?.responses.forEach((item, index) => {
      const code = (item.error as any)?.code || '';
      if (!item.success && ['messaging/registration-token-not-registered', 'messaging/invalid-registration-token'].includes(code)) {
        db.prepare("UPDATE chofer_device_tokens SET activo = 0 WHERE tenant_id = ? AND token = ?").run(tenantId, batch[index]);
      }
    });
  }
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

type HeaderBlock = {
  id?: string;
  type?: string;
  visible?: boolean;
  order?: number;
  alignment?: string;
  text?: string;
  imageUrl?: string;
  imagePath?: string;
  base64?: string;
  fontSize?: number;
  bold?: boolean;
  widthPercent?: number;
  marginTop?: number;
  marginBottom?: number;
  height?: number;
};

const allowedHeaderTypes = new Set(['LOGO', 'TEXT', 'SEPARATOR', 'SPACER']);
const allowedAlignments = new Set(['LEFT', 'CENTER', 'RIGHT']);

function htmlToPlainHeader(html: string) {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6])>/gi, '\n')
    .replace(/<li>/gi, '- ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function legacyHeaderBlocks(tenantId: number) {
  const oldHeader = db.prepare("SELECT valor FROM configuracion WHERE tenant_id = ? AND clave = 'membrete'").get(tenantId) as any;
  const lines = htmlToPlainHeader(oldHeader?.valor || '').split('\n').map((line) => line.trim()).filter(Boolean);
  const sourceLines = lines.length ? lines : ['TRANSPORTADORA PARAGUAY SAAS', 'RUC: 80012345-6', 'Tel: 0981 000 000'];
  return sourceLines.map((line, index) => ({
    id: `legacy-text-${index + 1}`,
    type: 'TEXT',
    visible: true,
    order: index + 1,
    alignment: 'CENTER',
    text: line,
    fontSize: index === 0 ? 18 : 14,
    bold: index === 0,
    marginTop: index === 0 ? 2 : 0,
    marginBottom: 2
  }));
}

function sanitizeHeaderBlock(block: HeaderBlock, index: number) {
  const type = allowedHeaderTypes.has(String(block.type || '').toUpperCase()) ? String(block.type).toUpperCase() : 'TEXT';
  const alignment = allowedAlignments.has(String(block.alignment || '').toUpperCase()) ? String(block.alignment).toUpperCase() : 'CENTER';
  const safeNumber = (value: any, fallback: number, min: number, max: number) => Math.max(min, Math.min(max, Number(value ?? fallback) || fallback));
  return {
    id: String(block.id || crypto.randomUUID()),
    type,
    visible: block.visible !== false,
    order: Number.isFinite(Number(block.order)) ? Number(block.order) : index + 1,
    alignment,
    text: String(block.text || '').slice(0, 500),
    imageUrl: String(block.imageUrl || '').slice(0, 500000),
    imagePath: String(block.imagePath || '').slice(0, 500),
    base64: String(block.base64 || '').slice(0, 500000),
    fontSize: safeNumber(block.fontSize, 14, 8, 36),
    bold: Boolean(block.bold),
    widthPercent: safeNumber(block.widthPercent, 60, 10, 100),
    marginTop: safeNumber(block.marginTop, 0, 0, 40),
    marginBottom: safeNumber(block.marginBottom, 2, 0, 40),
    height: safeNumber(block.height, 12, 1, 120)
  };
}

function templateFromRow(row: any, tenantId: number) {
  let blocks: any[] = [];
  try {
    blocks = JSON.parse(String(row?.blocks_json || '[]'));
  } catch {
    blocks = [];
  }
  if (!Array.isArray(blocks) || blocks.length === 0) blocks = legacyHeaderBlocks(tenantId);
  return {
    id: row?.id || null,
    companyId: tenantId,
    name: row?.name || 'Membrete principal',
    paperWidthDefault: Number(row?.paper_width_default || 58) === 80 ? 80 : 58,
    blocks: blocks.map(sanitizeHeaderBlock).sort((a, b) => a.order - b.order),
    version: Number(row?.version || 1),
    updatedAt: row?.updated_at || new Date().toISOString()
  };
}

function getHeaderTemplate(tenantId: number) {
  const row = db.prepare("SELECT * FROM header_templates WHERE tenant_id = ? ORDER BY updated_at DESC, id DESC LIMIT 1").get(tenantId) as any;
  if (row) return templateFromRow(row, tenantId);
  const blocks = legacyHeaderBlocks(tenantId);
  const info = db.prepare(`
    INSERT INTO header_templates (tenant_id, name, paper_width_default, blocks_json, version, updated_at)
    VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
  `).run(tenantId, 'Membrete principal', 58, JSON.stringify(blocks));
  return templateFromRow({
    id: info.lastInsertRowid,
    tenant_id: tenantId,
    name: 'Membrete principal',
    paper_width_default: 58,
    blocks_json: JSON.stringify(blocks),
    version: 1,
    updated_at: new Date().toISOString()
  }, tenantId);
}

function requestedLoginTenant(req: express.Request) {
  const raw = req.body?.tenant_id ?? req.headers['x-tenant-id'];
  const tenantId = Number(raw);
  return Number.isFinite(tenantId) && tenantId > 0 ? tenantId : null;
}

function findLoginUser(username: string, tenantId: number | null) {
  const baseSql = `
    SELECT u.*, t.nombre as tenant_nombre
    FROM users u
    LEFT JOIN tenants t ON t.id = u.tenant_id
    WHERE u.username = ?
      AND COALESCE(u.estado, 'activo') = 'activo'
  `;
  if (tenantId) {
    return db.prepare(`${baseSql} AND u.tenant_id = ?`).get(username, tenantId) as any;
  }
  return db.prepare(baseSql).get(username) as any;
}

app.post('/api/login', loginLimiter, resolveTenant, (req, res) => {
  const { username, password } = req.body;
  const tenantId = requestedLoginTenant(req);
  const user = findLoginUser(username, tenantId);
  const validPassword = user?.password_hash
    ? bcrypt.compareSync(password, user.password_hash)
    : user?.password === password;

  if (user && validPassword) {
    const token = signAccessToken(user);
    const refreshToken = createRefreshToken(user);
    req.user = userFromToken(token);
    req.tenantId = req.user.tenant_id;
    audit(req, 'login.exitoso', 'users', user.id, null, { username: user.username, tenant_id: user.tenant_id });
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
  const tenantId = requestedLoginTenant(req);
  const baseSql = `
    SELECT u.*, c.id as chofer_id_resuelto, c.nombre as chofer_nombre, c.estado as chofer_estado
    FROM users u
    LEFT JOIN choferes c ON c.id = u.chofer_id AND c.tenant_id = u.tenant_id
    WHERE u.username = ? AND COALESCE(u.estado, 'activo') = 'activo'
  `;
  const user = tenantId
    ? db.prepare(`${baseSql} AND u.tenant_id = ?`).get(username, tenantId) as any
    : db.prepare(baseSql).get(username) as any;
  const validPassword = user?.password_hash
    ? bcrypt.compareSync(password, user.password_hash)
    : user?.password === password;

  if (!user || !validPassword) {
    return res.status(401).json({ error: 'Credenciales invalidas' });
  }

  const isChofer = user.role === 'chofer';
  
  if (isChofer) {
    const choferId = user.chofer_id_resuelto || user.chofer_id;
    if (!choferId || user.chofer_estado === 'inactivo') {
      return res.status(403).json({ error: 'Usuario de chofer sin perfil activo asignado' });
    }
    
    const token = signAccessToken(user);
    const refreshToken = createRefreshToken(user);
    req.user = userFromToken(token);
    req.tenantId = req.user.tenant_id;
    audit(req, 'login_chofer.exitoso', 'users', user.id, null, { username: user.username, chofer_id: choferId, tenant_id: user.tenant_id });
    res.json({
      token,
      refreshToken,
      role: user.role,
      chofer: { id: choferId, nombre: user.chofer_nombre || user.nombre || user.username }
    });
  } else {
    const token = signAccessToken(user);
    const refreshToken = createRefreshToken(user);
    req.user = userFromToken(token);
    req.tenantId = req.user.tenant_id;
    audit(req, 'login_generic_via_chofer.exitoso', 'users', user.id, null, { username: user.username, role: user.role, tenant_id: user.tenant_id });
    res.json({
      token,
      refreshToken,
      role: user.role,
      permisos: getRolePermissions(user.role),
      tenant: { id: user.tenant_id || 1, nombre: user.nombre || user.username },
      chofer: { id: null, nombre: user.nombre || user.username }
    });
  }
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

app.post('/api/chofer/device-token', authenticate, (req, res) => {
  const tenantId = req.user?.tenant_id || 1;
  const { token, platform, app_version } = req.body;
  if (!token) return res.status(400).json({ error: 'Token FCM requerido' });
  const user = db.prepare("SELECT chofer_id FROM users WHERE id = ? AND tenant_id = ?").get(req.user?.id, tenantId) as any;
  const choferId = user?.chofer_id || req.body.chofer_id;
  if (!choferId) return res.status(403).json({ error: 'Usuario sin chofer asignado' });
  db.prepare(`
    INSERT INTO chofer_device_tokens (tenant_id, user_id, chofer_id, token, platform, app_version, activo, ultimo_registro)
    VALUES (?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
    ON CONFLICT(tenant_id, token) DO UPDATE SET
      user_id = excluded.user_id,
      chofer_id = excluded.chofer_id,
      platform = excluded.platform,
      app_version = excluded.app_version,
      activo = 1,
      ultimo_registro = CURRENT_TIMESTAMP
  `).run(tenantId, req.user?.id || null, choferId, token, platform || 'android', app_version || null);
  res.json({ success: true });
});

app.get('/api/chofer/events', (req, res) => {
  const token = String(req.query.token || '');
  if (!token) return res.status(401).json({ error: 'Token requerido' });
  let userPayload: any;
  try {
    userPayload = userFromToken(token);
  } catch {
    return res.status(401).json({ error: 'Token invalido o expirado' });
  }
  const tenantId = Number(userPayload.tenant_id || 1);
  const user = db.prepare("SELECT chofer_id FROM users WHERE id = ? AND tenant_id = ?").get(userPayload.id, tenantId) as any;
  const choferId = user?.chofer_id;
  if (!choferId) return res.status(403).json({ error: 'Usuario sin chofer asignado' });

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  res.flushHeaders?.();

  const key = driverEventKey(tenantId, choferId);
  const clients = driverEventClients.get(key) || new Set<express.Response>();
  clients.add(res);
  driverEventClients.set(key, clients);
  writeSse(res, 'connected', { ok: true, chofer_id: choferId, timestamp: new Date().toISOString() });

  const heartbeat = setInterval(() => writeSse(res, 'heartbeat', { timestamp: new Date().toISOString() }), 25000);
  req.on('close', () => {
    clearInterval(heartbeat);
    clients.delete(res);
    if (!clients.size) driverEventClients.delete(key);
  });
});

app.post('/api/auth/refresh', (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: 'Refresh token requerido' });
  const tokenHash = hashRefreshToken(refreshToken);
  const stored = db.prepare(`
    SELECT rt.*, u.username, u.role, u.estado
    FROM refresh_tokens rt
    JOIN users u ON u.id = rt.user_id AND u.tenant_id = rt.tenant_id
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

app.get('/api/tenants', authenticate, requirePermission('configuracion.manage'), (req, res) => {
  if (req.user?.role === 'superadmin_saas') {
    return res.json(db.prepare("SELECT id, nombre, ruc, dominio, plan, estado, fecha_alta, configuracion_json FROM tenants ORDER BY id").all());
  }
  res.json(db.prepare("SELECT id, nombre, ruc, dominio, plan, estado, fecha_alta, configuracion_json FROM tenants WHERE id = ?").all(req.user?.tenant_id || 0));
});

app.get('/api/auditoria', authenticate, requirePermission('configuracion.manage'), (req, res) => {
  const tenantId = req.user?.role === 'superadmin_saas' && req.query.tenant_id ? Number(req.query.tenant_id) : req.user?.tenant_id || 1;
  const accion = req.query.accion ? `%${String(req.query.accion)}%` : null;
  const entidad = req.query.entidad ? String(req.query.entidad) : null;
  const rows = db.prepare(`
    SELECT a.*, u.username
    FROM audit_logs a
    LEFT JOIN users u ON u.id = a.user_id AND u.tenant_id = a.tenant_id
    WHERE a.tenant_id = ?
      AND (CAST(? AS TEXT) IS NULL OR a.accion LIKE ?)
      AND (CAST(? AS TEXT) IS NULL OR a.entidad = ?)
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
function nullableNumber(value: any) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function tenantRecordExists(table: string, id: any, tenantId: number) {
  if (id === undefined || id === null || id === '') return true;
  const row = db.prepare(`SELECT id FROM ${table} WHERE id = ? AND tenant_id = ?`).get(id, tenantId) as any;
  return Boolean(row);
}

function requireTenantRecord(res: express.Response, table: string, id: any, tenantId: number, label: string) {
  if (tenantRecordExists(table, id, tenantId)) return true;
  res.status(400).json({ error: `${label} no pertenece a la empresa actual` });
  return false;
}

app.get('/api/sucursales', (req, res) => {
  res.json(db.prepare("SELECT * FROM sucursales WHERE tenant_id = ? ORDER BY id").all(tenantIdFromRequest(req)));
});
app.post('/api/sucursales', (req, res) => {
  const { nombre, codigo, direccion, ciudad, departamento, telefono, responsable, estado, latitud, longitud } = req.body;
  const tenantId = tenantIdFromRequest(req);
  const info = db.prepare("INSERT INTO sucursales (tenant_id, nombre, codigo, direccion, ciudad, departamento, telefono, responsable, estado, latitud, longitud) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(tenantId, nombre, codigo, direccion, ciudad, departamento, telefono, responsable, estado || 'activo', nullableNumber(latitud), nullableNumber(longitud));
  res.json(db.prepare("SELECT * FROM sucursales WHERE id = ? AND tenant_id = ?").get(info.lastInsertRowid, tenantId));
});
app.put('/api/sucursales/:id', (req, res) => {
  const tenantId = tenantIdFromRequest(req);
  const current = db.prepare("SELECT * FROM sucursales WHERE id = ? AND tenant_id = ?").get(req.params.id, tenantId);
  if (!current) return res.status(404).json({ error: 'Sucursal no encontrada' });
  const { nombre, codigo, direccion, ciudad, departamento, telefono, responsable, estado, latitud, longitud } = req.body;
  db.prepare(`
    UPDATE sucursales
    SET nombre = ?, codigo = ?, direccion = ?, ciudad = ?, departamento = ?, telefono = ?,
        responsable = ?, estado = ?, latitud = ?, longitud = ?
    WHERE id = ? AND tenant_id = ?
  `).run(nombre, codigo, direccion, ciudad, departamento || null, telefono, responsable || null, estado || 'activo', nullableNumber(latitud), nullableNumber(longitud), req.params.id, tenantId);
  res.json(db.prepare("SELECT * FROM sucursales WHERE id = ? AND tenant_id = ?").get(req.params.id, tenantId));
});
app.delete('/api/sucursales/:id', (req, res) => {
  const tenantId = tenantIdFromRequest(req);
  const info = db.prepare("DELETE FROM sucursales WHERE id = ? AND tenant_id = ?").run(req.params.id, tenantId);
  if (!info.changes) return res.status(404).json({ error: 'Sucursal no encontrada' });
  res.json({ success: true });
});

// --- Clientes ---
app.get('/api/clientes', (req, res) => res.json(db.prepare("SELECT * FROM clientes WHERE tenant_id = ? ORDER BY id").all(tenantIdFromRequest(req))));
app.post('/api/clientes', (req, res) => {
  const { nombre, ruc, direccion, telefono, tipo, email, condiciones_comerciales, latitud, longitud } = req.body;
  const tenantId = tenantIdFromRequest(req);
  const tx = db.transaction(() => {
    const info = db.prepare("INSERT INTO clientes (tenant_id, nombre, ruc, direccion, telefono, tipo, email, condiciones_comerciales, latitud, longitud) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(tenantId, nombre, ruc, direccion, telefono, tipo || 'persona', email, condiciones_comerciales, nullableNumber(latitud), nullableNumber(longitud));
    db.prepare("INSERT OR IGNORE INTO cuentas_corrientes_clientes (tenant_id, cliente_id, saldo_deudor, limite_credito) VALUES (?, ?, 0, 0)").run(tenantId, info.lastInsertRowid);
    return info;
  });
  const info = tx();
  res.json(db.prepare("SELECT * FROM clientes WHERE id = ? AND tenant_id = ?").get(info.lastInsertRowid, tenantId));
});
app.put('/api/clientes/:id', (req, res) => {
  const tenantId = tenantIdFromRequest(req);
  const current = db.prepare("SELECT * FROM clientes WHERE id = ? AND tenant_id = ?").get(req.params.id, tenantId);
  if (!current) return res.status(404).json({ error: 'Cliente no encontrado' });
  const { nombre, ruc, direccion, telefono, tipo, email, condiciones_comerciales, latitud, longitud } = req.body;
  db.prepare(`
    UPDATE clientes
    SET nombre = ?, ruc = ?, direccion = ?, telefono = ?, tipo = ?, email = ?,
        condiciones_comerciales = ?, latitud = ?, longitud = ?
    WHERE id = ? AND tenant_id = ?
  `).run(nombre, ruc, direccion, telefono, tipo || 'persona', email || null, condiciones_comerciales || null, nullableNumber(latitud), nullableNumber(longitud), req.params.id, tenantId);
  res.json(db.prepare("SELECT * FROM clientes WHERE id = ? AND tenant_id = ?").get(req.params.id, tenantId));
});

// --- Choferes ---
app.get('/api/choferes', (req, res) => res.json(db.prepare(`
  SELECT c.*, u.username, e.nombre as empleado_nombre, e.cargo as empleado_cargo, e.estado as empleado_estado
  FROM choferes c
  LEFT JOIN users u ON u.chofer_id = c.id AND u.tenant_id = c.tenant_id AND u.role = 'chofer' AND COALESCE(u.estado, 'activo') = 'activo'
  LEFT JOIN rrhh_empleados e ON e.id = c.empleado_id AND e.tenant_id = c.tenant_id
  WHERE c.tenant_id = ?
  ORDER BY c.id
`).all(tenantIdFromRequest(req))));
function ensureChoferEmpleado(tenantId: number, data: any, currentEmpleadoId?: any) {
  const requestedId = Number(data.empleado_id || currentEmpleadoId || 0);
  if (requestedId > 0) {
    const empleado = db.prepare("SELECT id FROM rrhh_empleados WHERE id = ? AND tenant_id = ?").get(requestedId, tenantId) as any;
    if (empleado) {
      db.prepare(`
        UPDATE rrhh_empleados
        SET nombre = COALESCE(?, nombre), documento = COALESCE(?, documento), telefono = COALESCE(?, telefono),
            cargo = COALESCE(cargo, 'Chofer'), area = COALESCE(area, 'Operaciones'), estado = COALESCE(?, estado)
        WHERE id = ? AND tenant_id = ?
      `).run(data.nombre || null, data.documento || null, data.telefono || null, data.estado || 'activo', requestedId, tenantId);
      return requestedId;
    }
  }
  if (data.documento) {
    const byDocumento = db.prepare("SELECT id FROM rrhh_empleados WHERE documento = ? AND tenant_id = ?").get(data.documento, tenantId) as any;
    if (byDocumento?.id) {
      db.prepare(`
        UPDATE rrhh_empleados
        SET nombre = COALESCE(?, nombre), telefono = COALESCE(?, telefono),
            cargo = COALESCE(cargo, 'Chofer'), area = COALESCE(area, 'Operaciones'), estado = COALESCE(?, estado)
        WHERE id = ? AND tenant_id = ?
      `).run(data.nombre || null, data.telefono || null, data.estado || 'activo', byDocumento.id, tenantId);
      return byDocumento.id;
    }
  }
  const info = db.prepare(`
    INSERT INTO rrhh_empleados (tenant_id, nombre, documento, telefono, cargo, area, fecha_ingreso, estado, observaciones)
    VALUES (?, ?, ?, ?, 'Chofer', 'Operaciones', date('now', 'localtime'), ?, 'Creado automaticamente desde choferes')
  `).run(tenantId, data.nombre, data.documento || null, data.telefono || null, data.estado || 'activo');
  return info.lastInsertRowid;
}
app.post('/api/choferes', (req, res) => {
  const { nombre, documento, licencia, telefono, vencimiento_licencia, username, password, estado } = req.body;
  const tenantId = tenantIdFromRequest(req);
  const tx = db.transaction(() => {
    const empleadoId = ensureChoferEmpleado(tenantId, req.body);
    const info = db.prepare("INSERT INTO choferes (tenant_id, empleado_id, nombre, documento, licencia, telefono, estado, vencimiento_licencia) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(tenantId, empleadoId, nombre, documento, licencia, telefono, estado || 'activo', vencimiento_licencia || '2026-12-31');
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
  res.json(db.prepare("SELECT * FROM choferes WHERE id = ? AND tenant_id = ?").get(info.lastInsertRowid, tenantId));
});
app.put('/api/choferes/:id', (req, res) => {
  const { nombre, documento, licencia, telefono, vencimiento_licencia, username, password, estado } = req.body;
  const tenantId = tenantIdFromRequest(req);
  const current = db.prepare("SELECT * FROM choferes WHERE id = ? AND tenant_id = ?").get(req.params.id, tenantId) as any;
  if (!current) return res.status(404).json({ error: 'Chofer no encontrado' });
  const tx = db.transaction(() => {
    const empleadoId = ensureChoferEmpleado(tenantId, req.body, current.empleado_id);
    db.prepare(`
      UPDATE choferes
      SET empleado_id = ?, nombre = ?, documento = ?, licencia = ?, telefono = ?, estado = ?, vencimiento_licencia = ?
      WHERE id = ? AND tenant_id = ?
    `).run(empleadoId, nombre, documento, licencia, telefono, estado || 'activo', vencimiento_licencia || '2026-12-31', req.params.id, tenantId);
    if (username) {
      const existing = db.prepare("SELECT * FROM users WHERE chofer_id = ? AND tenant_id = ? AND role = 'chofer'").get(req.params.id, tenantId) as any;
      const passwordHash = password ? bcrypt.hashSync(password, 10) : existing?.password_hash;
      if (existing) {
        db.prepare("UPDATE users SET username = ?, password_hash = COALESCE(?, password_hash), nombre = ?, estado = ?, chofer_id = ? WHERE id = ? AND tenant_id = ?").run(username, passwordHash || null, nombre, estado || 'activo', req.params.id, existing.id, tenantId);
      } else if (passwordHash) {
        db.prepare("INSERT INTO users (tenant_id, username, password, password_hash, role, nombre, estado, chofer_id) VALUES (?, ?, '', ?, 'chofer', ?, ?, ?)").run(tenantId, username, passwordHash, nombre, estado || 'activo', req.params.id);
      }
    }
  });
  tx();
  res.json(db.prepare("SELECT * FROM choferes WHERE id = ? AND tenant_id = ?").get(req.params.id, tenantId));
});

// --- Vehiculos ---
app.get('/api/vehiculos', (req, res) => res.json(db.prepare("SELECT * FROM vehiculos WHERE tenant_id = ? ORDER BY id").all(tenantIdFromRequest(req))));
app.post('/api/vehiculos', (req, res) => {
  const { chapa, marca, modelo, capacidad, vencimiento_seguro, vencimiento_habilitacion, estado, capacidad_kg, capacidad_m3, costo_km, consumo_estimado, tipo_carga_soportada } = req.body;
  const tenantId = tenantIdFromRequest(req);
  const info = db.prepare(`
    INSERT INTO vehiculos (tenant_id, chapa, marca, modelo, capacidad, estado, vencimiento_seguro, vencimiento_habilitacion, capacidad_kg, capacidad_m3, costo_km, consumo_estimado, tipo_carga_soportada)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(tenantId, chapa, marca, modelo, capacidad, estado || 'disponible', vencimiento_seguro || '2026-12-31', vencimiento_habilitacion || '2026-12-31', capacidad_kg || capacidad || 0, capacidad_m3 || 0, costo_km || 0, consumo_estimado || 0, tipo_carga_soportada || null);
  res.json(db.prepare("SELECT * FROM vehiculos WHERE id = ? AND tenant_id = ?").get(info.lastInsertRowid, tenantId));
});
app.put('/api/vehiculos/:id', (req, res) => {
  const tenantId = tenantIdFromRequest(req);
  const current = db.prepare("SELECT * FROM vehiculos WHERE id = ? AND tenant_id = ?").get(req.params.id, tenantId);
  if (!current) return res.status(404).json({ error: 'Vehiculo no encontrado' });
  const { chapa, marca, modelo, capacidad, vencimiento_seguro, vencimiento_habilitacion, estado, capacidad_kg, capacidad_m3, costo_km, consumo_estimado, tipo_carga_soportada } = req.body;
  db.prepare(`
    UPDATE vehiculos
    SET chapa = ?, marca = ?, modelo = ?, capacidad = ?, estado = ?, vencimiento_seguro = ?,
        vencimiento_habilitacion = ?, capacidad_kg = ?, capacidad_m3 = ?, costo_km = ?,
        consumo_estimado = ?, tipo_carga_soportada = ?
    WHERE id = ? AND tenant_id = ?
  `).run(chapa, marca, modelo, capacidad, estado || 'disponible', vencimiento_seguro || '2026-12-31', vencimiento_habilitacion || '2026-12-31', capacidad_kg || capacidad || 0, capacidad_m3 || 0, costo_km || 0, consumo_estimado || 0, tipo_carga_soportada || null, req.params.id, tenantId);
  res.json(db.prepare("SELECT * FROM vehiculos WHERE id = ? AND tenant_id = ?").get(req.params.id, tenantId));
});

// --- Pedidos ---
app.get('/api/pedidos', (req, res) => {
  const rows = db.prepare(`
    SELECT p.*, 
           c.nombre as cliente_pagador_nombre,
           so.nombre as sucursal_origen_nombre,
           sd.nombre as sucursal_destino_nombre
    FROM pedidos p 
    LEFT JOIN clientes c ON p.cliente_pagador_id = c.id AND c.tenant_id = p.tenant_id
    LEFT JOIN sucursales so ON p.sucursal_origen_id = so.id AND so.tenant_id = p.tenant_id
    LEFT JOIN sucursales sd ON p.sucursal_destino_id = sd.id AND sd.tenant_id = p.tenant_id
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
  const sucursalDestino = sucursal_destino_id ? Number(sucursal_destino_id) : null;
  const destinoRequerido = modalidad_entrega === 'sucursal';

  if (!cliente_pagador_id || !sucursal_origen_id || !remitente_nombre || !destinatario_nombre || !tipo_carga || (destinoRequerido && !sucursalDestino)) {
    return res.status(400).json({ error: 'Faltan datos requeridos (cliente pagador, origen, remitente, destinatario, tipo carga y destino cuando es entrega en sucursal)' });
  }
  if ((cantidad_bultos || 1) <= 0 || (peso || 0) < 0) {
    return res.status(400).json({ error: 'Cantidad de bultos o peso inválidos' });
  }

  try {
    const tenantId = tenantIdFromRequest(req);
    if (!requireTenantRecord(res, 'clientes', cliente_pagador_id, tenantId, 'Cliente pagador')) return;
    if (!requireTenantRecord(res, 'sucursales', sucursal_origen_id, tenantId, 'Sucursal origen')) return;
    if (!requireTenantRecord(res, 'sucursales', sucursalDestino, tenantId, 'Sucursal destino')) return;
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
      sucursal_origen_id, sucursalDestino, modalidad_retiro, modalidad_entrega,
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
app.put('/api/pedidos/:id/pod', authenticate, (req, res) => {
  const { estado, foto_pod, firma_pod, observaciones, bultos_reales, motivo_devolucion, precio, tipo_pago, monto_cobrado } = req.body;
  const tenantId = req.user?.tenant_id || tenantIdFromRequest(req);
  const pedido = db.prepare("SELECT * FROM pedidos WHERE id = ? AND tenant_id = ?").get(req.params.id, tenantId) as any;
  if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });
  db.prepare(`
    UPDATE pedidos 
    SET estado = ?, foto_pod = COALESCE(?, foto_pod), firma_pod = ?, observaciones = ?, bultos_reales = ?, motivo_devolucion = ?,
        precio = COALESCE(?, precio), tipo_pago = COALESCE(?, tipo_pago)
    WHERE id = ? AND tenant_id = ?
  `).run(
    estado, foto_pod || null, firma_pod, observaciones, bultos_reales, motivo_devolucion || null,
    precio === '' || precio == null ? null : Number(precio),
    tipo_pago || null,
    req.params.id, tenantId
  );
  if (Number(monto_cobrado || 0) > 0) {
    db.prepare(`
      INSERT INTO movimientos_caja (tenant_id, tipo, concepto, monto, fecha, usuario_id, referencia_id, metodo_pago, observaciones)
      VALUES (?, 'ingreso', 'Cobro gestion app chofer', ?, date('now'), ?, ?, ?, ?)
    `).run(tenantId, Number(monto_cobrado), req.user?.id || null, req.params.id, tipo_pago || 'contado', observaciones || null);
  }
  const updated = db.prepare("SELECT * FROM pedidos WHERE id = ? AND tenant_id = ?").get(req.params.id, tenantId);
  const viaje = pedido.viaje_id ? db.prepare("SELECT chofer_id FROM viajes WHERE id = ? AND tenant_id = ?").get(pedido.viaje_id, tenantId) as any : null;
  if (viaje?.chofer_id) {
    emitMonitorEvent(tenantId, 'monitor.viaje.progress.updated', { viaje_id: pedido.viaje_id, chofer_id: viaje.chofer_id, pedido_id: pedido.id, estado });
  }
  res.json({ success: true, pedido: updated });
});

// --- Viajes ---
app.get('/api/viajes', (req, res) => {
  const rows = db.prepare(`
    SELECT v.*, ch.nombre as chofer_nombre, veh.chapa as vehiculo_chapa,
           so.nombre as sucursal_origen_nombre, sd.nombre as sucursal_destino_nombre
    FROM viajes v 
    LEFT JOIN choferes ch ON v.chofer_id = ch.id AND ch.tenant_id = v.tenant_id
    LEFT JOIN vehiculos veh ON v.vehiculo_id = veh.id AND veh.tenant_id = v.tenant_id
    LEFT JOIN sucursales so ON v.sucursal_origen_id = so.id AND so.tenant_id = v.tenant_id
    LEFT JOIN sucursales sd ON v.sucursal_destino_id = sd.id AND sd.tenant_id = v.tenant_id
    WHERE v.tenant_id = ?
    ORDER BY v.id DESC
  `).all(tenantIdFromRequest(req));
  res.json(rows);
});
app.post('/api/viajes', (req, res) => {
  const { chofer_id, vehiculo_id, sucursal_origen_id, sucursal_destino_id, fecha_inicio, costo_estimado, pedido_ids, tipo_viaje } = req.body;
  const tenantId = tenantIdFromRequest(req);
  const destinoSucursal = sucursal_destino_id || (tipo_viaje === 'reparto_local' ? sucursal_origen_id : null);

  if (!chofer_id || !vehiculo_id || !sucursal_origen_id || !destinoSucursal || !fecha_inicio) {
    return res.status(400).json({ error: 'Faltan datos requeridos (chofer, vehículo, origen, fecha y destino cuando no es reparto local)' });
  }
  if (!pedido_ids || pedido_ids.length === 0) {
    return res.status(400).json({ error: 'Un viaje debe tener al menos un pedido' });
  }
  if (!requireTenantRecord(res, 'choferes', chofer_id, tenantId, 'Chofer')) return;
  if (!requireTenantRecord(res, 'vehiculos', vehiculo_id, tenantId, 'Vehiculo')) return;
  if (!requireTenantRecord(res, 'sucursales', sucursal_origen_id, tenantId, 'Sucursal origen')) return;
  if (!requireTenantRecord(res, 'sucursales', destinoSucursal, tenantId, 'Sucursal destino')) return;

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
    emitDriverEvent(tenantId, chofer_id, {
      type: 'INTERURBANO_ASIGNADO',
      title: 'Nuevo viaje intersucursal asignado',
      body: `Viaje #${id} asignado`,
      viaje_id: id,
      tipo_viaje: tipo_viaje || 'interurbano'
    });
    res.json({ id });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error creando viaje' });
  }
});
app.get('/api/viajes/chofer/:id', (req, res) => {
  const tenantId = tenantIdFromRequest(req);
  const rows = db.prepare(`
    SELECT v.*, veh.chapa as vehiculo_chapa,
           so.nombre as sucursal_origen_nombre,
           so.direccion as sucursal_origen_direccion,
           so.latitud as sucursal_origen_latitud,
           so.longitud as sucursal_origen_longitud,
           sd.nombre as sucursal_destino_nombre,
           sd.direccion as sucursal_destino_direccion,
           sd.latitud as sucursal_destino_latitud,
           sd.longitud as sucursal_destino_longitud
    FROM viajes v
    LEFT JOIN vehiculos veh ON v.vehiculo_id = veh.id AND veh.tenant_id = v.tenant_id
    LEFT JOIN sucursales so ON so.id = v.sucursal_origen_id AND so.tenant_id = v.tenant_id
    LEFT JOIN sucursales sd ON sd.id = v.sucursal_destino_id AND sd.tenant_id = v.tenant_id
    WHERE v.chofer_id = ? AND v.tenant_id = ?
      AND LOWER(v.estado) NOT IN ('finalizado', 'cancelado', 'con_incidencia')
      AND UPPER(COALESCE(v.tipo_viaje, 'interurbano')) != ?
  `).all(req.params.id, tenantId, LOCAL_TRIP_TYPE);
  const getPedidos = db.prepare(`
    SELECT p.*,
           so.nombre as sucursal_origen_nombre,
           so.direccion as sucursal_origen_direccion,
           so.latitud as sucursal_origen_latitud,
           so.longitud as sucursal_origen_longitud,
           sd.nombre as sucursal_destino_nombre,
           sd.direccion as sucursal_destino_direccion,
           sd.latitud as sucursal_destino_latitud,
           sd.longitud as sucursal_destino_longitud
    FROM pedidos p
    LEFT JOIN sucursales so ON p.sucursal_origen_id = so.id AND so.tenant_id = p.tenant_id
    LEFT JOIN sucursales sd ON p.sucursal_destino_id = sd.id AND sd.tenant_id = p.tenant_id
    WHERE p.viaje_id = ? AND p.tenant_id = ?
  `);
  res.json(rows.map((v: any) => ({ ...v, pedidos: getPedidos.all(v.id, tenantId) })));
});
app.put('/api/viajes/:id/estado', authenticate, (req, res) => {
  const { estado, incidencias, latitud, longitud } = req.body;
  const viajeId = req.params.id;
  const tenantId = req.user?.tenant_id || tenantIdFromRequest(req);
  const nextState = lower(estado || '');
  const allowedStates = ['planificado', 'asignado', 'en_curso', 'en_ruta', 'llegada_retiro', 'llegada_sucursal', 'arribado', 'finalizado', 'con_incidencia', 'cancelado'];
  if (!allowedStates.includes(nextState)) return res.status(400).json({ error: 'Estado de viaje invalido' });

  const viaje = db.prepare("SELECT * FROM viajes WHERE id = ? AND tenant_id = ?").get(viajeId, tenantId) as any;
  if (!viaje) return res.status(404).json({ error: 'Viaje no encontrado' });
  if (upper(viaje.tipo_viaje) === LOCAL_TRIP_TYPE) return res.status(400).json({ error: 'Use el flujo de reparto local para este viaje' });
  if (!isAssignedDriver(req, tenantId, viaje.chofer_id)) return res.status(403).json({ error: 'Viaje no asignado al chofer' });

  const current = lower(viaje.estado || 'planificado');
  const starts = ['planificado', 'asignado'];
  if (['llegada_retiro', 'llegada_sucursal', 'arribado', 'finalizado'].includes(nextState) && starts.includes(current)) {
    return res.status(400).json({ error: 'No se puede registrar esa accion porque el viaje todavia no esta iniciado' });
  }
  if (nextState === 'finalizado') {
    const pendientes = db.prepare(`
      SELECT COUNT(*) as total
      FROM pedidos
      WHERE viaje_id = ? AND tenant_id = ? AND estado NOT IN ('entregado','entregado_con_novedad','cancelado','devuelto')
    `).get(viajeId, tenantId) as any;
    if (Number(pendientes?.total || 0) > 0) return res.status(400).json({ error: 'No se puede finalizar porque quedan pedidos sin entregar o resolver' });
  }

  const progreso = parseJsonSafe(viaje.progreso_json);
  progreso[nextState] = { fecha: new Date().toISOString(), latitud: latitud ?? null, longitud: longitud ?? null };
  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE viajes
      SET estado = ?, incidencias = COALESCE(?, incidencias), progreso_json = ?,
          fecha_fin = CASE WHEN ? IN ('finalizado','cancelado','con_incidencia') THEN COALESCE(fecha_fin, CURRENT_TIMESTAMP) ELSE fecha_fin END
      WHERE id = ? AND tenant_id = ?
    `).run(nextState, incidencias || null, JSON.stringify(progreso), nextState, viajeId, tenantId);
    if (['en_curso', 'en_ruta'].includes(nextState)) {
      db.prepare("UPDATE pedidos SET estado = 'en_transito' WHERE viaje_id = ? AND tenant_id = ? AND estado IN ('planificado','asignado','pendiente_planificacion')").run(viajeId, tenantId);
      db.prepare("UPDATE vehiculos SET estado = 'en viaje' WHERE id = ? AND tenant_id = ?").run(viaje.vehiculo_id, tenantId);
    } else if (nextState === 'llegada_retiro') {
      db.prepare("UPDATE pedidos SET estado = 'en_retiro' WHERE viaje_id = ? AND tenant_id = ? AND estado IN ('planificado','asignado','en_transito')").run(viajeId, tenantId);
    } else if (['llegada_sucursal', 'arribado'].includes(nextState)) {
      db.prepare("UPDATE pedidos SET estado = 'en_entrega' WHERE viaje_id = ? AND tenant_id = ? AND estado IN ('recolectado','en_transito','en_retiro')").run(viajeId, tenantId);
    } else if (['finalizado', 'cancelado', 'con_incidencia'].includes(nextState)) {
      db.prepare("UPDATE vehiculos SET estado = 'disponible' WHERE id = ? AND tenant_id = ?").run(viaje.vehiculo_id, tenantId);
    }
    if (latitud != null && longitud != null) {
      db.prepare("INSERT INTO tracking (tenant_id, viaje_id, vehiculo_id, chofer_id, latitud, longitud, timestamp) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))")
        .run(tenantId, viajeId, viaje.vehiculo_id, viaje.chofer_id, latitud, longitud);
    }
  });
  tx();
  const updated = db.prepare("SELECT * FROM viajes WHERE id = ? AND tenant_id = ?").get(viajeId, tenantId) as any;
  const pedidos = db.prepare("SELECT * FROM pedidos WHERE viaje_id = ? AND tenant_id = ?").all(viajeId, tenantId);
  emitDriverEvent(tenantId, viaje.chofer_id, {
    type: 'VIAJE_INTERURBANO_ACTUALIZADO',
    title: 'Viaje actualizado',
    body: `Viaje #${viajeId}: ${nextState.replace('_', ' ')}`,
    viaje_id: Number(viajeId),
    tipo_viaje: viaje.tipo_viaje || 'interurbano',
    estado: nextState
  });
  emitMonitorEvent(tenantId, 'monitor.viaje.progress.updated', { viaje_id: Number(viajeId), chofer_id: viaje.chofer_id, estado: nextState, latitud, longitud });
  res.json({ success: true, viaje: { ...updated, pedidos }, message: `Estado actualizado a ${nextState.replace('_', ' ')}` });
});

app.post('/api/viajes/:id/cerrar', authenticate, requirePermission('viajes.manage'), (req, res) => {
  const tenantId = req.user?.tenant_id || tenantIdFromRequest(req);
  const viaje = db.prepare("SELECT * FROM viajes WHERE id = ? AND tenant_id = ?").get(req.params.id, tenantId) as any;
  if (!viaje) return res.status(404).json({ error: 'Viaje no encontrado' });
  if (upper(viaje.tipo_viaje) === LOCAL_TRIP_TYPE) return res.status(400).json({ error: 'Use el cierre de reparto local para este viaje' });

  const requested = lower(req.body.estado || 'finalizado');
  const finalState = requested === 'cancelado' ? 'cancelado' : requested === 'con_incidencia' ? 'con_incidencia' : 'finalizado';
  const observaciones = req.body.observaciones || req.body.motivo || null;
  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE viajes
      SET estado = ?, fecha_fin = COALESCE(fecha_fin, CURRENT_TIMESTAMP), incidencias = COALESCE(?, incidencias)
      WHERE id = ? AND tenant_id = ?
    `).run(finalState, observaciones, viaje.id, tenantId);
    if (viaje.vehiculo_id) {
      db.prepare("UPDATE vehiculos SET estado = 'disponible' WHERE id = ? AND tenant_id = ?").run(viaje.vehiculo_id, tenantId);
    }
    if (finalState === 'cancelado') {
      db.prepare(`
        UPDATE pedidos
        SET viaje_id = NULL, estado = CASE WHEN estado = 'entregado' THEN estado ELSE 'pendiente_planificacion' END
        WHERE viaje_id = ? AND tenant_id = ?
      `).run(viaje.id, tenantId);
    }
  });
  tx();
  audit(req, `viaje.${finalState}`, 'viajes', viaje.id, viaje, { estado: finalState, observaciones });
  emitDriverEvent(tenantId, viaje.chofer_id, {
    type: finalState === 'cancelado' ? 'VIAJE_INTERURBANO_CANCELADO' : 'VIAJE_INTERURBANO_CERRADO',
    title: finalState === 'cancelado' ? 'Viaje cancelado' : 'Viaje cerrado desde backoffice',
    body: `Viaje #${viaje.id} ${finalState === 'cancelado' ? 'cancelado' : 'cerrado'}`,
    viaje_id: viaje.id,
    tipo_viaje: viaje.tipo_viaje || 'interurbano'
  });
  res.json({ success: true, viaje: db.prepare("SELECT * FROM viajes WHERE id = ? AND tenant_id = ?").get(viaje.id, tenantId) });
});

// --- Tracking ---
app.post('/api/tracking', (req, res) => {
  const { viaje_id, vehiculo_id, chofer_id, latitud, longitud, timestamp } = req.body;
  const tenantId = tenantIdFromRequest(req);
  if (viaje_id && !requireTenantRecord(res, 'viajes', viaje_id, tenantId, 'Viaje')) return;
  if (vehiculo_id && !requireTenantRecord(res, 'vehiculos', vehiculo_id, tenantId, 'Vehiculo')) return;
  if (chofer_id && !requireTenantRecord(res, 'choferes', chofer_id, tenantId, 'Chofer')) return;
  db.prepare("INSERT INTO tracking (tenant_id, viaje_id, vehiculo_id, chofer_id, latitud, longitud, timestamp) VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')))").run(tenantId, viaje_id || null, vehiculo_id || null, chofer_id || null, latitud, longitud, timestamp || null);
  emitMonitorEvent(tenantId, 'monitor.driver.location.updated', {
    viaje_id: viaje_id || null,
    vehiculo_id: vehiculo_id || null,
    chofer_id: chofer_id || null,
    latitud,
    longitud,
    timestamp: timestamp || new Date().toISOString()
  });
  res.json({ success: true });
});
app.get('/api/tracking/latest', (req, res) => {
  const tenantId = tenantIdFromRequest(req);
  const rows = db.prepare(`
    SELECT t.id, t.viaje_id, t.vehiculo_id, t.chofer_id, t.latitud, t.longitud, t.timestamp,
           COALESCE(v.chapa, 'GPS Chofer') as chapa,
           c.nombre as chofer_nombre
    FROM tracking t
    INNER JOIN (
      SELECT COALESCE('vehiculo-' || vehiculo_id, 'chofer-' || chofer_id) as ref, MAX(timestamp) as max_time
      FROM tracking
      WHERE tenant_id = ? AND latitud IS NOT NULL AND longitud IS NOT NULL
      GROUP BY COALESCE('vehiculo-' || vehiculo_id, 'chofer-' || chofer_id)
    ) tm ON COALESCE('vehiculo-' || t.vehiculo_id, 'chofer-' || t.chofer_id) = tm.ref AND t.timestamp = tm.max_time
    LEFT JOIN vehiculos v ON t.vehiculo_id = v.id AND v.tenant_id = t.tenant_id
    LEFT JOIN choferes c ON t.chofer_id = c.id AND c.tenant_id = t.tenant_id
    WHERE t.tenant_id = ?
  `).all(tenantId, tenantId);
  res.json(rows);
});
app.get('/api/viajes/:id/tracking', (req, res) => {
  const tenantId = tenantIdFromRequest(req);
  const rows = db.prepare(`
    SELECT id, viaje_id, vehiculo_id, chofer_id, latitud, longitud, timestamp
    FROM tracking
    WHERE tenant_id = ? AND viaje_id = ? AND latitud IS NOT NULL AND longitud IS NOT NULL
    ORDER BY datetime(timestamp) ASC, id ASC
  `).all(tenantId, req.params.id);
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
app.get('/api/header-template', (req, res) => {
  res.json(getHeaderTemplate(tenantIdFromRequest(req)));
});
app.get('/api/header-template/:companyId', (req, res) => {
  const requestedTenant = Number(req.params.companyId);
  const tenantId = Number.isFinite(requestedTenant) && requestedTenant > 0 ? requestedTenant : tenantIdFromRequest(req);
  if (req.user && req.user.role !== 'superadmin_saas' && req.user.tenant_id !== tenantId) {
    return res.status(403).json({ error: 'No puede consultar otro tenant' });
  }
  res.json(getHeaderTemplate(tenantId));
});
app.put('/api/header-template', (req, res) => {
  const tenantId = tenantIdFromRequest(req);
  const blocks = Array.isArray(req.body?.blocks) ? req.body.blocks.map(sanitizeHeaderBlock) : legacyHeaderBlocks(tenantId);
  const paperWidthDefault = Number(req.body?.paperWidthDefault || req.body?.paper_width_default) === 80 ? 80 : 58;
  const name = String(req.body?.name || 'Membrete principal').slice(0, 120);
  const existing = db.prepare("SELECT * FROM header_templates WHERE tenant_id = ? ORDER BY updated_at DESC, id DESC LIMIT 1").get(tenantId) as any;
  if (existing) {
    db.prepare(`
      UPDATE header_templates
      SET name = ?, paper_width_default = ?, blocks_json = ?, version = version + 1, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND tenant_id = ?
    `).run(name, paperWidthDefault, JSON.stringify(blocks), existing.id, tenantId);
  } else {
    db.prepare(`
      INSERT INTO header_templates (tenant_id, name, paper_width_default, blocks_json, version, updated_at)
      VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
    `).run(tenantId, name, paperWidthDefault, JSON.stringify(blocks));
  }
  const updated = getHeaderTemplate(tenantId);
  audit(req, 'header_template.actualizado', 'header_templates', updated.id, existing ? templateFromRow(existing, tenantId) : null, updated);
  res.json(updated);
});
app.put('/api/header-template/:companyId', (req, res) => {
  const requestedTenant = Number(req.params.companyId);
  const tenantId = Number.isFinite(requestedTenant) && requestedTenant > 0 ? requestedTenant : tenantIdFromRequest(req);
  if (req.user && req.user.role !== 'superadmin_saas' && req.user.tenant_id !== tenantId) {
    return res.status(403).json({ error: 'No puede actualizar otro tenant' });
  }
  req.tenantId = tenantId;
  const blocks = Array.isArray(req.body?.blocks) ? req.body.blocks.map(sanitizeHeaderBlock) : legacyHeaderBlocks(tenantId);
  const paperWidthDefault = Number(req.body?.paperWidthDefault || req.body?.paper_width_default) === 80 ? 80 : 58;
  const name = String(req.body?.name || 'Membrete principal').slice(0, 120);
  const existing = db.prepare("SELECT * FROM header_templates WHERE tenant_id = ? ORDER BY updated_at DESC, id DESC LIMIT 1").get(tenantId) as any;
  if (existing) {
    db.prepare(`
      UPDATE header_templates
      SET name = ?, paper_width_default = ?, blocks_json = ?, version = version + 1, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND tenant_id = ?
    `).run(name, paperWidthDefault, JSON.stringify(blocks), existing.id, tenantId);
  } else {
    db.prepare(`
      INSERT INTO header_templates (tenant_id, name, paper_width_default, blocks_json, version, updated_at)
      VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
    `).run(tenantId, name, paperWidthDefault, JSON.stringify(blocks));
  }
  const updated = getHeaderTemplate(tenantId);
  audit(req, 'header_template.actualizado', 'header_templates', updated.id, existing ? templateFromRow(existing, tenantId) : null, updated);
  res.json(updated);
});
app.post('/api/header-template/logo', (req, res) => {
  const tenantId = tenantIdFromRequest(req);
  const dataUrl = String(req.body?.dataUrl || '');
  const match = dataUrl.match(/^data:image\/(png|jpeg|jpg|webp);base64,([a-zA-Z0-9+/=]+)$/);
  if (!match) return res.status(400).json({ error: 'Logo invalido' });
  const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length > 400000) return res.status(400).json({ error: 'Logo demasiado grande' });
  const fileName = `tenant-${tenantId}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`;
  const absolutePath = path.join(headerLogoRoot, fileName);
  fs.writeFileSync(absolutePath, buffer);
  res.json({
    imagePath: `/uploads/header-logos/${fileName}`,
    imageUrl: `${req.protocol}://${req.get('host')}/uploads/header-logos/${fileName}`
  });
});
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
    WHERE tenant_id = ? AND (CAST(? AS TEXT) IS NULL OR estado = ?)
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

const LOCAL_TRIP_TYPE = 'REPARTO_LOCAL';
const LOCAL_FINAL_STOP_STATES = ['RETIRADO', 'ENTREGADO', 'PARCIAL', 'COMPLETADO', 'FALLIDO', 'REPROGRAMADO', 'CANCELADO'];
const LOCAL_MUTABLE_STOP_STATES = ['PENDIENTE', 'EN_CAMINO', 'LLEGUE', 'REPROGRAMADO'];

function upper(value: any, fallback = '') {
  return String(value || fallback).trim().toUpperCase();
}

function lower(value: any, fallback = '') {
  return String(value || fallback).trim().toLowerCase();
}

function isDoorModality(value: any) {
  const modality = lower(value);
  return ['domicilio', 'puerta', 'retiro_domicilio', 'entrega_domicilio'].includes(modality);
}

function hasCoordinates(lat: any, lng: any) {
  return Number.isFinite(Number(lat)) && Number.isFinite(Number(lng));
}

function parseJsonSafe(value: any, fallback: any = {}) {
  try {
    return value ? JSON.parse(String(value)) : fallback;
  } catch {
    return fallback;
  }
}

function progressForStops(stops: any[]) {
  const total = stops.length;
  const completadas = stops.filter(s => ['RETIRADO', 'ENTREGADO', 'PARCIAL', 'COMPLETADO'].includes(upper(s.estado))).length;
  const fallidas = stops.filter(s => upper(s.estado) === 'FALLIDO').length;
  const pendientes = stops.filter(s => !LOCAL_FINAL_STOP_STATES.includes(upper(s.estado))).length;
  return {
    total,
    completadas,
    fallidas,
    pendientes,
    porcentaje: total ? Math.round(((completadas + fallidas) / total) * 100) : 0
  };
}

function isOperationalOnlyStop(parada: any) {
  const type = upper(parada?.tipo_parada, 'OTRO');
  return !type.includes('RETIRO') && !type.includes('ENTREGA');
}

function storedStateForStop(parada: any, requestedState: string) {
  const requested = upper(requestedState, 'PENDIENTE');
  if (requested === 'LLEGUE' && isOperationalOnlyStop(parada)) return 'COMPLETADO';
  return requested;
}

function applyLocalStopState(tenantId: number, parada: any, requestedState: string, body: any = {}) {
  const requested = upper(requestedState, 'PENDIENTE');
  const storedState = storedStateForStop(parada, requested);
  const shouldSetLlegada = requested === 'LLEGUE' || storedState === 'COMPLETADO';
  const shouldSetSalida = storedState === 'COMPLETADO' || storedState === 'CANCELADO';

  if (shouldSetLlegada && shouldSetSalida) {
    db.prepare(`
      UPDATE paradas_ruta
      SET estado = ?, llegada_real = COALESCE(llegada_real, CURRENT_TIMESTAMP),
          salida_real = COALESCE(salida_real, CURRENT_TIMESTAMP),
          observaciones = COALESCE(?, observaciones), sync_status = 'sincronizado'
      WHERE id = ? AND tenant_id = ?
    `).run(storedState, body.observaciones || null, parada.id, tenantId);
  } else if (shouldSetLlegada) {
    db.prepare(`
      UPDATE paradas_ruta
      SET estado = ?, llegada_real = COALESCE(llegada_real, CURRENT_TIMESTAMP),
          observaciones = COALESCE(?, observaciones), sync_status = 'sincronizado'
      WHERE id = ? AND tenant_id = ?
    `).run(storedState, body.observaciones || null, parada.id, tenantId);
  } else if (shouldSetSalida) {
    db.prepare(`
      UPDATE paradas_ruta
      SET estado = ?, salida_real = COALESCE(salida_real, CURRENT_TIMESTAMP),
          observaciones = COALESCE(?, observaciones), sync_status = 'sincronizado'
      WHERE id = ? AND tenant_id = ?
    `).run(storedState, body.observaciones || null, parada.id, tenantId);
  } else {
    db.prepare(`
      UPDATE paradas_ruta
      SET estado = ?, observaciones = COALESCE(?, observaciones), sync_status = 'sincronizado'
      WHERE id = ? AND tenant_id = ?
    `).run(storedState, body.observaciones || null, parada.id, tenantId);
  }

  return storedState;
}

function getRequestChoferId(req: express.Request, tenantId: number) {
  if (req.user?.role !== 'chofer') return null;
  const user = db.prepare("SELECT chofer_id FROM users WHERE id = ? AND tenant_id = ?").get(req.user.id, tenantId) as any;
  return user?.chofer_id || null;
}

function isAssignedDriver(req: express.Request, tenantId: number, choferId: any) {
  const requestChoferId = getRequestChoferId(req, tenantId);
  return !requestChoferId || Number(requestChoferId) === Number(choferId);
}

function getLocalStopForRequest(req: express.Request, res: express.Response, tenantId: number, paradaId: any) {
  const parada = db.prepare(`
    SELECT pr.*, v.chofer_id, v.estado as viaje_estado, v.tipo_viaje
    FROM paradas_ruta pr
    JOIN viajes v ON v.id = pr.viaje_id AND v.tenant_id = pr.tenant_id
    WHERE pr.id = ? AND pr.tenant_id = ? AND UPPER(v.tipo_viaje) = ?
  `).get(paradaId, tenantId, LOCAL_TRIP_TYPE) as any;
  if (!parada) {
    res.status(404).json({ error: 'Parada no encontrada' });
    return null;
  }
  if (!isAssignedDriver(req, tenantId, parada.chofer_id)) {
    res.status(403).json({ error: 'Parada no asignada al chofer' });
    return null;
  }
  return parada;
}

function recordLocalEvent(data: {
  tenantId: number;
  viajeId?: any;
  paradaId?: any;
  pedidoId?: any;
  choferId?: any;
  tipo: string;
  payload?: any;
  latitud?: any;
  longitud?: any;
  source?: string;
  app?: boolean;
  key?: string;
}) {
  const idempotencyKey = data.key || null;
  if (idempotencyKey) {
    const existing = db.prepare("SELECT id FROM eventos_reparto_local WHERE tenant_id = ? AND idempotency_key = ?").get(data.tenantId, idempotencyKey) as any;
    if (existing) return existing.id;
  }
  const info = db.prepare(`
    INSERT INTO eventos_reparto_local (
      tenant_id, viaje_id, parada_id, pedido_id, chofer_id, tipo_evento, payload_json,
      latitud, longitud, fecha, sync_source, creado_en_app, estado_sync, idempotency_key
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP), ?, ?, 'sincronizado', ?)
  `).run(
    data.tenantId,
    data.viajeId || null,
    data.paradaId || null,
    data.pedidoId || null,
    data.choferId || null,
    data.tipo,
    JSON.stringify(data.payload || {}),
    data.latitud || null,
    data.longitud || null,
    data.payload?.fecha || null,
    data.source || 'server',
    data.app ? 1 : 0,
    idempotencyKey
  );
  return info.lastInsertRowid;
}

function buildStopsFromPedido(pedido: any) {
  const stops: any[] = [];
  const retiroAddress = pedido.remitente_direccion || pedido.sucursal_origen_nombre || '';
  const entregaAddress = pedido.destinatario_direccion || pedido.sucursal_destino_nombre || '';
  const samePoint = hasCoordinates(pedido.latitud_retiro, pedido.longitud_retiro)
    && hasCoordinates(pedido.latitud_entrega, pedido.longitud_entrega)
    && Number(pedido.latitud_retiro) === Number(pedido.latitud_entrega)
    && Number(pedido.longitud_retiro) === Number(pedido.longitud_entrega);

  if (isDoorModality(pedido.modalidad_retiro) && isDoorModality(pedido.modalidad_entrega) && samePoint) {
    stops.push({
      pedido_id: pedido.id,
      tipo_parada: 'RETIRO_Y_ENTREGA',
      nombre_contacto: pedido.remitente_nombre || pedido.destinatario_nombre,
      documento_contacto: pedido.remitente_doc || pedido.destinatario_doc,
      telefono_contacto: pedido.remitente_tel || pedido.destinatario_tel,
      direccion: retiroAddress || entregaAddress,
      referencia_direccion: '',
      latitud: pedido.latitud_retiro,
      longitud: pedido.longitud_retiro,
      ventana_inicio: pedido.ventana_entrega_inicio,
      ventana_fin: pedido.ventana_entrega_fin
    });
    return stops;
  }

  if (isDoorModality(pedido.modalidad_retiro)) {
    stops.push({
      pedido_id: pedido.id,
      tipo_parada: 'RETIRO',
      nombre_contacto: pedido.remitente_nombre,
      documento_contacto: pedido.remitente_doc,
      telefono_contacto: pedido.remitente_tel,
      direccion: retiroAddress,
      referencia_direccion: '',
      latitud: pedido.latitud_retiro,
      longitud: pedido.longitud_retiro,
      ventana_inicio: null,
      ventana_fin: null
    });
  }

  if (isDoorModality(pedido.modalidad_entrega)) {
    stops.push({
      pedido_id: pedido.id,
      tipo_parada: 'ENTREGA',
      nombre_contacto: pedido.destinatario_nombre,
      documento_contacto: pedido.destinatario_doc,
      telefono_contacto: pedido.destinatario_tel,
      direccion: entregaAddress,
      referencia_direccion: '',
      latitud: pedido.latitud_entrega,
      longitud: pedido.longitud_entrega,
      ventana_inicio: pedido.ventana_entrega_inicio,
      ventana_fin: pedido.ventana_entrega_fin
    });
  }

  if (stops.length === 0) {
    stops.push({
      pedido_id: pedido.id,
      tipo_parada: 'SUCURSAL',
      nombre_contacto: pedido.destinatario_nombre || pedido.remitente_nombre,
      documento_contacto: pedido.destinatario_doc || pedido.remitente_doc,
      telefono_contacto: pedido.destinatario_tel || pedido.remitente_tel,
      direccion: entregaAddress || retiroAddress,
      referencia_direccion: 'Gestion en sucursal',
      latitud: pedido.latitud_entrega || pedido.latitud_retiro,
      longitud: pedido.longitud_entrega || pedido.longitud_retiro
    });
  }

  return stops;
}

function getLocalTripDetail(tenantId: number, viajeId: any) {
  const viaje = db.prepare(`
    SELECT v.*, ch.nombre as chofer_nombre, veh.chapa as vehiculo_chapa, veh.marca as vehiculo_marca,
           so.nombre as sucursal_origen_nombre,
           so.direccion as sucursal_origen_direccion,
           so.latitud as sucursal_origen_latitud,
           so.longitud as sucursal_origen_longitud,
           lt.latitud as chofer_latitud,
           lt.longitud as chofer_longitud,
           lt.timestamp as chofer_tracking_timestamp
    FROM viajes v
    LEFT JOIN choferes ch ON ch.id = v.chofer_id AND ch.tenant_id = v.tenant_id
    LEFT JOIN vehiculos veh ON veh.id = v.vehiculo_id AND veh.tenant_id = v.tenant_id
    LEFT JOIN sucursales so ON so.id = v.sucursal_origen_id AND so.tenant_id = v.tenant_id
    LEFT JOIN tracking lt ON lt.id = (
      SELECT t2.id
      FROM tracking t2
      WHERE t2.tenant_id = v.tenant_id
        AND (
          t2.viaje_id = v.id
          OR (t2.viaje_id IS NULL AND (t2.vehiculo_id = v.vehiculo_id OR t2.chofer_id = v.chofer_id))
        )
        AND t2.latitud IS NOT NULL AND t2.longitud IS NOT NULL
      ORDER BY t2.timestamp DESC, t2.id DESC
      LIMIT 1
    )
    WHERE v.id = ? AND v.tenant_id = ? AND UPPER(v.tipo_viaje) = ?
  `).get(viajeId, tenantId, LOCAL_TRIP_TYPE) as any;
  if (!viaje) return null;
  const ruta = db.prepare("SELECT * FROM rutas_planificadas WHERE viaje_id = ? AND tenant_id = ? ORDER BY id DESC LIMIT 1").get(viajeId, tenantId) as any;
  const paradas = db.prepare(`
    SELECT pr.*, p.numero_guia, p.estado as pedido_estado, p.cantidad_bultos, p.peso, p.volumen,
           p.valor_declarado, p.tipo_carga, p.precio, p.tipo_pago,
           p.remitente_nombre, p.remitente_doc, p.remitente_tel, p.remitente_direccion,
           p.destinatario_nombre, p.destinatario_doc, p.destinatario_tel, p.destinatario_direccion,
           so.nombre as sucursal_origen_nombre, sd.nombre as sucursal_destino_nombre
    FROM paradas_ruta pr
    LEFT JOIN pedidos p ON p.id = pr.pedido_id AND p.tenant_id = pr.tenant_id
    LEFT JOIN sucursales so ON so.id = p.sucursal_origen_id AND so.tenant_id = p.tenant_id
    LEFT JOIN sucursales sd ON sd.id = p.sucursal_destino_id AND sd.tenant_id = p.tenant_id
    WHERE pr.viaje_id = ? AND pr.tenant_id = ?
    ORDER BY pr.orden ASC, pr.id ASC
  `).all(viajeId, tenantId) as any[];
  const pedidos = db.prepare(`
    SELECT DISTINCT p.*
    FROM pedidos p
    JOIN paradas_ruta pr ON pr.pedido_id = p.id AND pr.tenant_id = p.tenant_id
    WHERE pr.viaje_id = ? AND pr.tenant_id = ?
  `).all(viajeId, tenantId);
  const eventos = db.prepare("SELECT * FROM eventos_reparto_local WHERE viaje_id = ? AND tenant_id = ? ORDER BY datetime(fecha) DESC, id DESC LIMIT 200").all(viajeId, tenantId);
  const avance = progressForStops(paradas);
  return { viaje: { ...viaje, progreso: avance }, ruta, paradas, pedidos, eventos, avance };
}

app.get('/api/reparto-local/pedidos-candidatos', authenticate, requirePermission('viajes.manage'), (req, res) => {
  const tenantId = req.user?.tenant_id || 1;
  const estado = req.query.estado ? String(req.query.estado) : null;
  const ciudad = req.query.ciudad ? String(req.query.ciudad).toLowerCase() : null;
  const zona = req.query.zona ? String(req.query.zona).toLowerCase() : null;
  const cliente = req.query.cliente ? String(req.query.cliente).toLowerCase() : null;
  const fecha = req.query.fecha ? String(req.query.fecha) : null;
  const tipoParada = req.query.tipo_parada ? upper(req.query.tipo_parada) : null;

  const conditions = [
    'p.tenant_id = ?',
    'p.viaje_id IS NULL',
    "p.estado IN ('borrador', 'registrado', 'pendiente_planificacion', 'planificado', 'asignado')"
  ];
  const values: any[] = [tenantId];
  if (estado) {
    conditions.push('p.estado = ?');
    values.push(estado);
  }
  if (fecha) {
    conditions.push('p.fecha_prevista = ?');
    values.push(fecha);
  }
  if (ciudad) {
    conditions.push("lower(COALESCE(p.remitente_direccion, '') || ' ' || COALESCE(p.destinatario_direccion, '')) LIKE ?");
    values.push(`%${ciudad}%`);
  }
  if (zona) {
    conditions.push("lower(COALESCE(p.remitente_direccion, '') || ' ' || COALESCE(p.destinatario_direccion, '')) LIKE ?");
    values.push(`%${zona}%`);
  }
  if (cliente) {
    conditions.push("lower(COALESCE(c.nombre, '') || ' ' || COALESCE(p.remitente_nombre, '') || ' ' || COALESCE(p.destinatario_nombre, '')) LIKE ?");
    values.push(`%${cliente}%`);
  }

  const rows = db.prepare(`
    SELECT p.*, c.nombre as cliente_pagador_nombre,
           so.nombre as sucursal_origen_nombre, sd.nombre as sucursal_destino_nombre
    FROM pedidos p
    LEFT JOIN clientes c ON c.id = p.cliente_pagador_id AND c.tenant_id = p.tenant_id
    LEFT JOIN sucursales so ON so.id = p.sucursal_origen_id AND so.tenant_id = p.tenant_id
    LEFT JOIN sucursales sd ON sd.id = p.sucursal_destino_id AND sd.tenant_id = p.tenant_id
    WHERE ${conditions.join(' AND ')}
    ORDER BY p.prioridad ASC, p.fecha_prevista ASC, p.id DESC
  `).all(...values) as any[];

  const candidates = rows.map(row => ({ ...row, paradas_sugeridas: buildStopsFromPedido(row) }))
    .filter(row => {
      if (!tipoParada) return true;
      return row.paradas_sugeridas.some((stop: any) => upper(stop.tipo_parada) === tipoParada);
    });
  res.json(candidates);
});

app.post('/api/reparto-local/viajes', authenticate, requirePermission('viajes.manage'), (req, res) => {
  const tenantId = req.user?.tenant_id || 1;
  const { chofer_id, vehiculo_id, sucursal_origen_id, fecha_inicio, zona, ciudad, observaciones, pedido_ids, paradas, stops: legacyStops, auto_optimizar } = req.body;
  if (!chofer_id || !vehiculo_id || !fecha_inicio) return res.status(400).json({ error: 'Chofer, vehiculo y fecha son obligatorios' });
  if (!requireTenantRecord(res, 'choferes', chofer_id, tenantId, 'Chofer')) return;
  if (!requireTenantRecord(res, 'vehiculos', vehiculo_id, tenantId, 'Vehiculo')) return;
  if (!requireTenantRecord(res, 'sucursales', sucursal_origen_id, tenantId, 'Sucursal origen')) return;

  const activeDriver = db.prepare(`
    SELECT id FROM viajes
    WHERE tenant_id = ? AND chofer_id = ? AND estado IN ('ASIGNADO', 'EN_CURSO', 'PAUSADO', 'planificado', 'en_curso', 'en_ruta')
  `).get(tenantId, chofer_id);
  if (activeDriver) return res.status(400).json({ error: 'El chofer ya tiene un viaje activo' });

  const activeVehicle = db.prepare("SELECT id FROM vehiculos WHERE id = ? AND tenant_id = ? AND estado != 'disponible'").get(vehiculo_id, tenantId);
  if (activeVehicle) return res.status(400).json({ error: 'El vehiculo no esta disponible' });

  const ids = Array.isArray(pedido_ids) ? pedido_ids.map(Number).filter(Boolean) : [];
  const placeholders = ids.length ? ids.map(() => '?').join(',') : 'NULL';
  const pedidos = ids.length ? db.prepare(`SELECT * FROM pedidos WHERE tenant_id = ? AND id IN (${placeholders})`).all(tenantId, ...ids) as any[] : [];
  if (ids.length && pedidos.length !== ids.length) return res.status(400).json({ error: 'Hay pedidos invalidos para el tenant' });
  const alreadyAssigned = pedidos.find(p => p.viaje_id);
  if (alreadyAssigned) return res.status(400).json({ error: `El pedido ${alreadyAssigned.numero_guia || alreadyAssigned.id} ya esta asignado` });

  let stops = [
    ...pedidos.flatMap(buildStopsFromPedido),
    ...(Array.isArray(paradas) ? paradas : Array.isArray(legacyStops) ? legacyStops : []).map((stop: any) => ({ ...stop, tipo_parada: upper(stop.tipo_parada, 'OTRO') }))
  ];
  if (stops.length === 0) return res.status(400).json({ error: 'Debe agregar pedidos o paradas manuales' });
  if (req.body.retornar_sucursal !== false && sucursal_origen_id && !stops.some((stop: any) => upper(stop.tipo_parada) === 'SUCURSAL_RETORNO')) {
    const base = db.prepare("SELECT * FROM sucursales WHERE id = ? AND tenant_id = ?").get(sucursal_origen_id, tenantId) as any;
    if (base) {
      stops.push({
        pedido_id: null,
        tipo_parada: 'SUCURSAL_RETORNO',
        nombre_contacto: base.nombre || 'Sucursal base',
        telefono_contacto: base.telefono || '',
        direccion: base.direccion || base.ciudad || '',
        latitud: base.latitud ?? null,
        longitud: base.longitud ?? null,
        observaciones: 'Retorno automatico a sucursal'
      });
    }
  }
  if (auto_optimizar) {
    const returnStops = stops.filter((stop: any) => upper(stop.tipo_parada) === 'SUCURSAL_RETORNO');
    const routeStops = stops.filter((stop: any) => upper(stop.tipo_parada) !== 'SUCURSAL_RETORNO');
    stops = [...routeStops].sort((a, b) => {
      const aHas = hasCoordinates(a.latitud, a.longitud) ? 0 : 1;
      const bHas = hasCoordinates(b.latitud, b.longitud) ? 0 : 1;
      return aHas - bHas;
    }).concat(returnStops);
  }

  const tx = db.transaction(() => {
    const trip = db.prepare(`
      INSERT INTO viajes (
        tenant_id, tipo_viaje, chofer_id, vehiculo_id, sucursal_origen_id, sucursal_destino_id,
        estado, fecha_inicio, zona, ciudad, observaciones, progreso_json
      ) VALUES (?, ?, ?, ?, ?, ?, 'ASIGNADO', ?, ?, ?, ?, '{}')
    `).run(tenantId, LOCAL_TRIP_TYPE, chofer_id, vehiculo_id, sucursal_origen_id || null, sucursal_origen_id || null, fecha_inicio, zona || '', ciudad || '', observaciones || '');
    const viajeId = trip.lastInsertRowid;
    const route = db.prepare(`
      INSERT INTO rutas_planificadas (tenant_id, viaje_id, vehiculo_id, chofer_id, estado)
      VALUES (?, ?, ?, ?, 'ASIGNADA')
    `).run(tenantId, viajeId, vehiculo_id, chofer_id);
    const rutaId = route.lastInsertRowid;
    stops = stops.map((stop: any) => {
      const stopType = upper(stop.tipo_parada, 'OTRO');
      if (stop.pedido_id || !['RETIRO', 'ENTREGA', 'RETIRO_Y_ENTREGA'].includes(stopType)) return stop;
      if (stopType === 'ENTREGA') {
        throw new Error('La parada ENTREGA debe tener un pedido asociado. Seleccione un pedido pendiente de entrega o cargue una parada tipo OTRO.');
      }
      const contactName = stop.nombre_contacto || stop.remitente_nombre || stop.destinatario_nombre;
      const address = stop.direccion || stop.remitente_direccion || stop.destinatario_direccion;
      if (!contactName || !address) {
        throw new Error(`La parada ${stopType} debe tener pedido asociado o datos minimos de contacto y direccion`);
      }
      const guia = `LOCAL-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      const pedidoInfo = db.prepare(`
        INSERT INTO pedidos (
          tenant_id, numero_guia, remitente_nombre, remitente_doc, remitente_tel, remitente_direccion,
          destinatario_nombre, destinatario_doc, destinatario_tel, destinatario_direccion,
          cantidad_bultos, peso, valor_declarado, precio, tipo_pago, estado, fecha_prevista, tipo_carga, viaje_id,
          latitud_retiro, longitud_retiro, latitud_entrega, longitud_entrega
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'asignado', ?, ?, ?, ?, ?, ?, ?)
      `).run(
        tenantId, guia,
        stopType.includes('RETIRO') ? contactName : (stop.remitente_nombre || ''),
        stop.remitente_doc || stop.documento_contacto || '',
        stop.remitente_tel || stop.telefono_contacto || '',
        stopType.includes('RETIRO') ? address : (stop.remitente_direccion || ''),
        stopType.includes('ENTREGA') ? contactName : (stop.destinatario_nombre || ''),
        stop.destinatario_doc || stop.documento_contacto || '',
        stop.destinatario_tel || stop.telefono_contacto || '',
        stopType.includes('ENTREGA') ? address : (stop.destinatario_direccion || ''),
        Number(stop.cantidad_bultos || 1),
        Number(stop.peso || 0),
        Number(stop.valor_declarado || 0),
        Number(stop.precio || 0),
        stop.tipo_pago || null,
        fecha_inicio,
        stop.tipo_carga || 'Carga general',
        viajeId,
        stopType.includes('RETIRO') ? stop.latitud || null : null,
        stopType.includes('RETIRO') ? stop.longitud || null : null,
        stopType.includes('ENTREGA') ? stop.latitud || null : null,
        stopType.includes('ENTREGA') ? stop.longitud || null : null
      );
      return { ...stop, pedido_id: pedidoInfo.lastInsertRowid };
    });
    const insertStop = db.prepare(`
      INSERT INTO paradas_ruta (
        tenant_id, ruta_id, viaje_id, pedido_id, orden, tipo_parada, nombre_contacto, documento_contacto,
        telefono_contacto, direccion, referencia_direccion, latitud, longitud, ventana_inicio, ventana_fin,
        estado, evidencia_json, observaciones
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDIENTE', '{}', ?)
    `);
    stops.forEach((stop, index) => {
      insertStop.run(
        tenantId, rutaId, viajeId, stop.pedido_id || null, index + 1, upper(stop.tipo_parada, 'OTRO'),
        stop.nombre_contacto || '', stop.documento_contacto || '', stop.telefono_contacto || '',
        stop.direccion || '', stop.referencia_direccion || '', stop.latitud || null, stop.longitud || null,
        stop.ventana_inicio || null, stop.ventana_fin || null, stop.observaciones || ''
      );
    });
    if (ids.length) {
      db.prepare(`UPDATE pedidos SET viaje_id = ?, estado = 'asignado' WHERE tenant_id = ? AND id IN (${placeholders})`).run(viajeId, tenantId, ...ids);
    }
    db.prepare("UPDATE vehiculos SET estado = 'en viaje' WHERE id = ? AND tenant_id = ?").run(vehiculo_id, tenantId);
    recordLocalEvent({ tenantId, viajeId, choferId: chofer_id, tipo: 'VIAJE_LOCAL_CREADO', payload: { pedido_ids: ids, paradas: stops.length }, source: 'backoffice' });
    return viajeId;
  });

  const viajeId = tx();
  audit(req, 'reparto_local.creado', 'viajes', String(viajeId), null, req.body);
  const detail = getLocalTripDetail(tenantId, viajeId);
  emitDriverEvent(tenantId, chofer_id, {
    type: 'REPARTO_LOCAL_ASIGNADO',
    title: 'Nuevo reparto local asignado',
    body: `Reparto #${viajeId} - ${zona || ciudad || 'Zona sin definir'} - ${detail?.avance?.total || stops.length} paradas`,
    viaje_id: viajeId,
    tipo_viaje: LOCAL_TRIP_TYPE,
    reparto: true,
    zona,
    ciudad,
    paradas_total: detail?.avance?.total || stops.length
  });
  res.json(detail);
});

app.get('/api/reparto-local/viajes', authenticate, requirePermission('viajes.manage'), (req, res) => {
  const tenantId = req.user?.tenant_id || 1;
  const estado = req.query.estado ? String(req.query.estado) : null;
  const fecha = req.query.fecha ? String(req.query.fecha) : null;
  const chofer = req.query.chofer_id ? Number(req.query.chofer_id) : null;

  const conditions = ['v.tenant_id = ?', 'UPPER(v.tipo_viaje) = ?'];
  const values: any[] = [tenantId, LOCAL_TRIP_TYPE];
  if (estado) {
    conditions.push('v.estado = ?');
    values.push(estado);
  }
  if (fecha) {
    conditions.push('date(v.fecha_inicio) = date(?)');
    values.push(fecha);
  }
  if (chofer) {
    conditions.push('v.chofer_id = ?');
    values.push(chofer);
  }

  const rows = db.prepare(`
    SELECT v.*, ch.nombre as chofer_nombre, veh.chapa as vehiculo_chapa,
           so.nombre as sucursal_origen_nombre,
           so.direccion as sucursal_origen_direccion,
           so.latitud as sucursal_origen_latitud,
           so.longitud as sucursal_origen_longitud,
           lt.latitud as chofer_latitud,
           lt.longitud as chofer_longitud,
           lt.timestamp as chofer_tracking_timestamp,
           COALESCE(stats.total_paradas, 0) as total_paradas,
           COALESCE(stats.completadas, 0) as completadas,
           COALESCE(stats.fallidas, 0) as fallidas,
           COALESCE(stats.total_paradas, 0) as paradas_total,
           COALESCE(stats.completadas, 0) as paradas_completadas,
           COALESCE(stats.fallidas, 0) as paradas_fallidas
    FROM viajes v
    LEFT JOIN choferes ch ON ch.id = v.chofer_id AND ch.tenant_id = v.tenant_id
    LEFT JOIN vehiculos veh ON veh.id = v.vehiculo_id AND veh.tenant_id = v.tenant_id
    LEFT JOIN sucursales so ON so.id = v.sucursal_origen_id AND so.tenant_id = v.tenant_id
    LEFT JOIN (
      SELECT tenant_id, viaje_id,
             COUNT(id) as total_paradas,
             SUM(CASE WHEN estado IN ('RETIRADO','ENTREGADO','PARCIAL','COMPLETADO') THEN 1 ELSE 0 END) as completadas,
             SUM(CASE WHEN estado = 'FALLIDO' THEN 1 ELSE 0 END) as fallidas
      FROM paradas_ruta
      GROUP BY tenant_id, viaje_id
    ) stats ON stats.viaje_id = v.id AND stats.tenant_id = v.tenant_id
    LEFT JOIN tracking lt ON lt.id = (
      SELECT t2.id
      FROM tracking t2
      WHERE t2.tenant_id = v.tenant_id
        AND (
          t2.viaje_id = v.id
          OR (t2.viaje_id IS NULL AND (t2.vehiculo_id = v.vehiculo_id OR t2.chofer_id = v.chofer_id))
        )
        AND t2.latitud IS NOT NULL AND t2.longitud IS NOT NULL
      ORDER BY t2.timestamp DESC, t2.id DESC
      LIMIT 1
    )
    WHERE ${conditions.join(' AND ')}
    ORDER BY datetime(v.fecha_inicio) DESC, v.id DESC
  `).all(...values);
  res.json(rows);
});

app.get('/api/reparto-local/viajes/:id', authenticate, requirePermission('viajes.manage'), (req, res) => {
  const detail = getLocalTripDetail(req.user?.tenant_id || tenantIdFromRequest(req), req.params.id);
  if (!detail) return res.status(404).json({ error: 'Reparto local no encontrado' });
  res.json(detail);
});

app.put('/api/reparto-local/viajes/:id', authenticate, requirePermission('viajes.manage'), (req, res) => {
  const tenantId = req.user?.tenant_id || 1;
  const current = db.prepare("SELECT * FROM viajes WHERE id = ? AND tenant_id = ? AND UPPER(tipo_viaje) = ?").get(req.params.id, tenantId, LOCAL_TRIP_TYPE) as any;
  if (!current) return res.status(404).json({ error: 'Reparto local no encontrado' });
  if (!['PLANIFICADO', 'ASIGNADO'].includes(upper(current.estado))) return res.status(400).json({ error: 'Solo se puede editar antes de iniciar' });
  const { fecha_inicio, zona, ciudad, observaciones, chofer_id, vehiculo_id } = req.body;
  db.prepare(`
    UPDATE viajes SET fecha_inicio = COALESCE(?, fecha_inicio), zona = COALESCE(?, zona), ciudad = COALESCE(?, ciudad),
      observaciones = COALESCE(?, observaciones), chofer_id = COALESCE(?, chofer_id), vehiculo_id = COALESCE(?, vehiculo_id)
    WHERE id = ? AND tenant_id = ?
  `).run(fecha_inicio || null, zona || null, ciudad || null, observaciones || null, chofer_id || null, vehiculo_id || null, req.params.id, tenantId);
  const detail = getLocalTripDetail(tenantId, req.params.id);
  emitDriverEvent(tenantId, detail?.viaje?.chofer_id || current.chofer_id, {
    type: 'REPARTO_LOCAL_ACTUALIZADO',
    title: 'Cambio de ruta/paradas',
    body: `Reparto #${req.params.id} actualizado desde el backoffice`,
    viaje_id: req.params.id,
    tipo_viaje: LOCAL_TRIP_TYPE,
    reparto: true
  });
  res.json(detail);
});

app.post('/api/reparto-local/viajes/:id/asignar', authenticate, requirePermission('viajes.manage'), (req, res) => {
  const tenantId = req.user?.tenant_id || 1;
  const { chofer_id, vehiculo_id } = req.body;
  if (!chofer_id || !vehiculo_id) return res.status(400).json({ error: 'Chofer y vehiculo son obligatorios' });
  db.prepare("UPDATE viajes SET chofer_id = ?, vehiculo_id = ?, estado = 'ASIGNADO' WHERE id = ? AND tenant_id = ? AND UPPER(tipo_viaje) = ?").run(chofer_id, vehiculo_id, req.params.id, tenantId, LOCAL_TRIP_TYPE);
  db.prepare("UPDATE rutas_planificadas SET chofer_id = ?, vehiculo_id = ?, estado = 'ASIGNADA' WHERE viaje_id = ? AND tenant_id = ?").run(chofer_id, vehiculo_id, req.params.id, tenantId);
  recordLocalEvent({ tenantId, viajeId: req.params.id, choferId: chofer_id, tipo: 'VIAJE_LOCAL_ASIGNADO', payload: { vehiculo_id }, source: 'backoffice' });
  const detail = getLocalTripDetail(tenantId, req.params.id);
  emitDriverEvent(tenantId, chofer_id, {
    type: 'REPARTO_LOCAL_ASIGNADO',
    title: 'Nuevo reparto local asignado',
    body: `Reparto #${req.params.id} - ${detail?.viaje?.zona || detail?.viaje?.ciudad || 'Zona sin definir'} - ${detail?.avance?.total || 0} paradas`,
    viaje_id: req.params.id,
    tipo_viaje: LOCAL_TRIP_TYPE,
    reparto: true,
    zona: detail?.viaje?.zona,
    ciudad: detail?.viaje?.ciudad,
    paradas_total: detail?.avance?.total || 0
  });
  res.json(detail);
});

app.post('/api/reparto-local/viajes/:id/iniciar', authenticate, (req, res) => {
  const tenantId = req.user?.tenant_id || tenantIdFromRequest(req);
  const viaje = db.prepare("SELECT * FROM viajes WHERE id = ? AND tenant_id = ? AND UPPER(tipo_viaje) = ?").get(req.params.id, tenantId, LOCAL_TRIP_TYPE) as any;
  if (!viaje) return res.status(404).json({ error: 'Reparto local no encontrado' });
  if (!isAssignedDriver(req, tenantId, viaje.chofer_id)) return res.status(403).json({ error: 'Viaje no asignado al chofer' });
  if (req.body.idempotency_key) {
    const existing = db.prepare("SELECT id FROM eventos_reparto_local WHERE tenant_id = ? AND idempotency_key = ?").get(tenantId, req.body.idempotency_key);
    if (existing) return res.json(getLocalTripDetail(tenantId, req.params.id));
  }
  db.prepare("UPDATE viajes SET estado = 'EN_CURSO' WHERE id = ? AND tenant_id = ?").run(req.params.id, tenantId);
  db.prepare("UPDATE rutas_planificadas SET estado = 'EN_CURSO' WHERE viaje_id = ? AND tenant_id = ?").run(req.params.id, tenantId);
  recordLocalEvent({ tenantId, viajeId: req.params.id, choferId: viaje.chofer_id, tipo: 'VIAJE_LOCAL_INICIADO', payload: req.body, latitud: req.body.latitud, longitud: req.body.longitud, source: 'app', app: true, key: req.body.idempotency_key });
  const detail = getLocalTripDetail(tenantId, req.params.id);
  emitMonitorEvent(tenantId, 'monitor.reparto.progress.updated', { viaje_id: Number(req.params.id), chofer_id: viaje.chofer_id, estado: 'EN_CURSO', detail });
  res.json(detail);
});

app.post('/api/reparto-local/viajes/:id/finalizar', authenticate, (req, res) => {
  const tenantId = req.user?.tenant_id || tenantIdFromRequest(req);
  const detail = getLocalTripDetail(tenantId, req.params.id);
  if (!detail) return res.status(404).json({ error: 'Reparto local no encontrado' });
  if (!isAssignedDriver(req, tenantId, detail.viaje.chofer_id)) return res.status(403).json({ error: 'Viaje no asignado al chofer' });
  const avance = detail.avance;
  const allowPending = req.body.permitir_pendientes === true;
  if (avance.pendientes > 0 && !allowPending) return res.status(400).json({ error: 'Hay paradas pendientes. Confirme finalizar con pendientes.' });
  const finalState = avance.fallidas > 0 || avance.pendientes > 0 ? 'CON_INCIDENCIAS' : 'FINALIZADO';
  db.prepare("UPDATE viajes SET estado = ?, fecha_fin = CURRENT_TIMESTAMP, progreso_json = ? WHERE id = ? AND tenant_id = ?").run(finalState, JSON.stringify(avance), req.params.id, tenantId);
  db.prepare("UPDATE rutas_planificadas SET estado = ? WHERE viaje_id = ? AND tenant_id = ?").run(finalState, req.params.id, tenantId);
  db.prepare("UPDATE vehiculos SET estado = 'disponible' WHERE id = ? AND tenant_id = ?").run(detail.viaje.vehiculo_id, tenantId);
  recordLocalEvent({ tenantId, viajeId: req.params.id, choferId: detail.viaje.chofer_id, tipo: 'VIAJE_LOCAL_FINALIZADO', payload: { avance, estado: finalState }, source: 'app', app: true, key: req.body.idempotency_key });
  const updated = getLocalTripDetail(tenantId, req.params.id);
  emitMonitorEvent(tenantId, 'monitor.reparto.progress.updated', { viaje_id: Number(req.params.id), chofer_id: detail.viaje.chofer_id, estado: finalState, detail: updated });
  res.json(updated);
});

app.post('/api/reparto-local/viajes/:id/cerrar', authenticate, requirePermission('viajes.manage'), (req, res) => {
  const tenantId = req.user?.tenant_id || tenantIdFromRequest(req);
  const detail = getLocalTripDetail(tenantId, req.params.id);
  if (!detail) return res.status(404).json({ error: 'Reparto local no encontrado' });
  const requested = upper(req.body.estado || 'FINALIZADO');
  if (!['FINALIZADO', 'CON_INCIDENCIAS', 'CANCELADO'].includes(requested)) return res.status(400).json({ error: 'Estado de cierre invalido' });
  const resolverPendientes = req.body.resolver_pendientes !== false;
  const observaciones = req.body.observaciones || req.body.motivo || null;
  const avanceBefore = detail.avance;
  if (requested === 'FINALIZADO' && avanceBefore.pendientes > 0 && !resolverPendientes) {
    return res.status(400).json({ error: 'Hay paradas pendientes. Use cierre con incidencias o marque resolver pendientes.' });
  }
  const finalState = requested === 'CANCELADO'
    ? 'CANCELADO'
    : (requested === 'CON_INCIDENCIAS' || avanceBefore.fallidas > 0 || avanceBefore.pendientes > 0 ? 'CON_INCIDENCIAS' : 'FINALIZADO');

  const tx = db.transaction(() => {
    if (resolverPendientes && ['CON_INCIDENCIAS', 'CANCELADO'].includes(finalState)) {
      db.prepare(`
        UPDATE paradas_ruta
        SET estado = 'CANCELADO', salida_real = COALESCE(salida_real, CURRENT_TIMESTAMP),
            observaciones = COALESCE(?, observaciones), sync_status = 'sincronizado'
        WHERE viaje_id = ? AND tenant_id = ? AND estado NOT IN (${LOCAL_FINAL_STOP_STATES.map(() => '?').join(',')})
      `).run(observaciones, req.params.id, tenantId, ...LOCAL_FINAL_STOP_STATES);
    }
    db.prepare("UPDATE viajes SET estado = ?, fecha_fin = CURRENT_TIMESTAMP, progreso_json = ?, incidencias = COALESCE(?, incidencias) WHERE id = ? AND tenant_id = ?")
      .run(finalState, JSON.stringify(getLocalTripDetail(tenantId, req.params.id)?.avance || avanceBefore), observaciones, req.params.id, tenantId);
    db.prepare("UPDATE rutas_planificadas SET estado = ? WHERE viaje_id = ? AND tenant_id = ?").run(finalState, req.params.id, tenantId);
    if (detail.viaje.vehiculo_id) {
      db.prepare("UPDATE vehiculos SET estado = 'disponible' WHERE id = ? AND tenant_id = ?").run(detail.viaje.vehiculo_id, tenantId);
    }
    if (finalState === 'CANCELADO') {
      db.prepare(`
        UPDATE pedidos
        SET viaje_id = NULL, estado = CASE WHEN estado IN ('entregado','entregado_con_novedad') THEN estado ELSE 'pendiente_planificacion' END
        WHERE viaje_id = ? AND tenant_id = ?
      `).run(req.params.id, tenantId);
    }
    recordLocalEvent({
      tenantId,
      viajeId: req.params.id,
      choferId: detail.viaje.chofer_id,
      tipo: finalState === 'CANCELADO' ? 'VIAJE_LOCAL_CANCELADO_BACKOFFICE' : 'VIAJE_LOCAL_CERRADO_BACKOFFICE',
      payload: { estado: finalState, observaciones, resolver_pendientes: resolverPendientes },
      source: 'backoffice'
    });
  });
  tx();
  const updated = getLocalTripDetail(tenantId, req.params.id);
  audit(req, 'reparto_local.cerrado_backoffice', 'viajes', req.params.id, detail.viaje, { estado: finalState, observaciones });
  emitDriverEvent(tenantId, detail.viaje.chofer_id, {
    type: finalState === 'CANCELADO' ? 'REPARTO_LOCAL_CANCELADO' : 'REPARTO_LOCAL_CERRADO',
    title: finalState === 'CANCELADO' ? 'Reparto cancelado' : 'Reparto cerrado desde backoffice',
    body: `Reparto #${req.params.id} ${finalState === 'CANCELADO' ? 'cancelado' : 'cerrado'}`,
    viaje_id: req.params.id,
    tipo_viaje: LOCAL_TRIP_TYPE,
    reparto: true
  });
  res.json(updated);
});

app.put('/api/reparto-local/paradas/:id/estado', authenticate, (req, res) => {
  const tenantId = req.user?.tenant_id || tenantIdFromRequest(req);
  const estado = upper(req.body.estado, 'PENDIENTE');
  if (!['PENDIENTE', 'EN_CAMINO', 'LLEGUE', 'COMPLETADO', 'CANCELADO'].includes(estado)) return res.status(400).json({ error: 'Estado de parada invalido' });
  const parada = getLocalStopForRequest(req, res, tenantId, req.params.id);
  if (!parada) return;
  if (req.body.idempotency_key) {
    const existing = db.prepare("SELECT id FROM eventos_reparto_local WHERE tenant_id = ? AND idempotency_key = ?").get(tenantId, req.body.idempotency_key);
    if (existing) return res.json({ success: true, parada: db.prepare("SELECT * FROM paradas_ruta WHERE id = ? AND tenant_id = ?").get(req.params.id, tenantId) });
  }
  const storedState = applyLocalStopState(tenantId, parada, estado, req.body);
  recordLocalEvent({
    tenantId,
    viajeId: parada.viaje_id,
    paradaId: parada.id,
    pedidoId: parada.pedido_id,
    tipo: storedState === 'COMPLETADO' && estado === 'LLEGUE' ? 'PARADA_COMPLETADA' : `PARADA_${estado}`,
    payload: { ...req.body, estado_final: storedState },
    latitud: req.body.latitud,
    longitud: req.body.longitud,
    source: 'app',
    app: true,
    key: req.body.idempotency_key
  });
  const detail = getLocalTripDetail(tenantId, parada.viaje_id);
  emitMonitorEvent(tenantId, 'monitor.reparto.progress.updated', { viaje_id: parada.viaje_id, chofer_id: parada.chofer_id, parada_id: parada.id, estado: storedState, detail });
  res.json({ success: true, parada: db.prepare("SELECT * FROM paradas_ruta WHERE id = ? AND tenant_id = ?").get(req.params.id, tenantId), detail });
});

function completeStop(req: express.Request, res: express.Response, mode: 'retiro' | 'entrega') {
  const tenantId = req.user?.tenant_id || tenantIdFromRequest(req);
  const parada = getLocalStopForRequest(req, res, tenantId, req.params.id);
  if (!parada) return;
  if (!LOCAL_MUTABLE_STOP_STATES.includes(upper(parada.estado))) return res.status(400).json({ error: 'La parada ya esta resuelta' });
  if (req.body.idempotency_key) {
    const existing = db.prepare("SELECT id FROM eventos_reparto_local WHERE tenant_id = ? AND idempotency_key = ?").get(tenantId, req.body.idempotency_key);
    if (existing) return res.json({ success: true, detail: getLocalTripDetail(tenantId, parada.viaje_id) });
  }
  if (mode === 'retiro' && !['RETIRO', 'RETIRO_Y_ENTREGA'].includes(upper(parada.tipo_parada))) return res.status(400).json({ error: 'La parada no es de retiro' });
  if (mode === 'entrega' && !['ENTREGA', 'RETIRO_Y_ENTREGA'].includes(upper(parada.tipo_parada))) return res.status(400).json({ error: 'La parada no es de entrega' });
  let pedidoId = parada.pedido_id ? Number(parada.pedido_id) : null;
  if (mode === 'entrega' && !pedidoId) {
    return res.status(400).json({ error: 'La entrega requiere un pedido asociado. Corrija la parada desde backoffice antes de operar.' });
  }
  if (mode === 'retiro' && !pedidoId) {
    const missing = [
      ['remitente_nombre', req.body.remitente_nombre || parada.nombre_contacto],
      ['remitente_direccion', req.body.remitente_direccion || parada.direccion],
      ['destinatario_nombre', req.body.destinatario_nombre],
      ['destinatario_direccion', req.body.destinatario_direccion]
    ].filter(([, value]) => !String(value || '').trim()).map(([field]) => field);
    if (missing.length) {
      return res.status(400).json({
        error: `Para generar el pedido desde el retiro faltan datos obligatorios: ${missing.join(', ')}`
      });
    }
  }
  const evidencia = {
    ...parseJsonSafe(parada.evidencia_json),
    [mode]: {
      ...req.body,
      fecha: new Date().toISOString()
    }
  };
  const newStopState = mode === 'retiro' ? 'RETIRADO' : (req.body.novedad ? 'PARCIAL' : 'ENTREGADO');
  const newPedidoState = mode === 'retiro' ? 'recolectado' : (req.body.novedad ? 'entregado_con_novedad' : 'entregado');
  const tx = db.transaction(() => {
    if (mode === 'retiro' && !pedidoId) {
      const guia = req.body.numero_guia || `APP-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      const info = db.prepare(`
        INSERT INTO pedidos (
          tenant_id, numero_guia, cliente_pagador_id,
          remitente_nombre, remitente_doc, remitente_tel, remitente_direccion,
          destinatario_nombre, destinatario_doc, destinatario_tel, destinatario_direccion,
          modalidad_retiro, modalidad_entrega, cantidad_bultos, peso, volumen, valor_declarado,
          precio, tipo_pago, estado, fecha_prevista, tipo_carga, viaje_id,
          observaciones, bultos_reales, latitud_retiro, longitud_retiro, latitud_entrega, longitud_entrega
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, date('now'), ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        tenantId,
        guia,
        req.body.cliente_pagador_id || null,
        req.body.remitente_nombre || parada.nombre_contacto || '',
        req.body.remitente_doc || parada.documento_contacto || '',
        req.body.remitente_tel || parada.telefono_contacto || '',
        req.body.remitente_direccion || parada.direccion || '',
        req.body.destinatario_nombre || '',
        req.body.destinatario_doc || '',
        req.body.destinatario_tel || '',
        req.body.destinatario_direccion || '',
        req.body.modalidad_retiro || 'retiro_app',
        req.body.modalidad_entrega || req.body.destino_operativo || null,
        Number(req.body.cantidad_bultos || req.body.bultos_reales || 1),
        Number(req.body.peso || 0),
        Number(req.body.volumen || 0),
        Number(req.body.valor_declarado || 0),
        req.body.precio === '' || req.body.precio == null ? 0 : Number(req.body.precio),
        req.body.tipo_pago || null,
        newPedidoState,
        req.body.tipo_carga || 'Carga general',
        parada.viaje_id,
        req.body.observaciones || null,
        req.body.bultos_reales || req.body.cantidad_bultos || null,
        req.body.latitud || parada.latitud || null,
        req.body.longitud || parada.longitud || null,
        req.body.latitud_entrega == null || req.body.latitud_entrega === '' ? null : Number(req.body.latitud_entrega),
        req.body.longitud_entrega == null || req.body.longitud_entrega === '' ? null : Number(req.body.longitud_entrega)
      );
      pedidoId = Number(info.lastInsertRowid);
      db.prepare("UPDATE paradas_ruta SET pedido_id = ? WHERE id = ? AND tenant_id = ?").run(pedidoId, parada.id, tenantId);
    }

    db.prepare(`
      UPDATE paradas_ruta
      SET estado = ?, salida_real = CURRENT_TIMESTAMP, evidencia_json = ?, observaciones = COALESCE(?, observaciones),
          comprobante_impreso = CASE WHEN ? THEN 1 ELSE comprobante_impreso END, sync_status = 'sincronizado'
      WHERE id = ? AND tenant_id = ?
    `).run(newStopState, JSON.stringify(evidencia), req.body.observaciones || null, req.body.comprobante_impreso ? 1 : 0, parada.id, tenantId);
    if (pedidoId) {
      const updateFields: Record<string, any> = {
        estado: newPedidoState,
        observaciones: req.body.observaciones || null,
        bultos_reales: req.body.bultos_reales || req.body.bultos_entregados || null,
        foto_pod: req.body.foto || null,
        firma_pod: req.body.firma || null
      };
      db.prepare(`
        UPDATE pedidos
        SET estado = ?, observaciones = COALESCE(?, observaciones), bultos_reales = COALESCE(?, bultos_reales),
            foto_pod = COALESCE(?, foto_pod), firma_pod = COALESCE(?, firma_pod),
            remitente_nombre = COALESCE(?, remitente_nombre), remitente_doc = COALESCE(?, remitente_doc),
            remitente_tel = COALESCE(?, remitente_tel), remitente_direccion = COALESCE(?, remitente_direccion),
            destinatario_nombre = COALESCE(?, destinatario_nombre), destinatario_doc = COALESCE(?, destinatario_doc),
            destinatario_tel = COALESCE(?, destinatario_tel), destinatario_direccion = COALESCE(?, destinatario_direccion),
            cantidad_bultos = COALESCE(?, cantidad_bultos), peso = COALESCE(?, peso), volumen = COALESCE(?, volumen),
            tipo_carga = COALESCE(?, tipo_carga), valor_declarado = COALESCE(?, valor_declarado),
            precio = COALESCE(?, precio), tipo_pago = COALESCE(?, tipo_pago),
            latitud_entrega = COALESCE(?, latitud_entrega), longitud_entrega = COALESCE(?, longitud_entrega)
        WHERE id = ? AND tenant_id = ?
      `).run(
        updateFields.estado, updateFields.observaciones, updateFields.bultos_reales, updateFields.foto_pod, updateFields.firma_pod,
        req.body.remitente_nombre || null, req.body.remitente_doc || null, req.body.remitente_tel || null, req.body.remitente_direccion || null,
        req.body.destinatario_nombre || null, req.body.destinatario_doc || null, req.body.destinatario_tel || null, req.body.destinatario_direccion || null,
        req.body.cantidad_bultos || null, req.body.peso || null, req.body.volumen || null, req.body.tipo_carga || null, req.body.valor_declarado || null,
        req.body.precio === '' || req.body.precio == null ? null : Number(req.body.precio),
        req.body.tipo_pago || null,
        req.body.latitud_entrega == null || req.body.latitud_entrega === '' ? null : Number(req.body.latitud_entrega),
        req.body.longitud_entrega == null || req.body.longitud_entrega === '' ? null : Number(req.body.longitud_entrega),
        pedidoId, tenantId
      );
      const montoCobrado = Number(req.body.monto_cobrado || 0);
      if (mode === 'retiro' && montoCobrado > 0) {
        db.prepare(`
          INSERT INTO movimientos_caja (tenant_id, tipo, concepto, monto, fecha, usuario_id, referencia_id, metodo_pago, observaciones)
          VALUES (?, 'ingreso', 'Cobro retiro app chofer', ?, date('now'), ?, ?, ?, ?)
        `).run(tenantId, montoCobrado, req.user?.id || null, pedidoId, req.body.tipo_pago || 'contado', req.body.observacion_pago || null);
      }
      const needsDeliveryStop = mode === 'retiro'
        && req.body.destinatario_direccion
        && ['domicilio', 'puerta', 'entrega_inmediata'].includes(String(req.body.modalidad_entrega || req.body.destino_operativo || '').toLowerCase());
      if (needsDeliveryStop) {
        const existingDelivery = db.prepare(`
          SELECT id FROM paradas_ruta
          WHERE tenant_id = ? AND viaje_id = ? AND pedido_id = ? AND UPPER(tipo_parada) IN ('ENTREGA','RETIRO_Y_ENTREGA')
            AND id != ?
          LIMIT 1
        `).get(tenantId, parada.viaje_id, pedidoId, parada.id) as any;
        if (!existingDelivery) {
          const maxOrder = db.prepare("SELECT COALESCE(MAX(orden), 0) as max_orden FROM paradas_ruta WHERE tenant_id = ? AND viaje_id = ?").get(tenantId, parada.viaje_id) as any;
          db.prepare(`
            INSERT INTO paradas_ruta (
              tenant_id, ruta_id, viaje_id, pedido_id, orden, tipo_parada, nombre_contacto, documento_contacto,
              telefono_contacto, direccion, referencia_direccion, latitud, longitud, ventana_inicio, ventana_fin,
              estado, evidencia_json, observaciones
            ) VALUES (?, ?, ?, ?, ?, 'ENTREGA', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDIENTE', '{}', ?)
          `).run(
            tenantId, parada.ruta_id, parada.viaje_id, pedidoId, Number(maxOrder?.max_orden || 0) + 1,
            req.body.destinatario_nombre || parada.nombre_contacto || '',
            req.body.destinatario_doc || '',
            req.body.destinatario_tel || '',
            req.body.destinatario_direccion || '',
            req.body.referencia_entrega || '',
            req.body.latitud_entrega == null || req.body.latitud_entrega === '' ? null : Number(req.body.latitud_entrega),
            req.body.longitud_entrega == null || req.body.longitud_entrega === '' ? null : Number(req.body.longitud_entrega),
            req.body.ventana_entrega_inicio || null,
            req.body.ventana_entrega_fin || null,
            'Entrega creada desde retiro app'
          );
        }
      }
      if (req.body.foto || req.body.firma) {
        db.prepare(`
          INSERT INTO evidencias_pedido (tenant_id, pedido_id, parada_id, viaje_id, tipo, tipo_evidencia, foto_url, fecha, latitud, longitud, metadata_json)
          VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?)
        `).run(tenantId, pedidoId, parada.id, parada.viaje_id, mode, mode.toUpperCase(), req.body.foto || req.body.firma || '', req.body.latitud || null, req.body.longitud || null, JSON.stringify(req.body));
      }
    }
    recordLocalEvent({ tenantId, viajeId: parada.viaje_id, paradaId: parada.id, pedidoId, tipo: mode === 'retiro' ? 'RETIRO_COMPLETADO' : 'ENTREGA_COMPLETADA', payload: { ...req.body, pedido_id: pedidoId }, latitud: req.body.latitud, longitud: req.body.longitud, source: 'app', app: true, key: req.body.idempotency_key });
  });
  tx();
  const detail = getLocalTripDetail(tenantId, parada.viaje_id);
  emitMonitorEvent(tenantId, 'monitor.reparto.progress.updated', { viaje_id: parada.viaje_id, parada_id: parada.id, pedido_id: pedidoId, modo: mode, detail });
  res.json({ success: true, pedido_id: pedidoId, detail });
}

app.post('/api/reparto-local/paradas/:id/retiro', authenticate, (req, res) => completeStop(req, res, 'retiro'));
app.post('/api/reparto-local/paradas/:id/entrega', authenticate, (req, res) => completeStop(req, res, 'entrega'));

app.post('/api/reparto-local/paradas/:id/fallida', authenticate, (req, res) => {
  const tenantId = req.user?.tenant_id || tenantIdFromRequest(req);
  const parada = getLocalStopForRequest(req, res, tenantId, req.params.id);
  if (!parada) return;
  if (!LOCAL_MUTABLE_STOP_STATES.includes(upper(parada.estado))) return res.status(400).json({ error: 'La parada ya esta resuelta' });
  if (req.body.idempotency_key) {
    const existing = db.prepare("SELECT id FROM eventos_reparto_local WHERE tenant_id = ? AND idempotency_key = ?").get(tenantId, req.body.idempotency_key);
    if (existing) return res.json({ success: true, detail: getLocalTripDetail(tenantId, parada.viaje_id) });
  }
  const motivo = req.body.motivo || 'otro';
  const evidencia = { ...parseJsonSafe(parada.evidencia_json), fallida: { ...req.body, fecha: new Date().toISOString() } };
  const tx = db.transaction(() => {
    const incidencia = db.prepare(`
      INSERT INTO incidencias_operativas (tenant_id, tipo, referencia_tipo, referencia_id, pedido_id, viaje_id, prioridad, estado, titulo, descripcion, fecha_reporte, responsable)
      VALUES (?, 'Visita fallida', 'parada', ?, ?, ?, 'media', 'abierta', ?, ?, date('now'), 'Chofer')
    `).run(tenantId, parada.id, parada.pedido_id || null, parada.viaje_id, `Visita fallida: ${motivo}`, req.body.observaciones || motivo);
    db.prepare(`
      UPDATE paradas_ruta SET estado = 'FALLIDO', salida_real = CURRENT_TIMESTAMP, motivo_fallo = ?, evidencia_json = ?,
        observaciones = COALESCE(?, observaciones), incidencia_id = ?, sync_status = 'sincronizado'
      WHERE id = ? AND tenant_id = ?
    `).run(motivo, JSON.stringify(evidencia), req.body.observaciones || null, incidencia.lastInsertRowid, parada.id, tenantId);
    if (parada.pedido_id) {
      const pedidoEstado = req.body.pedido_estado || (upper(parada.tipo_parada) === 'ENTREGA' ? 'devuelto' : 'pendiente_planificacion');
      db.prepare("UPDATE pedidos SET estado = ?, observaciones = COALESCE(?, observaciones), motivo_devolucion = ? WHERE id = ? AND tenant_id = ?").run(pedidoEstado, req.body.observaciones || null, motivo, parada.pedido_id, tenantId);
    }
    recordLocalEvent({ tenantId, viajeId: parada.viaje_id, paradaId: parada.id, pedidoId: parada.pedido_id, tipo: 'VISITA_FALLIDA', payload: req.body, latitud: req.body.latitud, longitud: req.body.longitud, source: 'app', app: true, key: req.body.idempotency_key });
  });
  tx();
  const detail = getLocalTripDetail(tenantId, parada.viaje_id);
  emitMonitorEvent(tenantId, 'monitor.reparto.progress.updated', { viaje_id: parada.viaje_id, parada_id: parada.id, pedido_id: parada.pedido_id, estado: 'FALLIDO', detail });
  res.json({ success: true, detail });
});

app.post('/api/reparto-local/paradas/:id/reprogramar', authenticate, (req, res) => {
  const tenantId = req.user?.tenant_id || tenantIdFromRequest(req);
  const parada = getLocalStopForRequest(req, res, tenantId, req.params.id);
  if (!parada) return;
  db.prepare("UPDATE paradas_ruta SET estado = 'REPROGRAMADO', ventana_inicio = COALESCE(?, ventana_inicio), ventana_fin = COALESCE(?, ventana_fin), observaciones = COALESCE(?, observaciones) WHERE id = ? AND tenant_id = ?").run(req.body.ventana_inicio || null, req.body.ventana_fin || null, req.body.observaciones || null, parada.id, tenantId);
  recordLocalEvent({ tenantId, viajeId: parada.viaje_id, paradaId: parada.id, pedidoId: parada.pedido_id, tipo: 'PARADA_REPROGRAMADA', payload: req.body, source: 'app', app: true, key: req.body.idempotency_key });
  const detail = getLocalTripDetail(tenantId, parada.viaje_id);
  emitMonitorEvent(tenantId, 'monitor.reparto.progress.updated', { viaje_id: parada.viaje_id, parada_id: parada.id, pedido_id: parada.pedido_id, estado: 'REPROGRAMADO', detail });
  res.json({ success: true, detail });
});

app.post('/api/reparto-local/sync', authenticate, (req, res) => {
  const tenantId = req.user?.tenant_id || tenantIdFromRequest(req);
  const eventos = Array.isArray(req.body.eventos) ? req.body.eventos : [];
  const results: any[] = [];
  for (const evento of eventos) {
    const tipo = upper(evento.tipo_evento || evento.tipo);
    const fakeReq: any = { ...req, params: { id: evento.parada_id }, body: { ...(evento.payload || {}), idempotency_key: evento.idempotency_key, latitud: evento.latitud, longitud: evento.longitud } };
    try {
      const alreadySynced = evento.idempotency_key
        ? db.prepare("SELECT id FROM eventos_reparto_local WHERE tenant_id = ? AND idempotency_key = ?").get(tenantId, evento.idempotency_key)
        : null;
      if (alreadySynced) {
        results.push({ idempotency_key: evento.idempotency_key, ok: true, duplicate: true });
        continue;
      }
      if (tipo === 'LLEGUE' || tipo === 'EN_CAMINO' || tipo === 'COMPLETADO') {
        const parada = getLocalStopForRequest(req, res, tenantId, evento.parada_id);
        if (!parada) throw new Error('Parada no disponible para sincronizar');
        const storedState = applyLocalStopState(tenantId, parada, tipo, evento.payload || {});
        recordLocalEvent({
          tenantId,
          viajeId: evento.viaje_id,
          paradaId: evento.parada_id,
          pedidoId: evento.pedido_id,
          tipo: storedState === 'COMPLETADO' && tipo === 'LLEGUE' ? 'PARADA_COMPLETADA' : `PARADA_${tipo}`,
          payload: { ...(evento.payload || {}), estado_final: storedState },
          latitud: evento.latitud,
          longitud: evento.longitud,
          source: 'app',
          app: true,
          key: evento.idempotency_key
        });
        results.push({ idempotency_key: evento.idempotency_key, ok: true });
      } else if (tipo === 'RETIRO_COMPLETADO') {
        completeStop(fakeReq, { json: (body: any) => body, status: () => ({ json: (body: any) => body }) } as any, 'retiro');
        results.push({ idempotency_key: evento.idempotency_key, ok: true });
      } else if (tipo === 'ENTREGA_COMPLETADA') {
        completeStop(fakeReq, { json: (body: any) => body, status: () => ({ json: (body: any) => body }) } as any, 'entrega');
        results.push({ idempotency_key: evento.idempotency_key, ok: true });
      } else if (tipo === 'VISITA_FALLIDA') {
        const parada = getLocalStopForRequest(req, res, tenantId, evento.parada_id);
        if (!parada) throw new Error('Parada no disponible para sincronizar');
        const motivo = evento.payload?.motivo || 'otro';
        const evidencia = { ...parseJsonSafe(parada.evidencia_json), fallida: { ...(evento.payload || {}), fecha: new Date().toISOString() } };
        const incidencia = db.prepare(`
          INSERT INTO incidencias_operativas (tenant_id, tipo, referencia_tipo, referencia_id, pedido_id, viaje_id, prioridad, estado, titulo, descripcion, fecha_reporte, responsable)
          VALUES (?, 'Visita fallida', 'parada', ?, ?, ?, 'media', 'abierta', ?, ?, date('now'), 'Chofer')
        `).run(tenantId, parada.id, parada.pedido_id || null, parada.viaje_id, `Visita fallida: ${motivo}`, evento.payload?.observaciones || motivo);
        db.prepare(`
          UPDATE paradas_ruta SET estado = 'FALLIDO', salida_real = CURRENT_TIMESTAMP, motivo_fallo = ?, evidencia_json = ?,
            observaciones = COALESCE(?, observaciones), incidencia_id = ?, sync_status = 'sincronizado'
          WHERE id = ? AND tenant_id = ?
        `).run(motivo, JSON.stringify(evidencia), evento.payload?.observaciones || null, incidencia.lastInsertRowid, parada.id, tenantId);
        if (parada.pedido_id) {
          const pedidoEstado = evento.payload?.pedido_estado || (upper(parada.tipo_parada) === 'ENTREGA' ? 'devuelto' : 'pendiente_planificacion');
          db.prepare("UPDATE pedidos SET estado = ?, observaciones = COALESCE(?, observaciones), motivo_devolucion = ? WHERE id = ? AND tenant_id = ?").run(pedidoEstado, evento.payload?.observaciones || null, motivo, parada.pedido_id, tenantId);
        }
        recordLocalEvent({ tenantId, viajeId: parada.viaje_id, paradaId: parada.id, pedidoId: parada.pedido_id, tipo: 'VISITA_FALLIDA', payload: evento.payload, latitud: evento.latitud, longitud: evento.longitud, source: 'app', app: true, key: evento.idempotency_key });
        results.push({ idempotency_key: evento.idempotency_key, ok: true });
      } else if (tipo === 'PARADA_REPROGRAMADA') {
        const parada = getLocalStopForRequest(req, res, tenantId, evento.parada_id);
        if (!parada) throw new Error('Parada no disponible para sincronizar');
        db.prepare("UPDATE paradas_ruta SET estado = 'REPROGRAMADO', ventana_inicio = COALESCE(?, ventana_inicio), ventana_fin = COALESCE(?, ventana_fin), observaciones = COALESCE(?, observaciones) WHERE id = ? AND tenant_id = ?").run(evento.payload?.ventana_inicio || null, evento.payload?.ventana_fin || null, evento.payload?.observaciones || null, parada.id, tenantId);
        recordLocalEvent({ tenantId, viajeId: parada.viaje_id, paradaId: parada.id, pedidoId: parada.pedido_id, tipo: 'PARADA_REPROGRAMADA', payload: evento.payload, source: 'app', app: true, key: evento.idempotency_key });
        results.push({ idempotency_key: evento.idempotency_key, ok: true });
      } else {
        recordLocalEvent({ tenantId, viajeId: evento.viaje_id, paradaId: evento.parada_id, pedidoId: evento.pedido_id, tipo, payload: evento.payload, latitud: evento.latitud, longitud: evento.longitud, source: 'app', app: true, key: evento.idempotency_key });
        results.push({ idempotency_key: evento.idempotency_key, ok: true });
      }
    } catch (e: any) {
      results.push({ idempotency_key: evento.idempotency_key, ok: false, error: e.message });
    }
  }
  res.json({ results });
});

app.get('/api/chofer/repartos', authenticate, (req, res) => {
  const tenantId = req.user?.tenant_id || 1;
  const user = db.prepare("SELECT chofer_id FROM users WHERE id = ? AND tenant_id = ?").get(req.user?.id, tenantId) as any;
  const choferId = user?.chofer_id || req.query.chofer_id;
  if (!choferId) return res.status(403).json({ error: 'Usuario sin chofer asignado' });
  const rows = db.prepare(`
    SELECT v.*, veh.chapa as vehiculo_chapa,
           COALESCE(stats.paradas_total, 0) as paradas_total,
           COALESCE(stats.paradas_total, 0) as total_paradas,
           COALESCE(stats.paradas_completadas, 0) as paradas_completadas,
           COALESCE(stats.paradas_completadas, 0) as completadas,
           COALESCE(stats.paradas_fallidas, 0) as paradas_fallidas,
           COALESCE(stats.paradas_fallidas, 0) as fallidas
    FROM viajes v
    LEFT JOIN vehiculos veh ON veh.id = v.vehiculo_id AND veh.tenant_id = v.tenant_id
    LEFT JOIN (
      SELECT viaje_id, tenant_id,
             COUNT(id) as paradas_total,
             SUM(CASE WHEN estado IN ('RETIRADO','ENTREGADO','PARCIAL','COMPLETADO') THEN 1 ELSE 0 END) as paradas_completadas,
             SUM(CASE WHEN estado = 'FALLIDO' THEN 1 ELSE 0 END) as paradas_fallidas
      FROM paradas_ruta
      GROUP BY viaje_id, tenant_id
    ) stats ON stats.viaje_id = v.id AND stats.tenant_id = v.tenant_id
    WHERE v.tenant_id = ? AND v.chofer_id = ? AND UPPER(v.tipo_viaje) = ?
      AND UPPER(v.estado) NOT IN ('FINALIZADO', 'CON_INCIDENCIAS', 'CANCELADO')
    ORDER BY datetime(v.fecha_inicio) ASC, v.id ASC
  `).all(tenantId, choferId, LOCAL_TRIP_TYPE);
  res.json(rows);
});

app.get('/api/chofer/repartos/:id', authenticate, (req, res) => {
  const tenantId = req.user?.tenant_id || 1;
  const user = db.prepare("SELECT chofer_id FROM users WHERE id = ? AND tenant_id = ?").get(req.user?.id, tenantId) as any;
  const detail = getLocalTripDetail(tenantId, req.params.id);
  if (!detail) return res.status(404).json({ error: 'Reparto no encontrado' });
  if (user?.chofer_id && Number(detail.viaje.chofer_id) !== Number(user.chofer_id)) return res.status(403).json({ error: 'Reparto no asignado al chofer' });
  res.json(detail);
});

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
function validCoordinates(lat: number, lng: number) {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

function extractCoordinatesFromText(text: string) {
  const decoded = decodeURIComponent(text);
  const normalized = decoded.replace(/\+/g, ' ');
  const coordinate = '[+-]?\\d+(?:\\.\\d+)?';
  const looseLatitude = '[+-]?\\d{1,2}\\.\\d{4,}';
  const looseLongitude = '[+-]?\\d{1,3}\\.\\d{4,}';
  const patterns = [
    new RegExp(`@(${coordinate}),\\s*(${coordinate})(?:,|z|$)`, 'i'),
    new RegExp(`[?&](?:q|ll|query)=(${coordinate}),\\s*(${coordinate})(?:&|$)`, 'i'),
    new RegExp(`!3d(${coordinate})!4d(${coordinate})`, 'i'),
    new RegExp(`(?:^|[^\\d+-])(${looseLatitude}),\\s*(${looseLongitude})(?:$|[^\\d.])`, 'i')
  ];

  for (const source of [decoded, normalized]) {
    for (const pattern of patterns) {
      const match = source.match(pattern);
      if (!match) continue;
      const latitud = Number(match[1]);
      const longitud = Number(match[2]);
      if (validCoordinates(latitud, longitud)) return { latitud, longitud };
    }
  }

  return null;
}

async function expandMapsLink(link: string) {
  try {
    const response = await fetch(link, { method: 'HEAD', redirect: 'follow' });
    if (response.url && response.url !== link) return response.url;
  } catch {}

  try {
    const response = await fetch(link, { method: 'GET', redirect: 'follow' });
    if (response.url && response.url !== link) return response.url;
  } catch {}

  return link;
}

app.post('/api/utils/parse-maps-link', async (req, res) => {
  const { link } = req.body;
  if (!link || typeof link !== 'string') return res.status(400).json({ error: 'Falta el link' });
  // Simulamos extracción
  const direct = extractCoordinatesFromText(link);
  if (direct) return res.json(direct);

  const expanded = await expandMapsLink(link);
  const fromExpanded = extractCoordinatesFromText(expanded);
  if (fromExpanded) return res.json(fromExpanded);

  return res.status(422).json({ error: 'No se encontraron coordenadas en el enlace de Google Maps' });
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
app.get('/api/cuentas-corrientes', (req, res) => {
  const tenantId = tenantIdFromRequest(req);
  const rows = db.prepare(`
    SELECT c.id as cliente_id, c.nombre, c.ruc,
           COALESCE(cc.limite_credito, 0) as limite_credito,
           COALESCE(cc.saldo_deudor, 0) as saldo_deudor,
           CASE WHEN COALESCE(cc.saldo_deudor, 0) > 0 THEN 'con_saldo' ELSE 'al_dia' END as estado
    FROM clientes c
    LEFT JOIN cuentas_corrientes_clientes cc ON cc.cliente_id = c.id AND cc.tenant_id = c.tenant_id
    WHERE c.tenant_id = ?
    ORDER BY c.nombre ASC
  `).all(tenantId);
  res.json(rows);
});

app.get('/api/clientes/:id/cuenta', (req, res) => {
  const cuenta = db.prepare("SELECT * FROM cuentas_corrientes_clientes WHERE cliente_id = ? AND tenant_id = ?").get(req.params.id, tenantIdFromRequest(req));
  res.json(cuenta || { error: 'Cuenta no encontrada' });
});
app.get('/api/clientes/:id/ledger', (req, res) => {
  const tenantId = tenantIdFromRequest(req);
  const cliente = db.prepare("SELECT id FROM clientes WHERE id = ? AND tenant_id = ?").get(req.params.id, tenantId) as any;
  if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' });
  const facturas = db.prepare(`
    SELECT fecha, numero as ref, 'Factura' as tipo, 'Factura de servicios' as concepto,
           total as debito, 0 as credito
    FROM facturas
    WHERE tenant_id = ? AND cliente_id = ?
  `).all(tenantId, req.params.id) as any[];
  const pagos = db.prepare(`
    SELECT fecha, COALESCE(referencia_comprobante, 'Pago') as ref, 'Pago' as tipo,
           metodo_pago as concepto, 0 as debito, monto as credito
    FROM pagos_clientes
    WHERE tenant_id = ? AND cliente_id = ?
  `).all(tenantId, req.params.id) as any[];
  let saldo = 0;
  const rows = [...facturas, ...pagos]
    .sort((a, b) => String(a.fecha || '').localeCompare(String(b.fecha || '')))
    .map(row => {
      saldo += Number(row.debito || 0) - Number(row.credito || 0);
      return { ...row, saldo };
    });
  res.json(rows);
});
app.post('/api/pagos', (req, res) => {
  const { cliente_id, pedido_id, monto, fecha, metodo_pago, referencia_comprobante, usuario_id } = req.body;
  const tenantId = tenantIdFromRequest(req);
  if (!requireTenantRecord(res, 'clientes', cliente_id, tenantId, 'Cliente')) return;
  if (!requireTenantRecord(res, 'pedidos', pedido_id, tenantId, 'Pedido')) return;
  const transaction = db.transaction(() => {
    db.prepare("INSERT OR IGNORE INTO cuentas_corrientes_clientes (tenant_id, cliente_id, saldo_deudor, limite_credito) VALUES (?, ?, 0, 0)").run(tenantId, cliente_id);
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
    LEFT JOIN rrhh_empleados e ON c.empleado_id = e.id AND e.tenant_id = c.tenant_id
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
    LEFT JOIN sucursales s ON e.sucursal_id = s.id AND s.tenant_id = e.tenant_id
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
    LEFT JOIN rrhh_empleados e ON a.empleado_id = e.id AND e.tenant_id = a.tenant_id
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
    LEFT JOIN rrhh_empleados e ON l.empleado_id = e.id AND e.tenant_id = l.tenant_id
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
    LEFT JOIN rrhh_empleados e ON n.empleado_id = e.id AND e.tenant_id = n.tenant_id
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
    LEFT JOIN rrhh_empleados e ON c.empleado_id = e.id AND e.tenant_id = c.tenant_id
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
    LEFT JOIN vehiculos v ON m.vehiculo_id = v.id AND v.tenant_id = m.tenant_id
    WHERE m.tenant_id = ? AND m.estado IN ('programado', 'en_proceso')
    ORDER BY date(m.fecha_programada) ASC
    LIMIT 5
  `).all(tenantId);
  const incidenciasRecientes = db.prepare(`
    SELECT i.id, i.tipo, i.titulo, i.prioridad, i.estado, i.fecha_reporte, c.nombre as cliente_nombre
    FROM incidencias_operativas i
    LEFT JOIN clientes c ON i.cliente_id = c.id AND c.tenant_id = i.tenant_id
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
    LEFT JOIN proveedores p ON c.proveedor_id = p.id AND p.tenant_id = c.tenant_id
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
    LEFT JOIN vehiculos v ON m.vehiculo_id = v.id AND v.tenant_id = m.tenant_id
    LEFT JOIN proveedores p ON m.proveedor_id = p.id AND p.tenant_id = m.tenant_id
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
    LEFT JOIN clientes c ON i.cliente_id = c.id AND c.tenant_id = i.tenant_id
    LEFT JOIN pedidos p ON i.pedido_id = p.id AND p.tenant_id = i.tenant_id
    LEFT JOIN viajes v ON i.viaje_id = v.id AND v.tenant_id = i.tenant_id
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
    LEFT JOIN sucursales s ON i.sucursal_id = s.id AND s.tenant_id = i.tenant_id
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
    LEFT JOIN sucursales so ON t.origen_sucursal_id = so.id AND so.tenant_id = t.tenant_id
    LEFT JOIN sucursales sd ON t.destino_sucursal_id = sd.id AND sd.tenant_id = t.tenant_id
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
    LEFT JOIN clientes c ON cc.cliente_id = c.id AND c.tenant_id = cc.tenant_id
    LEFT JOIN tarifarios t ON cc.tarifario_id = t.id AND t.tenant_id = cc.tenant_id
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

// --- Actualizaciones OTA app chofer ---
app.get('/api/app-updates/chofer/latest', (req, res) => {
  const user = optionalUser(req);
  const tenantId = user?.tenant_id || tenantIdFromRequest(req);
  const platform = normalizeUpdatePlatform(req.query.platform);
  const channel = normalizeUpdateChannel(req.query.channel);
  const nativeVersion = String(req.query.native_version || req.query.nativeShellVersion || '');
  const currentVersion = String(req.query.current_version || req.query.webBundleVersion || '');
  const deviceId = String(req.query.device_id || 'anonymous');

  const revokedCurrent = currentVersion
    ? db.prepare(`
      SELECT *
      FROM app_update_releases
      WHERE tenant_id = ? AND app = 'chofer' AND platform = ? AND version_web = ? AND estado = 'REVOKED'
      ORDER BY id DESC LIMIT 1
    `).get(tenantId, platform, currentVersion) as any
    : null;

  if (revokedCurrent) {
    return res.json({
      updateAvailable: false,
      action: 'rollback',
      reason: 'release_revoked',
      release: updateReleaseResponse(req, revokedCurrent)
    });
  }

  const releases = db.prepare(`
    SELECT *
    FROM app_update_releases
    WHERE tenant_id = ? AND app = 'chofer' AND platform = ? AND channel IN (?, 'emergency') AND estado = 'ACTIVE'
    ORDER BY CASE WHEN channel = 'emergency' THEN 0 ELSE 1 END, datetime(activated_at) DESC, id DESC
  `).all(tenantId, platform, channel) as any[];

  const compatible = releases.find(release => isNativeVersionCompatible(release, nativeVersion));
  if (!compatible) {
    const minRequired = releases.map(release => release.min_native_version).filter(Boolean).sort(compareVersions)[0];
    const latestNative = getConfigValue(tenantId, 'chofer_apk_latest_version') || minRequired || '';
    const token = getConfigValue(tenantId, 'chofer_apk_download_token');
    const apkUrl = getConfigValue(tenantId, 'chofer_apk_url') || (token ? nativeApkDownloadUrl(req, token) : '');
    return res.json({
      updateAvailable: false,
      action: 'none',
      reason: 'no_compatible_release',
      nativeUpdateRequired: Boolean(minRequired && nativeVersion && compareVersions(nativeVersion, minRequired) < 0),
      native: latestNative || apkUrl ? {
        latest_native_version: latestNative,
        min_supported_native_version: minRequired || getConfigValue(tenantId, 'chofer_apk_min_supported_version'),
        apk_url: apkUrl,
        obligatorio: Number(getConfigValue(tenantId, 'chofer_apk_mandatory', '0') || 0),
        notas: getConfigValue(tenantId, 'chofer_apk_notes')
      } : null
    });
  }

  if (currentVersion && String(compatible.version_web) === currentVersion) {
    return res.json({ updateAvailable: false, action: 'none', reason: 'already_current', release: updateReleaseResponse(req, compatible) });
  }

  const rolloutPercent = Math.max(0, Math.min(100, Number(compatible.rollout_percent || 0)));
  if (rolloutPercent < 100 && rolloutBucket(`${tenantId}:${platform}:${channel}:${deviceId}:${compatible.version_web}`) >= rolloutPercent) {
    return res.json({ updateAvailable: false, action: 'none', reason: 'rollout_hold' });
  }

  db.prepare(`
    INSERT INTO app_update_devices (tenant_id, app, platform, device_id, user_id, chofer_id, native_version, bundle_actual, channel, ultimo_check, metadata_json)
    VALUES (?, 'chofer', ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
    ON CONFLICT(tenant_id, app, platform, device_id) DO UPDATE SET
      user_id = excluded.user_id,
      chofer_id = excluded.chofer_id,
      native_version = excluded.native_version,
      bundle_actual = excluded.bundle_actual,
      channel = excluded.channel,
      ultimo_check = CURRENT_TIMESTAMP,
      metadata_json = excluded.metadata_json
  `).run(
    tenantId,
    platform,
    deviceId,
    user?.id || null,
    req.query.chofer_id || null,
    nativeVersion || null,
    currentVersion || null,
    channel,
    JSON.stringify({ query: req.query })
  );

  res.json({
    updateAvailable: true,
    action: 'update',
    release: updateReleaseResponse(req, compatible)
  });
});

app.get('/api/app-updates/chofer/native/latest', (req, res) => {
  const user = optionalUser(req);
  const tenantId = user?.tenant_id || tenantIdFromRequest(req);
  const nativeVersion = String(req.query.native_version || '');
  const latest = getConfigValue(tenantId, 'chofer_apk_latest_version');
  const minSupported = getConfigValue(tenantId, 'chofer_apk_min_supported_version');
  const token = getConfigValue(tenantId, 'chofer_apk_download_token');
  const apkUrl = getConfigValue(tenantId, 'chofer_apk_url') || (token ? nativeApkDownloadUrl(req, token) : '');
  const mandatory = Number(getConfigValue(tenantId, 'chofer_apk_mandatory', '0') || 0);
  const updateAvailable = Boolean(latest && nativeVersion && compareVersions(nativeVersion, latest) < 0);
  const updateRequired = Boolean((minSupported && nativeVersion && compareVersions(nativeVersion, minSupported) < 0) || (mandatory && updateAvailable));
  res.json({
    updateAvailable,
    updateRequired,
    latest_native_version: latest,
    min_supported_native_version: minSupported,
    apk_url: apkUrl,
    obligatorio: mandatory,
    notas: getConfigValue(tenantId, 'chofer_apk_notes'),
    published_at: getConfigValue(tenantId, 'chofer_apk_published_at')
  });
});

app.get('/api/app-updates/chofer/native', authenticate, requireSuperadmin, (req, res) => {
  const tenantId = req.user?.tenant_id || tenantIdFromRequest(req);
  const token = getConfigValue(tenantId, 'chofer_apk_download_token');
  res.json({
    latest_native_version: getConfigValue(tenantId, 'chofer_apk_latest_version'),
    min_supported_native_version: getConfigValue(tenantId, 'chofer_apk_min_supported_version'),
    apk_url: getConfigValue(tenantId, 'chofer_apk_url') || (token ? nativeApkDownloadUrl(req, token) : ''),
    obligatorio: Number(getConfigValue(tenantId, 'chofer_apk_mandatory', '0') || 0),
    notas: getConfigValue(tenantId, 'chofer_apk_notes'),
    published_at: getConfigValue(tenantId, 'chofer_apk_published_at'),
    size_bytes: Number(getConfigValue(tenantId, 'chofer_apk_size_bytes', '0') || 0)
  });
});

app.post('/api/app-updates/chofer/native', authenticate, requireSuperadmin, async (req, res) => {
  const tenantId = req.user?.tenant_id || tenantIdFromRequest(req);
  const latest = String(req.body.latest_native_version || '').trim();
  if (!latest) return res.status(400).json({ error: 'Version APK es obligatoria' });
  let apkUrl = String(req.body.apk_url || '').trim();
  const apkBase64 = String(req.body.apk_base64 || '');
  if (apkBase64) {
    const encoded = apkBase64.includes(',') ? apkBase64.split(',').pop() || '' : apkBase64;
    const apkBuffer = Buffer.from(encoded, 'base64');
    if (!apkBuffer.length) return res.status(400).json({ error: 'APK invalido' });
    const saved = await saveNativeApk(latest, apkBuffer);
    const token = crypto.randomBytes(24).toString('hex');
    setConfigValue(tenantId, 'chofer_apk_storage_provider', saved.provider);
    setConfigValue(tenantId, 'chofer_apk_storage_ref', saved.ref);
    setConfigValue(tenantId, 'chofer_apk_download_token', token);
    setConfigValue(tenantId, 'chofer_apk_size_bytes', apkBuffer.length);
    apkUrl = '';
  }
  if (!apkUrl && !getConfigValue(tenantId, 'chofer_apk_download_token')) return res.status(400).json({ error: 'Debe subir un APK o informar URL' });
  setConfigValue(tenantId, 'chofer_apk_latest_version', latest);
  setConfigValue(tenantId, 'chofer_apk_min_supported_version', req.body.min_supported_native_version || '');
  setConfigValue(tenantId, 'chofer_apk_url', apkUrl);
  setConfigValue(tenantId, 'chofer_apk_mandatory', req.body.obligatorio ? '1' : '0');
  setConfigValue(tenantId, 'chofer_apk_notes', req.body.notas || '');
  setConfigValue(tenantId, 'chofer_apk_published_at', new Date().toISOString());
  audit(req, 'app_update.apk_publicada', 'configuracion', 'chofer_apk_latest_version', null, { latest, apkUrl: apkUrl || 'stored' });
  const token = getConfigValue(tenantId, 'chofer_apk_download_token');
  res.json({
    success: true,
    latest_native_version: latest,
    min_supported_native_version: req.body.min_supported_native_version || '',
    apk_url: apkUrl || (token ? nativeApkDownloadUrl(req, token) : ''),
    obligatorio: req.body.obligatorio ? 1 : 0,
    notas: req.body.notas || ''
  });
});

app.get('/api/app-updates/chofer/native/download', async (req, res) => {
  const queryTenant = Number(req.query.tenant_id);
  const tenantId = Number.isFinite(queryTenant) && queryTenant > 0 ? queryTenant : tenantIdFromRequest(req);
  const token = String(req.query.token || '');
  const expected = getConfigValue(tenantId, 'chofer_apk_download_token');
  if (!expected || token !== expected) return res.status(403).json({ error: 'Token de descarga invalido' });
  const ref = getConfigValue(tenantId, 'chofer_apk_storage_ref');
  if (!ref) return res.status(404).json({ error: 'APK no encontrado' });
  res.setHeader('Content-Type', 'application/vnd.android.package-archive');
  res.setHeader('Content-Disposition', `attachment; filename="app-chofer-${getConfigValue(tenantId, 'chofer_apk_latest_version', 'latest')}.apk"`);
  if (ref.startsWith('gs://')) {
    const parsed = parseGsRef(ref);
    if (!parsed) return res.status(404).json({ error: 'Referencia GCS invalida' });
    const [buffer] = await getGcsStorage().bucket(parsed.bucket).file(parsed.object).download();
    return res.send(buffer);
  }
  if (!fs.existsSync(ref)) return res.status(404).json({ error: 'APK no encontrado' });
  res.sendFile(ref);
});

app.post('/api/app-updates/chofer/devices', (req, res) => {
  const user = optionalUser(req);
  const tenantId = user?.tenant_id || tenantIdFromRequest(req);
  const platform = normalizeUpdatePlatform(req.body.platform);
  const deviceId = String(req.body.device_id || '').trim();
  if (!deviceId) return res.status(400).json({ error: 'device_id es obligatorio' });
  db.prepare(`
    INSERT INTO app_update_devices (tenant_id, app, platform, device_id, user_id, chofer_id, native_version, bundle_actual, channel, ultimo_check, ultimo_error, metadata_json)
    VALUES (?, 'chofer', ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?)
    ON CONFLICT(tenant_id, app, platform, device_id) DO UPDATE SET
      user_id = excluded.user_id,
      chofer_id = excluded.chofer_id,
      native_version = excluded.native_version,
      bundle_actual = excluded.bundle_actual,
      channel = excluded.channel,
      ultimo_check = CURRENT_TIMESTAMP,
      ultimo_error = excluded.ultimo_error,
      metadata_json = excluded.metadata_json
  `).run(
    tenantId,
    platform,
    deviceId,
    user?.id || null,
    req.body.chofer_id || null,
    req.body.native_version || null,
    req.body.bundle_actual || null,
    normalizeUpdateChannel(req.body.channel),
    req.body.ultimo_error || null,
    JSON.stringify(req.body.metadata || {})
  );
  res.json({ success: true });
});

app.post('/api/app-updates/chofer/events', (req, res) => {
  const user = optionalUser(req);
  const tenantId = user?.tenant_id || tenantIdFromRequest(req);
  const platform = normalizeUpdatePlatform(req.body.platform);
  const eventType = String(req.body.event_type || req.body.type || '').trim().toUpperCase();
  if (!eventType) return res.status(400).json({ error: 'event_type es obligatorio' });
  db.prepare(`
    INSERT INTO app_update_events (
      tenant_id, release_id, app, platform, device_id, user_id, chofer_id, native_version,
      bundle_version, bundle_id, event_type, status, error, metadata_json
    ) VALUES (?, ?, 'chofer', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    tenantId,
    req.body.release_id || null,
    platform,
    req.body.device_id || null,
    user?.id || null,
    req.body.chofer_id || null,
    req.body.native_version || null,
    req.body.bundle_version || req.body.version_web || null,
    req.body.bundle_id || null,
    eventType,
    req.body.status || null,
    req.body.error || null,
    JSON.stringify(req.body.metadata || {})
  );
  if (req.body.device_id && req.body.error) {
    db.prepare(`
      UPDATE app_update_devices
      SET ultimo_error = ?, ultimo_check = CURRENT_TIMESTAMP
      WHERE tenant_id = ? AND app = 'chofer' AND platform = ? AND device_id = ?
    `).run(String(req.body.error), tenantId, platform, req.body.device_id);
  }
  res.json({ success: true });
});

app.get('/api/app-updates/chofer/releases/:id/download', async (req, res) => {
  const release = db.prepare(`
    SELECT *
    FROM app_update_releases
    WHERE id = ? AND app = 'chofer' AND download_token = ?
  `).get(req.params.id, req.query.token || '') as any;
  if (!release) return res.status(404).json({ error: 'Bundle no encontrado' });
  if (normalizeUpdateStatus(release.estado) === 'REVOKED') return res.status(410).json({ error: 'Bundle revocado' });

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
  res.setHeader('X-Content-SHA256', release.sha256);
  res.setHeader('Content-Disposition', `attachment; filename="chofer-${release.version_web}.zip"`);

  try {
    if (release.storage_provider === 'gcs') {
      const parsed = parseGsRef(release.storage_ref);
      if (!parsed) return res.status(404).end();
      const stream = getGcsStorage().bucket(parsed.bucket).file(parsed.object).createReadStream();
      stream.on('error', err => {
        console.warn('Error descargando bundle OTA desde GCS', err);
        if (!res.headersSent) res.status(404).end();
        else res.end();
      });
      stream.pipe(res);
      return;
    }
    if (!release.storage_ref || !fs.existsSync(release.storage_ref)) return res.status(404).end();
    res.setHeader('Content-Length', fs.statSync(release.storage_ref).size);
    fs.createReadStream(release.storage_ref).pipe(res);
  } catch (err) {
    console.warn('Error descargando bundle OTA', err);
    if (!res.headersSent) res.status(500).json({ error: 'No se pudo descargar el bundle' });
  }
});

app.get('/api/app-updates/chofer/releases', authenticate, requireSuperadmin, (req, res) => {
  const tenantId = req.user?.tenant_id || 1;
  const rows = db.prepare(`
    SELECT r.*,
           COALESCE(events.total_events, 0) as total_events,
           COALESCE(events.failed_events, 0) as failed_events
    FROM app_update_releases r
    LEFT JOIN (
      SELECT release_id, tenant_id, COUNT(id) as total_events,
             SUM(CASE WHEN event_type IN ('FAILED','DOWNLOAD_FAILED','ROLLBACK') THEN 1 ELSE 0 END) as failed_events
      FROM app_update_events
      GROUP BY release_id, tenant_id
    ) events ON events.release_id = r.id AND events.tenant_id = r.tenant_id
    WHERE r.tenant_id = ? AND r.app = 'chofer'
    ORDER BY datetime(r.created_at) DESC, r.id DESC
  `).all(tenantId) as any[];
  res.json(rows.map(row => updateReleaseResponse(req, row)));
});

app.post('/api/app-updates/chofer/releases', authenticate, requireSuperadmin, async (req, res) => {
  try {
    const tenantId = req.user?.tenant_id || 1;
    const platform = normalizeUpdatePlatform(req.body.platform);
    const channel = normalizeUpdateChannel(req.body.channel);
    const version = sanitizeUpdateVersion(req.body.version_web);
    const zipBase64 = String(req.body.zip_base64 || '').replace(/^data:.*?;base64,/, '');
    const externalUrl = String(req.body.url_zip || '').trim();
    if (!zipBase64 && !externalUrl) return res.status(400).json({ error: 'Debe subir un ZIP o informar url_zip' });

    let zipBuffer: Buffer | null = null;
    let sha256 = String(req.body.sha256 || '').trim().toLowerCase();
    let sizeBytes = Number(req.body.size_bytes || 0);
    if (zipBase64) {
      zipBuffer = Buffer.from(zipBase64, 'base64');
      if (!zipBuffer.length) return res.status(400).json({ error: 'ZIP invalido' });
      sha256 = crypto.createHash('sha256').update(zipBuffer).digest('hex');
      sizeBytes = zipBuffer.length;
      if (!zipBuffer.includes(Buffer.from('index.html'))) {
        return res.status(400).json({ error: 'El ZIP debe contener index.html en el bundle de la app' });
      }
    }
    if (!sha256 || !/^[a-f0-9]{64}$/.test(sha256)) return res.status(400).json({ error: 'sha256 invalido o ausente' });

    const payload = updateSignaturePayload({
      app: 'chofer',
      platform,
      channel,
      version_web: version,
      min_native_version: req.body.min_native_version || null,
      max_native_version: req.body.max_native_version || null,
      sha256
    });
    const signed = signUpdatePayload(payload);
    const downloadToken = crypto.randomBytes(24).toString('hex');
    const createdBy = req.user && Number.isFinite(req.user.id) && req.user.id > 0 ? req.user.id : null;
    const info = db.prepare(`
      INSERT INTO app_update_releases (
        tenant_id, app, platform, channel, version_web, native_shell_version, min_native_version, max_native_version,
        url_zip, storage_provider, storage_ref, download_token, sha256, signature, signature_payload,
        signature_algorithm, estado, rollout_percent, obligatorio, notas, size_bytes, created_by
      ) VALUES (?, 'chofer', ?, ?, ?, ?, ?, ?, ?, 'pending', NULL, ?, ?, ?, ?, ?, 'DRAFT', ?, ?, ?, ?, ?)
    `).run(
      tenantId,
      platform,
      channel,
      version,
      req.body.native_shell_version || null,
      req.body.min_native_version || null,
      req.body.max_native_version || null,
      externalUrl || null,
      downloadToken,
      sha256,
      signed.signature,
      payload,
      signed.algorithm,
      Math.max(0, Math.min(100, Number(req.body.rollout_percent || 0))),
      req.body.obligatorio ? 1 : 0,
      req.body.notas || '',
      sizeBytes,
      createdBy
    );

    const releaseId = Number(info.lastInsertRowid);
    let storageProvider = externalUrl ? 'external' : 'local';
    let storageRef = externalUrl || '';
    if (zipBuffer) {
      const stored = await saveReleaseBundle(releaseId, version, zipBuffer);
      storageProvider = stored.provider;
      storageRef = stored.ref;
    }
    const url = externalUrl || releaseDownloadUrl(req, { id: releaseId, download_token: downloadToken });
    db.prepare(`
      UPDATE app_update_releases
      SET storage_provider = ?, storage_ref = ?, url_zip = ?
      WHERE id = ? AND tenant_id = ?
    `).run(storageProvider, storageRef, url, releaseId, tenantId);

    const release = db.prepare("SELECT * FROM app_update_releases WHERE id = ? AND tenant_id = ?").get(releaseId, tenantId);
    audit(req, 'app_update.release_creada', 'app_update_releases', releaseId, null, { version_web: version, channel, platform });
    res.json(updateReleaseResponse(req, release));
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'No se pudo crear release OTA' });
  }
});

app.post('/api/app-updates/chofer/releases/:id/status', authenticate, requireSuperadmin, async (req, res) => {
  const tenantId = req.user?.tenant_id || 1;
  const release = db.prepare("SELECT * FROM app_update_releases WHERE id = ? AND tenant_id = ? AND app = 'chofer'").get(req.params.id, tenantId) as any;
  if (!release) return res.status(404).json({ error: 'Release no encontrado' });
  const estado = normalizeUpdateStatus(req.body.estado);
  if (!['DRAFT', 'ACTIVE', 'PAUSED', 'REVOKED'].includes(estado)) return res.status(400).json({ error: 'Estado invalido' });
  if (estado === 'ACTIVE' && (!release.url_zip || !release.sha256)) return res.status(400).json({ error: 'Release incompleto' });

  const tx = db.transaction(() => {
    const nowIso = new Date().toISOString();
    if (estado === 'ACTIVE') {
      db.prepare(`
        UPDATE app_update_releases
        SET estado = 'PAUSED'
        WHERE tenant_id = ? AND app = 'chofer' AND platform = ? AND channel = ? AND estado = 'ACTIVE' AND id != ?
      `).run(tenantId, release.platform, release.channel, release.id);
    }
    db.prepare(`
      UPDATE app_update_releases
      SET estado = ?,
          rollout_percent = COALESCE(?, rollout_percent),
          obligatorio = COALESCE(?, obligatorio),
          activated_at = CASE WHEN ? = 'ACTIVE' THEN ? ELSE activated_at END,
          revoked_at = CASE WHEN ? = 'REVOKED' THEN ? ELSE revoked_at END
      WHERE id = ? AND tenant_id = ?
    `).run(
      estado,
      req.body.rollout_percent == null ? null : Math.max(0, Math.min(100, Number(req.body.rollout_percent))),
      req.body.obligatorio == null ? null : (req.body.obligatorio ? 1 : 0),
      estado,
      nowIso,
      estado,
      nowIso,
      release.id,
      tenantId
    );
  });
  tx();
  const updated = db.prepare("SELECT * FROM app_update_releases WHERE id = ? AND tenant_id = ?").get(release.id, tenantId) as any;
  audit(req, 'app_update.release_estado', 'app_update_releases', release.id, release, { estado });
  if (estado === 'ACTIVE') sendAppUpdatePush(tenantId, updated).catch(err => console.warn('Push OTA fallido', err));
  res.json(updateReleaseResponse(req, updated));
});

app.post('/api/app-updates/chofer/releases/:id/rollback', authenticate, requireSuperadmin, async (req, res) => {
  const tenantId = req.user?.tenant_id || 1;
  const release = db.prepare("SELECT * FROM app_update_releases WHERE id = ? AND tenant_id = ? AND app = 'chofer'").get(req.params.id, tenantId) as any;
  if (!release) return res.status(404).json({ error: 'Release no encontrado' });
  const previous = db.prepare(`
    SELECT *
    FROM app_update_releases
    WHERE tenant_id = ? AND app = 'chofer' AND platform = ? AND channel = ? AND id != ? AND estado IN ('PAUSED','ACTIVE')
    ORDER BY datetime(activated_at) DESC, id DESC
    LIMIT 1
  `).get(tenantId, release.platform, release.channel, release.id) as any;

  const tx = db.transaction(() => {
    db.prepare("UPDATE app_update_releases SET estado = 'REVOKED', revoked_at = CURRENT_TIMESTAMP WHERE id = ? AND tenant_id = ?").run(release.id, tenantId);
    if (previous) {
      db.prepare("UPDATE app_update_releases SET estado = 'ACTIVE', activated_at = CURRENT_TIMESTAMP, rollout_percent = 100 WHERE id = ? AND tenant_id = ?").run(previous.id, tenantId);
    }
  });
  tx();
  const active = previous ? db.prepare("SELECT * FROM app_update_releases WHERE id = ? AND tenant_id = ?").get(previous.id, tenantId) : null;
  audit(req, 'app_update.rollback', 'app_update_releases', release.id, release, { active_release_id: previous?.id || null });
  if (active) sendAppUpdatePush(tenantId, active).catch(err => console.warn('Push OTA rollback fallido', err));
  res.json({ success: true, active: updateReleaseResponse(req, active), revoked: release.id });
});

app.get('/api/app-updates/chofer/events', authenticate, requireSuperadmin, (req, res) => {
  const tenantId = req.user?.tenant_id || 1;
  const releaseId = req.query.release_id ? Number(req.query.release_id) : null;
  const conditions = ['tenant_id = ?', "app = 'chofer'"];
  const values: any[] = [tenantId];
  if (releaseId) {
    conditions.push('release_id = ?');
    values.push(releaseId);
  }
  const rows = db.prepare(`
    SELECT *
    FROM app_update_events
    WHERE ${conditions.join(' AND ')}
    ORDER BY datetime(created_at) DESC, id DESC
    LIMIT 200
  `).all(...values);
  res.json(rows);
});

// --- Reportes ---
app.get('/api/reportes/rentabilidad', (req, res) => {
  const tenantId = tenantIdFromRequest(req);
  const pedidos = db.prepare("SELECT COALESCE(SUM(precio), 0) as total FROM pedidos WHERE tenant_id = ? AND estado NOT IN ('cancelado')").get(tenantId) as any;
  const facturas = db.prepare("SELECT COALESCE(SUM(total), 0) as total FROM facturas WHERE tenant_id = ? AND estado NOT IN ('anulada', 'cancelada')").get(tenantId) as any;
  const compras = db.prepare("SELECT COALESCE(SUM(monto), 0) as total FROM compras WHERE tenant_id = ?").get(tenantId) as any;
  const gastos = db.prepare("SELECT COALESCE(SUM(monto), 0) as total FROM gastos_operativos WHERE tenant_id = ?").get(tenantId) as any;
  const mantenimientos = db.prepare("SELECT COALESCE(SUM(COALESCE(costo_real, costo_estimado, 0)), 0) as total FROM mantenimientos_vehiculo WHERE tenant_id = ?").get(tenantId) as any;
  const viajes = db.prepare("SELECT COUNT(*) as count FROM viajes WHERE tenant_id = ?").get(tenantId) as any;
  const totalIngresos = Math.max(Number(pedidos.total || 0), Number(facturas.total || 0));
  const totalEgresos = Number(compras.total || 0) + Number(gastos.total || 0) + Number(mantenimientos.total || 0);
  res.json({
    total_ingresos: totalIngresos,
    total_egresos: totalEgresos,
    rentabilidad: totalIngresos - totalEgresos,
    viajes: Number(viajes.count || 0)
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
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

function unregisterRealtimeClient(client: RealtimeClient) {
  if (client.choferId) {
    const key = driverEventKey(client.tenantId, client.choferId);
    const room = driverWsClients.get(key);
    room?.delete(client);
    if (room && !room.size) driverWsClients.delete(key);
    emitMonitorEvent(client.tenantId, 'monitor.driver.offline', {
      chofer_id: client.choferId,
      user_id: client.userId,
      online: false
    });
  }
  const monitorRoom = monitorWsClients.get(client.tenantId);
  monitorRoom?.delete(client);
  if (monitorRoom && !monitorRoom.size) monitorWsClients.delete(client.tenantId);
}

function sendDriverSnapshot(client: RealtimeClient) {
  if (!client.choferId) return;
  const viajes = db.prepare(`
    SELECT id, estado, tipo_viaje, fecha_inicio, vehiculo_id, chofer_id
    FROM viajes
    WHERE tenant_id = ? AND chofer_id = ?
      AND LOWER(estado) NOT IN ('finalizado','cancelado','con_incidencia')
    ORDER BY datetime(fecha_inicio) DESC, id DESC
  `).all(client.tenantId, client.choferId);
  wsSend(client, 'driver.snapshot', { chofer_id: client.choferId, viajes });
}

wss.on('connection', (ws, req) => {
  let client: RealtimeClient | null = null;
  try {
    const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
    const token = url.searchParams.get('token') || '';
    const clientType = url.searchParams.get('client') === 'driver' ? 'driver' : 'backoffice';
    const user = userFromToken(token);
    const choferRow = db.prepare("SELECT chofer_id FROM users WHERE id = ? AND tenant_id = ?").get(user.id, user.tenant_id) as any;
    const choferId = user.role === 'chofer' ? Number(choferRow?.chofer_id || 0) || null : null;
    if (clientType === 'driver' && !choferId) {
      ws.close(4403, 'Perfil de chofer requerido');
      return;
    }
    client = { ws, tenantId: user.tenant_id, userId: user.id, role: user.role, clientType, choferId, alive: true };
    if (choferId) {
      const driverRoom = driverWsClients.get(driverEventKey(client.tenantId, choferId)) || new Set<RealtimeClient>();
      driverRoom.add(client);
      driverWsClients.set(driverEventKey(client.tenantId, choferId), driverRoom);
      emitMonitorEvent(client.tenantId, 'monitor.driver.online', { chofer_id: choferId, user_id: user.id, online: true });
      sendDriverSnapshot(client);
    } else {
      const monitorRoom = monitorWsClients.get(client.tenantId) || new Set<RealtimeClient>();
      monitorRoom.add(client);
      monitorWsClients.set(client.tenantId, monitorRoom);
      wsSend(client, 'monitor.snapshot', { tenant_id: client.tenantId });
    }
    wsSend(client, 'system.connected', { tenant_id: client.tenantId, role: client.role, chofer_id: client.choferId || null });
  } catch {
    ws.close(4401, 'Token invalido');
    return;
  }

  ws.on('pong', () => {
    if (client) client.alive = true;
  });
  ws.on('close', () => {
    if (client) unregisterRealtimeClient(client);
  });
});

setInterval(() => {
  wss.clients.forEach(ws => {
    const client = [...driverWsClients.values(), ...monitorWsClients.values()]
      .flatMap(set => Array.from(set))
      .find(item => item.ws === ws);
    if (!client) return;
    if (!client.alive) {
      ws.terminate();
      unregisterRealtimeClient(client);
      return;
    }
    client.alive = false;
    ws.ping();
  });
}, 30000).unref();

server.listen(port, () => {
  console.log(`Backend listening on port ${port}`);
});
