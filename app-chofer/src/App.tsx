import { useState, useEffect, useRef, type FormEvent, Component, type ReactNode } from 'react';
import { Truck, MapPin, CheckCircle, Navigation, Play, Printer, Camera as CameraIcon, X, AlertTriangle, Edit3, DollarSign, Settings, RefreshCw } from 'lucide-react';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Geolocation } from '@capacitor/geolocation';
import { LocalNotifications } from '@capacitor/local-notifications';
import { PushNotifications } from '@capacitor/push-notifications';
import './index.css';
import { CHOFER_NATIVE_VERSION, CHOFER_WEB_VERSION, reloadForOtaUpdate, runChoferOtaCheck, tryQueuePendingOta, type OtaStatus } from './otaUpdates';

const DEFAULT_NATIVE_API_URL = 'https://transportadora-ayr5ylhexa-uc.a.run.app/api';

// Error Boundary Component
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    console.error('App error:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="app-container">
          <div className="header" style={{ background: '#ef4444' }}>Error en la App</div>
          <div className="content" style={{ justifyContent: 'center', alignItems: 'center', padding: '2rem', textAlign: 'center' }}>
            <div className="card" style={{ background: '#fee2e2', borderColor: '#fca5a5', border: '1px solid' }}>
              <div className="text-lg" style={{ color: '#991b1b', marginBottom: '1rem' }}>
                <AlertTriangle size={48} style={{ margin: '0 auto', color: '#991b1b' }} />
              </div>
              <div style={{ color: '#991b1b', marginBottom: '1rem' }}>
                <strong>Oops! Algo salió mal</strong>
                <div style={{ fontSize: '0.9rem', marginTop: '0.5rem', wordBreak: 'break-word' }}>
                  {this.state.error?.message || 'Error desconocido'}
                </div>
              </div>
              <button className="btn" onClick={() => window.location.reload()} style={{ background: '#991b1b', width: '100%' }}>
                Recargar Aplicación
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function normalizeApiUrl(value: string) {
  return value.trim().replace(/\/+$/, '');
}

function getDefaultApiUrl() {
  const configured = import.meta.env.VITE_API_URL;
  if (configured) return normalizeApiUrl(configured);
  if (window.location.protocol === 'capacitor:') return DEFAULT_NATIVE_API_URL;
  return '/api';
}

function getApiUrl() {
  return normalizeApiUrl(localStorage.getItem('choferApiUrl') || getDefaultApiUrl());
}

type DriverSession = {
  token: string;
  refreshToken: string;
  choferId: string;
  choferNombre: string;
};

function VersionIndicator({ otaStatus }: { otaStatus: OtaStatus }) {
  const native = otaStatus?.nativeVersion || CHOFER_NATIVE_VERSION;
  const web = CHOFER_WEB_VERSION;
  return (
    <div style={{ position: 'absolute', right: '1rem', top: '0.9rem', fontSize: '0.7rem', fontWeight: 700, opacity: 0.95 }}>
      v{web} · APK v{native}
    </div>
  );
}

function OtaUpdateBanner({ status, onReload, onCheck, onNativeUpdate }: { status: OtaStatus; onReload: () => void; onCheck: () => void; onNativeUpdate: (url?: string) => void }) {
  if (!status.supported || (!status.message && !status.busy && !status.updateReady && !status.error)) return null;
  return (
    <div className={status.error ? 'error-box' : 'notice-box'} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'center' }}>
        <span>{status.busy ? 'Actualizando app...' : status.message}</span>
        {status.busy && <RefreshCw size={16} />}
      </div>
      {status.updateReady && (
        <button className="btn btn-outline" type="button" onClick={onReload}>
          <RefreshCw size={18} /> Reiniciar y aplicar {status.version ? `v${status.version}` : ''}
        </button>
      )}
      {status.nativeUpdateAvailable && (
        <button className="btn btn-outline" type="button" onClick={() => onNativeUpdate(status.apkUrl)}>
          <RefreshCw size={18} /> Descargar APK {status.nativeVersion ? `v${status.nativeVersion}` : ''}
        </button>
      )}
      {!status.busy && !status.updateReady && !status.nativeUpdateAvailable && (
        <button className="btn btn-outline" type="button" onClick={onCheck}>
          <RefreshCw size={18} /> Buscar actualizacion
        </button>
      )}
    </div>
  );
}

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('choferToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

type BluetoothDevice = {
  name: string;
  address: string;
};

type TicketConfig = {
  membrete: string;
  width: number;
  copies: number;
  fields: Record<string, boolean>;
  paperWidth: 58 | 80;
  headerTemplate: HeaderTemplate | null;
  nativeDemoBitmap?: boolean;
};

type HeaderBlockType = 'LOGO' | 'TEXT' | 'SEPARATOR' | 'SPACER';
type Alignment = 'LEFT' | 'CENTER' | 'RIGHT';
type HeaderBlock = {
  id: string;
  type: HeaderBlockType;
  visible: boolean;
  order: number;
  alignment: Alignment;
  text?: string;
  imageUrl?: string;
  fontSize?: number;
  bold?: boolean;
  widthPercent?: number;
  marginTop?: number;
  marginBottom?: number;
  height?: number;
};
type HeaderTemplate = {
  id?: number | null;
  companyId?: number;
  name: string;
  paperWidthDefault: 58 | 80;
  blocks: HeaderBlock[];
  version?: number;
  updatedAt?: string;
};
type PrintPedidoState = { pedido: any; tipo: ReceiptType; ticketConfig?: TicketConfig } | null;

const BluetoothPrinter = registerPlugin<{
  listBondedPrinters: () => Promise<{ devices: BluetoothDevice[] }>;
  print: (options: { address: string; text: string; headerHtml?: string; headerText?: string; headerBitmapDataUrl?: string; copies: number; width?: number; demoBitmap?: boolean }) => Promise<{ success: boolean }>;
}>('BluetoothPrinter');

const ExternalLauncher = registerPlugin<{
  openUrl: (options: { url: string }) => Promise<{ completed?: boolean }>;
}>('ExternalLauncher');

const BackgroundLocation = registerPlugin<{
  start: (options: { apiUrl: string; token: string; choferId: string; viajeId?: string; vehiculoId?: string }) => Promise<{ success: boolean }>;
  stop: () => Promise<{ success: boolean }>;
}>('BackgroundLocation');

const defaultTicketFields: Record<string, boolean> = {
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
};

const fieldLabels: Record<string, string> = {
  numero_guia: 'Guia',
  fecha: 'Fecha',
  remitente_nombre: 'Remitente',
  remitente_doc: 'Doc. remitente',
  remitente_tel: 'Tel. remitente',
  remitente_direccion: 'Dir. remitente',
  destinatario_nombre: 'Destinatario',
  destinatario_doc: 'Doc. destinatario',
  destinatario_tel: 'Tel. destinatario',
  destinatario_direccion: 'Dir. destinatario',
  sucursal_origen_nombre: 'Origen',
  sucursal_destino_nombre: 'Destino',
  tipo_carga: 'Carga',
  cantidad_bultos: 'Bultos',
  peso: 'Peso kg',
  volumen: 'Volumen',
  valor_declarado: 'Valor declarado',
  precio: 'Precio',
  tipo_pago: 'Pago',
  estado: 'Estado',
  observaciones: 'Obs.'
};

function money(value: any) {
  const numeric = Number(value || 0);
  return `Gs. ${numeric.toLocaleString('es-PY')}`;
}

function escapeHtml(value: any) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function alignText(text: string, width: number, alignment: Alignment = 'LEFT') {
  const safe = String(text || '').slice(0, width);
  const space = Math.max(0, width - safe.length);
  if (alignment === 'RIGHT') return ' '.repeat(space) + safe;
  if (alignment === 'CENTER') {
    const left = Math.floor(space / 2);
    return ' '.repeat(left) + safe;
  }
  return safe;
}

function line(width: number) {
  return '-'.repeat(Math.max(24, width));
}

function paperPixels(width: 58 | 80) {
  return width === 80 ? 576 : 384;
}

function legacyHeaderToTemplate(membrete: string): HeaderTemplate {
  const lines = String(membrete || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .split(/\\n|\n/)
    .map(line => line.trim())
    .filter(Boolean);
  return {
    name: 'Membrete heredado',
    paperWidthDefault: 58,
    blocks: (lines.length ? lines : ['TRANSPORTADORA PARAGUAY SAAS']).map((text, index) => ({
      id: `legacy-${index + 1}`,
      type: 'TEXT',
      visible: true,
      order: index + 1,
      alignment: 'CENTER',
      text,
      fontSize: index === 0 ? 18 : 14,
      bold: index === 0,
      marginTop: index === 0 ? 2 : 0,
      marginBottom: 2
    }))
  };
}

function buildHeaderText(template: HeaderTemplate | null, membrete: string, width: number) {
  const safeTemplate = template || legacyHeaderToTemplate(membrete);
  const rows: string[] = [];
  const blocks = [...(safeTemplate.blocks || [])]
    .sort((a, b) => a.order - b.order)
    .filter(block => block.visible !== false);

  blocks.forEach(block => {
    const marginTop = Math.max(0, Math.round(Number(block.marginTop || 0) / 12));
    const marginBottom = Math.max(0, Math.round(Number(block.marginBottom || 0) / 12));
    for (let i = 0; i < marginTop; i++) rows.push('');

    if (block.type === 'TEXT' && block.text) {
      String(block.text).split(/\r?\n/).forEach(textLine => {
        rows.push(alignText(textLine.trim(), width, block.alignment || 'CENTER'));
      });
    } else if (block.type === 'SEPARATOR') {
      rows.push(line(width));
    } else if (block.type === 'SPACER') {
      const spacerLines = Math.max(1, Math.round(Number(block.height || 12) / 12));
      for (let i = 0; i < spacerLines; i++) rows.push('');
    }

    for (let i = 0; i < marginBottom; i++) rows.push('');
  });

  return rows.filter((row, index, all) => row.trim() || index < all.length - 1).join('\n');
}

function resolveHeaderImageUrl(value?: string) {
  const url = String(value || '').trim();
  if (!url) return '';
  if (/^(data:|https?:\/\/)/i.test(url)) return url;
  if (url.startsWith('/')) return getApiUrl().replace(/\/api$/, '') + url;
  return url;
}

function buildHeaderHtml(template: HeaderTemplate | null, membrete: string, paperWidth: 58 | 80) {
  const safeTemplate = template || legacyHeaderToTemplate(membrete);
  const blocks = [...(safeTemplate.blocks || [])].sort((a, b) => a.order - b.order).filter(block => block.visible !== false);
  const width = paperPixels(paperWidth);
  const logoMaxPercent = paperWidth === 80 ? 56 : 60;
  const htmlBlocks = blocks.map(block => {
    const align = (block.alignment || 'CENTER').toLowerCase();
    const mt = Math.max(0, Number(block.marginTop || 0));
    const mb = Math.max(0, Number(block.marginBottom || 0));
    if (block.type === 'LOGO') {
      if (!block.imageUrl) return '';
      const imageUrl = resolveHeaderImageUrl(block.imageUrl);
      const logoPercent = Math.max(10, Math.min(logoMaxPercent, Number(block.widthPercent || 55)));
      const logoMaxPx = Math.round(width * logoMaxPercent / 100);
      return `<div style="text-align:${align};margin:${mt}px 0 ${mb}px;"><img src="${escapeHtml(imageUrl)}" style="width:${logoPercent}%;max-width:${logoMaxPx}px;height:auto;display:inline-block;object-fit:contain;" /></div>`;
    }
    if (block.type === 'SEPARATOR') return `<div style="border-top:1px dashed #000;margin:${mt}px 0 ${mb}px;"></div>`;
    if (block.type === 'SPACER') return `<div style="height:${Math.max(1, Number(block.height || 12))}px;"></div>`;
    return `<div style="text-align:${align};font-size:${Math.max(8, Number(block.fontSize || 14))}px;font-weight:${block.bold ? 800 : 500};line-height:1.15;margin:${mt}px 0 ${mb}px;overflow-wrap:anywhere;">${escapeHtml(block.text || '')}</div>`;
  }).join('');
  return `<div style="width:${width}px;background:#fff;color:#000;font-family:Arial,sans-serif;padding:0 8px 4px;box-sizing:border-box;overflow:hidden;">${htmlBlocks}</div>`;
}

function HeaderPreview({ template, membrete, paperWidth }: { template: HeaderTemplate | null; membrete: string; paperWidth: 58 | 80 }) {
  const html = buildHeaderHtml(template, membrete, paperWidth);
  const sourceWidth = paperPixels(paperWidth);
  const previewWidth = paperWidth === 80 ? 230 : 210;
  const scale = previewWidth / sourceWidth;
  return (
    <div data-print-header-preview style={{ width: previewWidth, maxWidth: '100%', margin: 0, overflow: 'hidden', background: '#fff' }}>
      <div
        style={{ width: sourceWidth, zoom: scale } as any}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}

type ReceiptType = 'retiro' | 'entrega' | 'fallida' | 'comanda';

async function assetToDataUrl(url: string) {
  const response = await fetch(url);
  const blob = await response.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('No se pudo cargar la imagen de prueba'));
    reader.readAsDataURL(blob);
  });
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = document.createElement('img');
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('No se pudo cargar la imagen del membrete'));
    image.src = src;
  });
}

async function renderHeaderBitmapDataUrl(template: HeaderTemplate | null, membrete: string, paperWidth: 58 | 80) {
  const safeTemplate = template || legacyHeaderToTemplate(membrete);
  const blocks = [...(safeTemplate.blocks || [])]
    .sort((a, b) => a.order - b.order)
    .filter(block => block.visible !== false);
  if (!blocks.length) return '';

  const width = paperPixels(paperWidth);
  const logoMaxPercent = paperWidth === 80 ? 56 : 60;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = 1400;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#000';
  ctx.textBaseline = 'top';

  let y = 0;
  const alignX = (alignment: Alignment, blockWidth = width) => {
    if (alignment === 'LEFT') return 8;
    if (alignment === 'RIGHT') return width - blockWidth - 8;
    return Math.round((width - blockWidth) / 2);
  };

  for (const block of blocks) {
    const alignment = block.alignment || 'CENTER';
    y += Math.max(0, Number(block.marginTop || 0));

    if (block.type === 'LOGO' && block.imageUrl) {
      const imageUrl = resolveHeaderImageUrl(block.imageUrl);
      const imageDataUrl = imageUrl.startsWith('data:') ? imageUrl : await assetToDataUrl(imageUrl);
      const image = await loadImage(imageDataUrl);
      const logoPercent = Math.max(10, Math.min(logoMaxPercent, Number(block.widthPercent || 55)));
      const drawWidth = Math.max(1, Math.round(width * logoPercent / 100));
      const drawHeight = Math.max(1, Math.round(image.height * drawWidth / Math.max(1, image.width)));
      ctx.drawImage(image, alignX(alignment, drawWidth), y, drawWidth, drawHeight);
      y += drawHeight;
    } else if (block.type === 'TEXT' && block.text) {
      const fontSize = Math.max(8, Number(block.fontSize || 14));
      const lineHeight = Math.ceil(fontSize * 1.2);
      ctx.font = `${block.bold ? 800 : 500} ${fontSize}px Arial, sans-serif`;
      ctx.fillStyle = '#000';
      ctx.textAlign = alignment === 'LEFT' ? 'left' : alignment === 'RIGHT' ? 'right' : 'center';
      const x = alignment === 'LEFT' ? 8 : alignment === 'RIGHT' ? width - 8 : Math.round(width / 2);
      String(block.text).split(/\r?\n/).forEach(textLine => {
        ctx.fillText(textLine.trim(), x, y);
        y += lineHeight;
      });
    } else if (block.type === 'SEPARATOR') {
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(8, y + 2);
      ctx.lineTo(width - 8, y + 2);
      ctx.stroke();
      ctx.setLineDash([]);
      y += 5;
    } else if (block.type === 'SPACER') {
      y += Math.max(1, Number(block.height || 12));
    }

    y += Math.max(0, Number(block.marginBottom || 0));
  }

  const finalHeight = Math.max(1, Math.min(canvas.height, Math.ceil(y + 4)));
  const finalCanvas = document.createElement('canvas');
  finalCanvas.width = width;
  finalCanvas.height = finalHeight;
  const finalCtx = finalCanvas.getContext('2d');
  if (!finalCtx) return '';
  finalCtx.fillStyle = '#fff';
  finalCtx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);
  finalCtx.drawImage(canvas, 0, 0);
  return finalCanvas.toDataURL('image/png');
}

type LocalQueueEvent = {
  idempotency_key: string;
  tipo_evento: string;
  viaje_id?: number;
  parada_id?: number;
  pedido_id?: number;
  payload: any;
  latitud?: number | null;
  longitud?: number | null;
  created_at: string;
};

type TrackingQueueItem = {
  idempotency_key: string;
  viaje_id?: number | null;
  vehiculo_id?: number | null;
  chofer_id?: number | string | null;
  latitud: number;
  longitud: number;
  timestamp: string;
};

type RoutePoint = {
  label: string;
  tipo?: string;
  direccion?: string;
  latitud?: any;
  longitud?: any;
};

function queueKey(choferId: string) {
  return `repartoLocalQueue:${choferId}`;
}

function trackingQueueKey(choferId: string) {
  return `trackingQueue:${choferId}`;
}

function cacheKey(choferId: string) {
  return `repartosLocalCache:${choferId}`;
}

function jobSignature(items: any[]) {
  return JSON.stringify((Array.isArray(items) ? items : []).map(item => ({
    id: item.id,
    estado: item.estado,
    total: item.total_paradas ?? item.paradas_total ?? 0,
    completadas: item.completadas ?? item.paradas_completadas ?? 0,
    fallidas: item.fallidas ?? item.paradas_fallidas ?? 0,
    updated: item.updated_at || item.fecha_modificacion || item.progreso_json || ''
  })));
}

function localDetailSignature(detail: any) {
  return JSON.stringify({
    estado: detail?.viaje?.estado,
    avance: detail?.avance,
    paradas: (detail?.paradas || []).map((stop: any) => ({
      id: stop.id,
      orden: stop.orden,
      estado: stop.estado,
      tipo: stop.tipo_parada,
      llegada: stop.llegada_real,
      salida: stop.salida_real
    }))
  });
}

function loadQueue(choferId: string): LocalQueueEvent[] {
  try {
    return JSON.parse(localStorage.getItem(queueKey(choferId)) || '[]');
  } catch {
    return [];
  }
}

function saveQueue(choferId: string, queue: LocalQueueEvent[]) {
  localStorage.setItem(queueKey(choferId), JSON.stringify(queue));
}

function isNetworkLikeError(err: any) {
  const message = String(err?.message || err || '').toLowerCase();
  return !navigator.onLine
    || err?.name === 'TypeError'
    || message.includes('failed to fetch')
    || message.includes('networkerror')
    || message.includes('load failed');
}

function loadTrackingQueue(choferId: string): TrackingQueueItem[] {
  try {
    return JSON.parse(localStorage.getItem(trackingQueueKey(choferId)) || '[]');
  } catch {
    return [];
  }
}

function saveTrackingQueue(choferId: string, queue: TrackingQueueItem[]) {
  localStorage.setItem(trackingQueueKey(choferId), JSON.stringify(queue));
}

function idempotencyKey(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function currentGps() {
  try {
    const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 6000 });
    return { latitud: pos.coords.latitude, longitud: pos.coords.longitude };
  } catch {
    return { latitud: null, longitud: null };
  }
}

function routeNumber(value: any) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function hasRouteCoords(point: RoutePoint) {
  return routeNumber(point.latitud) !== null && routeNumber(point.longitud) !== null;
}

function routeQuery(point: RoutePoint) {
  return `${Number(point.latitud)},${Number(point.longitud)}`;
}

function googleMapsDirectionsUrl(points: RoutePoint[]) {
  const withCoords = points.filter(hasRouteCoords);
  if (!withCoords.length) return '';
  const destination = routeQuery(withCoords[withCoords.length - 1]);
  const middle = withCoords.slice(0, -1).slice(0, 8);
  const params = new URLSearchParams({ api: '1', destination, travelmode: 'driving' });
  if (middle.length) params.set('waypoints', middle.map(routeQuery).join('|'));
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

function pointNavigationUrl(point: RoutePoint, app: 'maps' | 'waze', native = false) {
  if (!hasRouteCoords(point)) return '';
  const lat = Number(point.latitud);
  const lng = Number(point.longitud);
  if (native && app === 'maps') return `google.navigation:q=${lat},${lng}&mode=d`;
  if (native && app === 'waze') return `waze://?ll=${lat},${lng}&navigate=yes`;
  return app === 'waze'
    ? `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`
    : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
}

async function openExternalUrl(url: string, fallbackUrl = url) {
  if (Capacitor.isNativePlatform()) {
    try {
      await ExternalLauncher.openUrl({ url });
      return;
    } catch (err) {
      console.warn('No se pudo abrir con ExternalLauncher, usando fallback web', err);
      if (fallbackUrl !== url) {
        try {
          await ExternalLauncher.openUrl({ url: fallbackUrl });
          return;
        } catch (fallbackErr) {
          console.warn('No se pudo abrir fallback de mapa', fallbackErr);
        }
      }
    }
  }
  const opened = window.open(fallbackUrl, '_blank', 'noopener,noreferrer');
  if (!opened) window.location.href = fallbackUrl;
}

async function openRouteNavigation(points: RoutePoint[]) {
  const withCoords = points.filter(hasRouteCoords);
  if (!withCoords.length) return alert('La ruta no tiene coordenadas cargadas.');
  const url = googleMapsDirectionsUrl(withCoords);
  if (withCoords.length > 10) alert('Google Maps por enlace acepta una cantidad limitada de paradas; se abrira la ruta con las primeras paradas y el destino final.');
  await openExternalUrl(url);
}

async function openPointNavigation(point: RoutePoint, app: 'maps' | 'waze') {
  const webUrl = pointNavigationUrl(point, app);
  if (!webUrl) return alert('Esta parada no tiene coordenadas.');
  const nativeUrl = pointNavigationUrl(point, app, true);
  await openExternalUrl(nativeUrl || webUrl, webUrl);
}

function localRoutePoints(paradas: any[]): RoutePoint[] {
  return (Array.isArray(paradas) ? paradas : [])
    .slice()
    .sort((a, b) => Number(a.orden || 0) - Number(b.orden || 0))
    .map((parada, index) => ({
      label: `#${parada.orden || index + 1} ${String(parada.tipo_parada || 'Parada').replace('_', ' ')}`,
      tipo: parada.tipo_parada,
      direccion: parada.direccion,
      latitud: parada.latitud,
      longitud: parada.longitud
    }));
}

function interurbanRoutePoints(viaje: any): RoutePoint[] {
  const points: RoutePoint[] = [];
  if (routeNumber(viaje?.sucursal_origen_latitud) !== null && routeNumber(viaje?.sucursal_origen_longitud) !== null) {
    points.push({
      label: `Salida: ${viaje.sucursal_origen_nombre || 'Sucursal origen'}`,
      tipo: 'SALIDA',
      direccion: viaje.sucursal_origen_direccion,
      latitud: viaje.sucursal_origen_latitud,
      longitud: viaje.sucursal_origen_longitud
    });
  }

  (Array.isArray(viaje?.pedidos) ? viaje.pedidos : []).forEach((pedido: any) => {
    if (routeNumber(pedido.latitud_retiro) !== null && routeNumber(pedido.longitud_retiro) !== null) {
      points.push({
        label: `Retiro ${pedido.numero_guia || pedido.id}`,
        tipo: 'RETIRO',
        direccion: pedido.remitente_direccion || pedido.sucursal_origen_nombre,
        latitud: pedido.latitud_retiro,
        longitud: pedido.longitud_retiro
      });
    }
    const entregaLat = routeNumber(pedido.latitud_entrega) !== null ? pedido.latitud_entrega : pedido.sucursal_destino_latitud;
    const entregaLng = routeNumber(pedido.longitud_entrega) !== null ? pedido.longitud_entrega : pedido.sucursal_destino_longitud;
    if (routeNumber(entregaLat) !== null && routeNumber(entregaLng) !== null) {
      points.push({
        label: `Entrega ${pedido.numero_guia || pedido.id}`,
        tipo: 'ENTREGA',
        direccion: pedido.destinatario_direccion || pedido.sucursal_destino_nombre,
        latitud: entregaLat,
        longitud: entregaLng
      });
    }
  });

  if (routeNumber(viaje?.sucursal_destino_latitud) !== null && routeNumber(viaje?.sucursal_destino_longitud) !== null) {
    const last = points[points.length - 1];
    if (!last || Number(last.latitud) !== Number(viaje.sucursal_destino_latitud) || Number(last.longitud) !== Number(viaje.sucursal_destino_longitud)) {
      points.push({
        label: `Destino: ${viaje.sucursal_destino_nombre || 'Sucursal destino'}`,
        tipo: 'DESTINO',
        direccion: viaje.sucursal_destino_direccion,
        latitud: viaje.sucursal_destino_latitud,
        longitud: viaje.sucursal_destino_longitud
      });
    }
  }

  return points;
}

function buildReceiptText(pedido: any, config: TicketConfig, tipo: ReceiptType, includeHeader = true) {
  const enabled = { ...defaultTicketFields, ...(config.fields || {}) };
  const width = Math.max(24, Number(config.width || 32));
  const values: Record<string, any> = {
    ...pedido,
    fecha: new Date().toLocaleString('es-PY'),
    peso: pedido.peso ? `${pedido.peso}` : '',
    volumen: pedido.volumen ? `${pedido.volumen}` : '',
    precio: pedido.precio ? money(pedido.precio) : '',
    valor_declarado: pedido.valor_declarado ? money(pedido.valor_declarado) : ''
  };

  const headerText = includeHeader ? buildHeaderText(config.headerTemplate, config.membrete, width) : '';
  const rows = [
    ...(headerText ? [headerText, ''] : []),
    alignText(tipo === 'retiro' ? 'COMPROBANTE DE RETIRO' : tipo === 'entrega' ? 'COMPROBANTE DE ENTREGA' : tipo === 'fallida' ? 'VISITA FALLIDA' : 'COMANDA', width, 'CENTER'),
    line(width)
  ];

  Object.keys(fieldLabels).forEach(key => {
    if (enabled[key] && values[key]) rows.push(`${fieldLabels[key]}: ${String(values[key])}`);
  });

  rows.push(line(width));
  if (tipo === 'retiro') {
    rows.push('Recibimos los bultos indicados para su transporte.', '', 'Firma cliente:', '', line(width));
  } else if (tipo === 'entrega') {
    rows.push('Mercaderia entregada al recibidor indicado.', '', 'Firma recibidor:', '', line(width));
  } else if (tipo === 'fallida') {
    rows.push('La visita no pudo completarse. Queda registro operativo.', '', line(width));
  }
  return rows.join('\n');
}

function buildReceiptHtml(pedido: any, config: TicketConfig, tipo: ReceiptType) {
  const enabled = { ...defaultTicketFields, ...(config.fields || {}) };

  // HTML del membrete con estilos para impresiÃ³n tÃ©rmica
  let html = config.membrete || '';

  // Agregar el resto del ticket como HTML
  html += '<div style="text-align: center; font-weight: bold; margin: 10px 0;">';
  html += tipo === 'retiro' ? 'COMPROBANTE DE RETIRO' : tipo === 'entrega' ? 'COMPROBANTE DE ENTREGA' : tipo === 'fallida' ? 'VISITA FALLIDA' : 'COMANDA';
  html += '</div>';

  html += '<hr style="border: none; border-top: 1px dashed #000; margin: 5px 0;">';

  const values: Record<string, any> = {
    ...pedido,
    fecha: new Date().toLocaleString('es-PY'),
    peso: pedido.peso ? `${pedido.peso}` : '',
    volumen: pedido.volumen ? `${pedido.volumen}` : '',
    precio: pedido.precio ? money(pedido.precio) : '',
    valor_declarado: pedido.valor_declarado ? money(pedido.valor_declarado) : ''
  };

  Object.keys(fieldLabels).forEach(key => {
    if (enabled[key] && values[key]) {
      html += `<div><strong>${fieldLabels[key]}:</strong> ${String(values[key])}</div>`;
    }
  });

  html += '<hr style="border: none; border-top: 1px dashed #000; margin: 5px 0;">';

  if (tipo === 'retiro') {
    html += '<p>Recibimos los bultos indicados para su transporte.</p>';
    html += '<p><strong>Firma cliente:</strong></p>';
    html += '<div style="border-bottom: 1px solid #000; width: 100%; margin: 20px 0;"></div>';
  }

  return html;
}

function Login({ onLogin, otaStatus, onOtaReload, onOtaCheck, onNativeUpdate }: {
  onLogin: (session: DriverSession) => void;
  otaStatus: OtaStatus;
  onOtaReload: () => void;
  onOtaCheck: () => void;
  onNativeUpdate: (url?: string) => void;
}) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [apiUrl, setApiUrl] = useState(getApiUrl());
  const [showSettings, setShowSettings] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const normalizedApiUrl = normalizeApiUrl(apiUrl);
      localStorage.setItem('choferApiUrl', normalizedApiUrl);
      const response = await fetch(`${normalizedApiUrl}/chofer/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'No se pudo iniciar sesion');
      onLogin({
        token: data.token,
        refreshToken: data.refreshToken,
        choferId: data.chofer.id ? String(data.chofer.id) : 'null',
        choferNombre: data.chofer.nombre
      });
    } catch (err: any) {
      const isNetworkError = err instanceof TypeError || String(err.message || '').includes('Failed to fetch');
      setError(isNetworkError ? 'No se pudo conectar con el servidor' : err.message || 'Credenciales invalidas');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container">
      <div className="header">App Chofer
        <VersionIndicator otaStatus={otaStatus} />
      </div>
      <div className="content" style={{ justifyContent: 'center' }}>
        <OtaUpdateBanner status={otaStatus} onReload={onOtaReload} onCheck={onOtaCheck} onNativeUpdate={onNativeUpdate} />
        <form className="card" onSubmit={handleSubmit}>
          <div className="text-lg" style={{ textAlign: 'center', marginBottom: '1rem' }}>
            <Truck size={48} style={{ margin: '0 auto', color: 'var(--primary-color)' }} />
            <br />Ingresar al sistema
          </div>
          <button
            className="btn btn-outline"
            type="button"
            style={{ width: '100%', marginBottom: '1rem' }}
            onClick={() => setShowSettings(!showSettings)}
          >
            <Settings size={18} /> Servidor
          </button>
          {showSettings && (
            <div className="form-group">
              <label>URL API</label>
              <input
                className="input"
                value={apiUrl}
                onChange={e => setApiUrl(e.target.value)}
                placeholder="http://192.168.3.45:3001/api"
                required
              />
            </div>
          )}
          <div className="form-group">
            <label>Usuario</label>
            <input className="input" value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" required />
          </div>
          <div className="form-group">
            <label>Contraseña</label>
            <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required />
          </div>
          {error && <div className="error-box">{error}</div>}
          <button className="btn" type="submit" disabled={loading}>{loading ? 'Ingresando...' : 'Ingresar'}</button>
        </form>
      </div>
    </div>
  );
}

function SignaturePad({ onSave }: { onSave: (sig: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const getCoordinates = (e: any) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
    const clientY = e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const startDrawing = (e: any) => {
    const { x, y } = getCoordinates(e);
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: any) => {
    if (!isDrawing) return;
    const { x, y } = getCoordinates(e);
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => setIsDrawing(false);

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  return (
    <div style={{ border: '1px solid #e5e7eb', background: '#fff', borderRadius: '4px', padding: '0.5rem' }}>
      <canvas
        ref={canvasRef}
        width={280}
        height={150}
        style={{ border: '1px dashed #ccc', cursor: 'crosshair', touchAction: 'none', width: '100%' }}
        onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing}
        onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem' }}>
        <button className="btn btn-outline" style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }} onClick={clear}>Limpiar</button>
        <button className="btn" style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }} onClick={() => onSave(canvasRef.current?.toDataURL() || '')}>Guardar Firma</button>
      </div>
    </div>
  );
}

function GastosModal({ choferId, viajeId, onClose, onSave }: { choferId: string, viajeId: number, onClose: () => void, onSave: () => void }) {
  const [tipoGasto, setTipoGasto] = useState('combustible');
  const [monto, setMonto] = useState<number | ''>('');
  const [foto, setFoto] = useState<string>('');

  const handleCapturePhoto = async () => {
    try {
      const image = await Camera.getPhoto({
        quality: 60,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera
      });
      if (image.dataUrl) setFoto(image.dataUrl);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSave = () => {
    if (!monto || Number(monto) <= 0) return alert('Ingrese un monto vÃ¡lido');
    fetch(`${getApiUrl()}/caja/gastos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({
        chofer_id: Number(choferId),
        viaje_id: viajeId,
        tipo_gasto: tipoGasto,
        monto: Number(monto),
        fecha: new Date().toISOString(),
        comprobante_url: foto,
      })
    }).then(() => {
      alert('Gasto registrado con Ã©xito');
      onSave();
      onClose();
    }).catch(e => {
      alert('Error al guardar: ' + e.message);
    });
  };

  return (
    <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
      <div className="card" style={{ width: '100%', maxWidth: '400px', maxHeight: '90vh', overflowY: 'auto', background: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <DollarSign size={20} /> Registrar Gasto
          </h3>
          <X size={24} onClick={onClose} style={{ cursor: 'pointer', color: '#6b7280' }} />
        </div>
        
        <div className="form-group">
          <label>Tipo de Gasto</label>
          <select className="select" value={tipoGasto} onChange={(e) => setTipoGasto(e.target.value)}>
            <option value="combustible">Combustible</option>
            <option value="peaje">Peaje</option>
            <option value="viatico">ViÃ¡tico</option>
            <option value="mantenimiento">Mantenimiento</option>
            <option value="otro">Otro</option>
          </select>
        </div>

        <div className="form-group">
          <label>Monto</label>
          <input type="number" className="input" value={monto} onChange={e => setMonto(Number(e.target.value))} />
        </div>

        <div className="form-group">
          <label>Comprobante</label>
          {foto ? (
            <div style={{ textAlign: 'center' }}>
              <img src={foto} alt="Comprobante" style={{ width: '100%', maxHeight: '150px', objectFit: 'contain', border: '1px solid #e5e7eb', borderRadius: '4px' }} />
              <button className="btn btn-outline" style={{ marginTop: '0.5rem', width: '100%' }} onClick={() => setFoto('')}>Re-tomar foto</button>
            </div>
          ) : (
            <button className="btn btn-outline" style={{ width: '100%', display: 'flex', justifyContent: 'center', gap: '0.5rem' }} onClick={handleCapturePhoto}>
              <CameraIcon size={18} /> Sacar Foto
            </button>
          )}
        </div>

        <button className="btn" style={{ width: '100%', marginTop: '1rem' }} onClick={handleSave}>Guardar Gasto</button>
      </div>
    </div>
  );
}

function PODModal({ pedido, onClose, onSave }: { pedido: any, onClose: () => void, onSave: (data: any) => void }) {
  const [estado, setEstado] = useState<string>('entregado');
  const [motivo, setMotivo] = useState<string>('');
  const [foto, setFoto] = useState<string>('');
  const [firma, setFirma] = useState<string>('');
  const [observaciones, setObservaciones] = useState('');
  const [bultos, setBultos] = useState<number>(pedido.cantidad_bultos || 1);
  const [precio, setPrecio] = useState<string>(pedido.precio ? String(pedido.precio) : '');
  const [tipoPago, setTipoPago] = useState<string>(pedido.tipo_pago || 'contado');
  const [montoCobrado, setMontoCobrado] = useState<string>('');

  const handleCapturePhoto = async () => {
    try {
      const image = await Camera.getPhoto({
        quality: 60,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera
      });
      if (image.dataUrl) setFoto(image.dataUrl);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
      <div className="card" style={{ width: '100%', maxWidth: '400px', maxHeight: '90vh', overflowY: 'auto', background: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.2rem' }}>POD - {pedido.numero_guia}</h3>
          <X size={24} onClick={onClose} style={{ cursor: 'pointer', color: '#6b7280' }} />
        </div>
        
        <div className="form-group">
          <label>Estado del Pedido</label>
          <select className="select" value={estado} onChange={(e) => setEstado(e.target.value)}>
            <option value="entregado">Entregado</option>
            <option value="recolectado">Recolectado</option>
            <option value="devuelto">Devuelto</option>
          </select>
        </div>

        {estado === 'devuelto' && (
          <div className="form-group">
            <label>Motivo de DevoluciÃ³n</label>
            <input type="text" className="input" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Especifique el motivo..." />
          </div>
        )}

        <div className="form-group">
          <label>Bultos (Levantados/Entregados)</label>
          <input type="number" className="input" value={bultos} onChange={e => setBultos(Number(e.target.value))} />
        </div>

        {estado === 'recolectado' && (
          <>
            <div className="form-group">
              <label>Precio/costo del envio</label>
              <input type="number" className="input" value={precio} onChange={e => setPrecio(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Tipo de pago</label>
              <select className="select" value={tipoPago} onChange={e => setTipoPago(e.target.value)}>
                <option value="contado">Contado</option>
                <option value="cobrar_destinatario">Cobrar al destinatario</option>
                <option value="cuenta_corriente">Cuenta corriente</option>
                <option value="pagado">Pagado</option>
                <option value="otro">Otro</option>
              </select>
            </div>
            <div className="form-group">
              <label>Monto cobrado</label>
              <input type="number" className="input" value={montoCobrado} onChange={e => setMontoCobrado(e.target.value)} />
            </div>
          </>
        )}

        <div className="form-group">
          <label>Foto Comprobante</label>
          {foto ? (
            <div style={{ textAlign: 'center' }}>
              <img src={foto} alt="POD" style={{ width: '100%', maxHeight: '150px', objectFit: 'contain', border: '1px solid #e5e7eb', borderRadius: '4px' }} />
              <button className="btn btn-outline" style={{ marginTop: '0.5rem', width: '100%' }} onClick={() => setFoto('')}>Re-tomar foto</button>
            </div>
          ) : (
            <button className="btn btn-outline" style={{ width: '100%', display: 'flex', justifyContent: 'center', gap: '0.5rem' }} onClick={handleCapturePhoto}>
              <CameraIcon size={18} /> Sacar Foto
            </button>
          )}
        </div>

        <div className="form-group">
          <label>Registrar Firma</label>
          {firma ? (
            <div style={{ textAlign: 'center' }}>
              <img src={firma} alt="Firma" style={{ border: '1px solid #e5e7eb', width: '100%', maxHeight: '100px', objectFit: 'contain', background: '#fff', borderRadius: '4px' }} />
              <button className="btn btn-outline" style={{ marginTop: '0.5rem', width: '100%' }} onClick={() => setFirma('')}>Re-firmar</button>
            </div>
          ) : (
            <SignaturePad onSave={setFirma} />
          )}
        </div>

        <div className="form-group">
          <label>Observaciones</label>
          <textarea className="input" value={observaciones} onChange={e => setObservaciones(e.target.value)} rows={3} placeholder="Notas adicionales..."></textarea>
        </div>

        <button className="btn" style={{ width: '100%', marginTop: '1rem', display: 'flex', justifyContent: 'center', gap: '0.5rem' }} 
                onClick={() => onSave({ estado, motivo_devolucion: motivo, foto_pod: foto, firma_pod: firma, observaciones, bultos_reales: bultos, precio, tipo_pago: tipoPago, monto_cobrado: montoCobrado })}>
          <CheckCircle size={18} /> Confirmar GestiÃ³n
        </button>
      </div>
    </div>
  );
}

function IncidenciaModal({ onClose, onSave }: { onClose: () => void, onSave: (nota: string) => void }) {
  const [nota, setNota] = useState('');
  return (
    <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
      <div className="card" style={{ width: '100%', maxWidth: '400px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertTriangle size={20} /> Reportar Incidencia
          </h3>
          <X size={24} onClick={onClose} style={{ cursor: 'pointer', color: '#6b7280' }} />
        </div>
        <textarea className="input" value={nota} onChange={e => setNota(e.target.value)} rows={4} placeholder="Describa la incidencia o motivo de retraso..."></textarea>
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
          <button className="btn btn-outline" style={{ flex: 1 }} onClick={onClose}>Cancelar</button>
          <button className="btn" style={{ flex: 1, background: '#ef4444', color: 'white', borderColor: '#ef4444' }} onClick={() => onSave(nota)}>Confirmar Reporte</button>
        </div>
      </div>
    </div>
  );
}

function LocalStopModal({
  parada,
  action,
  onClose,
  onSave
}: {
  parada: any;
  action: 'retiro' | 'entrega' | 'fallida' | 'reprogramar';
  onClose: () => void;
  onSave: (data: any) => void;
}) {
  const pedido = parada.pedido || parada;
  const [form, setForm] = useState({
    remitente_nombre: pedido.remitente_nombre || parada.nombre_contacto || '',
    remitente_doc: pedido.remitente_doc || parada.documento_contacto || '',
    remitente_tel: pedido.remitente_tel || parada.telefono_contacto || '',
    remitente_direccion: pedido.remitente_direccion || parada.direccion || '',
    destinatario_nombre: pedido.destinatario_nombre || '',
    destinatario_doc: pedido.destinatario_doc || '',
    destinatario_tel: pedido.destinatario_tel || '',
    destinatario_direccion: pedido.destinatario_direccion || '',
    recibidor_nombre: '',
    recibidor_doc: '',
    recibidor_tel: '',
    cantidad_bultos: pedido.cantidad_bultos || 1,
    bultos_entregados: pedido.cantidad_bultos || 1,
    peso: pedido.peso || '',
    tipo_carga: pedido.tipo_carga || '',
    valor_declarado: pedido.valor_declarado || '',
    precio: pedido.precio || '',
    tipo_pago: pedido.tipo_pago || 'contado',
    monto_cobrado: '',
    observacion_pago: '',
    latitud_entrega: pedido.latitud_entrega || '',
    longitud_entrega: pedido.longitud_entrega || '',
    referencia_entrega: '',
    destino_operativo: pedido.destino_operativo || 'procesar_sucursal',
    sucursal_destino_nombre: pedido.sucursal_destino_nombre || '',
    modalidad_entrega: pedido.modalidad_entrega || 'sucursal',
    motivo: 'no_estaba_cliente',
    ventana_inicio: '',
    ventana_fin: '',
    observaciones: ''
  });
  const [foto, setFoto] = useState('');
  const [firma, setFirma] = useState('');

  const takePhoto = async () => {
    try {
      const image = await Camera.getPhoto({ quality: 55, allowEditing: false, resultType: CameraResultType.DataUrl, source: CameraSource.Camera });
      setFoto(image.dataUrl || '');
    } catch (err: any) {
      alert(`No se pudo tomar foto: ${err.message || err}`);
    }
  };

  const useCurrentDeliveryPoint = async () => {
    try {
      const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 7000 });
      setForm({
        ...form,
        latitud_entrega: String(pos.coords.latitude),
        longitud_entrega: String(pos.coords.longitude)
      });
    } catch (err: any) {
      alert(`No se pudo obtener ubicacion: ${err.message || err}`);
    }
  };

  const submit = () => {
    if (action === 'retiro' && (!form.remitente_nombre || !form.destinatario_nombre || !form.tipo_carga || !form.cantidad_bultos)) {
      alert('Complete remitente, destinatario, tipo de carga y bultos.');
      return;
    }
    if (action === 'retiro' && form.destino_operativo === 'traslado_sucursal' && !form.sucursal_destino_nombre) {
      alert('Ingrese la sucursal destino del traslado.');
      return;
    }
    if (action === 'entrega' && (!form.recibidor_nombre || !form.recibidor_doc)) {
      alert('Ingrese nombre y documento del recibidor.');
      return;
    }
    if (action === 'fallida' && !form.motivo) {
      alert('Seleccione motivo de visita fallida.');
      return;
    }
    if (action === 'retiro' && form.precio !== '' && !Number.isFinite(Number(form.precio))) {
      alert('El precio/costo debe ser numerico.');
      return;
    }
    if (action === 'retiro' && form.monto_cobrado !== '' && !Number.isFinite(Number(form.monto_cobrado))) {
      alert('El monto cobrado debe ser numerico.');
      return;
    }
    if (action === 'reprogramar' && !form.ventana_inicio && !form.ventana_fin && !form.observaciones) {
      alert('Ingrese nueva ventana horaria u observacion.');
      return;
    }
    onSave({ ...form, foto, firma, estado: action === 'entrega' ? 'entregado' : undefined });
  };

  return (
    <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
      <div className="card" style={{ width: '100%', maxWidth: '460px', maxHeight: '92vh', overflowY: 'auto', background: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>{action === 'retiro' ? 'Registrar retiro' : action === 'entrega' ? 'Registrar entrega' : action === 'reprogramar' ? 'Reprogramar parada' : 'Registrar visita fallida'}</h3>
          <X size={24} onClick={onClose} style={{ cursor: 'pointer', color: '#6b7280' }} />
        </div>

        {action === 'retiro' && (
          <>
            <div className="form-group"><label>Remitente</label><input className="input" value={form.remitente_nombre} onChange={e => setForm({ ...form, remitente_nombre: e.target.value })} /></div>
            <div className="form-group"><label>Doc. remitente</label><input className="input" value={form.remitente_doc} onChange={e => setForm({ ...form, remitente_doc: e.target.value })} /></div>
            <div className="form-group"><label>Tel. remitente</label><input className="input" value={form.remitente_tel} onChange={e => setForm({ ...form, remitente_tel: e.target.value })} /></div>
            <div className="form-group"><label>Destinatario</label><input className="input" value={form.destinatario_nombre} onChange={e => setForm({ ...form, destinatario_nombre: e.target.value })} /></div>
            <div className="form-group"><label>Doc. destinatario</label><input className="input" value={form.destinatario_doc} onChange={e => setForm({ ...form, destinatario_doc: e.target.value })} /></div>
            <div className="form-group"><label>Tel. destinatario</label><input className="input" value={form.destinatario_tel} onChange={e => setForm({ ...form, destinatario_tel: e.target.value })} /></div>
            <div className="form-group"><label>Direccion destino</label><input className="input" value={form.destinatario_direccion} onChange={e => setForm({ ...form, destinatario_direccion: e.target.value })} /></div>
            <div className="form-group">
              <label>Que hacer con el retiro</label>
              <select className="select" value={form.destino_operativo} onChange={e => setForm({ ...form, destino_operativo: e.target.value })}>
                <option value="entrega_inmediata">Entregar en el momento</option>
                <option value="procesar_sucursal">Llevar a sucursal para procesar</option>
                <option value="traslado_sucursal">Enviar a otra sucursal</option>
              </select>
            </div>
            <div className="form-group">
              <label>Modalidad de entrega</label>
              <select className="select" value={form.modalidad_entrega} onChange={e => setForm({ ...form, modalidad_entrega: e.target.value })}>
                <option value="sucursal">Retira en sucursal</option>
                <option value="domicilio">Entrega a domicilio</option>
                <option value="puerta">Entrega en puerta</option>
              </select>
            </div>
            {form.destino_operativo === 'traslado_sucursal' && (
              <div className="form-group"><label>Sucursal destino</label><input className="input" value={form.sucursal_destino_nombre} onChange={e => setForm({ ...form, sucursal_destino_nombre: e.target.value })} /></div>
            )}
            {(form.modalidad_entrega === 'domicilio' || form.modalidad_entrega === 'puerta' || form.destino_operativo === 'entrega_inmediata') && (
              <>
                <div className="form-group"><label>Referencia entrega</label><input className="input" value={form.referencia_entrega} onChange={e => setForm({ ...form, referencia_entrega: e.target.value })} /></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <div className="form-group"><label>Latitud entrega</label><input className="input" value={form.latitud_entrega} onChange={e => setForm({ ...form, latitud_entrega: e.target.value })} /></div>
                  <div className="form-group"><label>Longitud entrega</label><input className="input" value={form.longitud_entrega} onChange={e => setForm({ ...form, longitud_entrega: e.target.value })} /></div>
                </div>
                <button className="btn btn-outline" type="button" onClick={useCurrentDeliveryPoint}>Usar ubicacion actual para entrega</button>
              </>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <div className="form-group"><label>Bultos</label><input className="input" type="number" value={form.cantidad_bultos} onChange={e => setForm({ ...form, cantidad_bultos: Number(e.target.value) })} /></div>
              <div className="form-group"><label>Peso</label><input className="input" type="number" value={form.peso} onChange={e => setForm({ ...form, peso: e.target.value })} /></div>
            </div>
            <div className="form-group"><label>Tipo de carga</label><input className="input" value={form.tipo_carga} onChange={e => setForm({ ...form, tipo_carga: e.target.value })} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <div className="form-group"><label>Precio/costo</label><input className="input" type="number" value={form.precio} onChange={e => setForm({ ...form, precio: e.target.value })} /></div>
              <div className="form-group"><label>Tipo de pago</label><select className="select" value={form.tipo_pago} onChange={e => setForm({ ...form, tipo_pago: e.target.value })}><option value="contado">Contado</option><option value="cobrar_destinatario">Cobrar al destinatario</option><option value="cuenta_corriente">Cuenta corriente</option><option value="pagado">Pagado</option><option value="otro">Otro</option></select></div>
            </div>
            <div className="form-group"><label>Monto cobrado</label><input className="input" type="number" value={form.monto_cobrado} onChange={e => setForm({ ...form, monto_cobrado: e.target.value })} /></div>
            <div className="form-group"><label>Observacion de pago</label><input className="input" value={form.observacion_pago} onChange={e => setForm({ ...form, observacion_pago: e.target.value })} /></div>
          </>
        )}

        {action === 'entrega' && (
          <>
            <div className="text-sm"><strong>Pedido:</strong> {pedido.numero_guia || parada.pedido_id || 'S/N'}</div>
            <div className="text-sm"><strong>Destinatario:</strong> {pedido.destinatario_nombre || parada.nombre_contacto}</div>
            <div className="form-group"><label>Recibidor</label><input className="input" value={form.recibidor_nombre} onChange={e => setForm({ ...form, recibidor_nombre: e.target.value })} /></div>
            <div className="form-group"><label>Documento recibidor</label><input className="input" value={form.recibidor_doc} onChange={e => setForm({ ...form, recibidor_doc: e.target.value })} /></div>
            <div className="form-group"><label>Telefono recibidor</label><input className="input" value={form.recibidor_tel} onChange={e => setForm({ ...form, recibidor_tel: e.target.value })} /></div>
            <div className="form-group"><label>Bultos entregados</label><input className="input" type="number" value={form.bultos_entregados} onChange={e => setForm({ ...form, bultos_entregados: Number(e.target.value) })} /></div>
          </>
        )}

        {action === 'fallida' && (
          <div className="form-group">
            <label>Motivo</label>
            <select className="select" value={form.motivo} onChange={e => setForm({ ...form, motivo: e.target.value })}>
              <option value="no_estaba_cliente">No estaba el cliente</option>
              <option value="direccion_incorrecta">Direccion incorrecta</option>
              <option value="rechazado">Rechazado</option>
              <option value="no_contacto">No se pudo contactar</option>
              <option value="falta_pago">Falta de pago</option>
              <option value="mercaderia_danada">Mercaderia danada</option>
              <option value="otro">Otro</option>
            </select>
          </div>
        )}

        {action === 'reprogramar' && (
          <>
            <div className="text-sm"><strong>Parada:</strong> #{parada.orden} {parada.nombre_contacto || parada.direccion || 'S/N'}</div>
            <div className="form-group"><label>Nueva ventana desde</label><input className="input" type="datetime-local" value={form.ventana_inicio} onChange={e => setForm({ ...form, ventana_inicio: e.target.value })} /></div>
            <div className="form-group"><label>Nueva ventana hasta</label><input className="input" type="datetime-local" value={form.ventana_fin} onChange={e => setForm({ ...form, ventana_fin: e.target.value })} /></div>
          </>
        )}

        <div className="form-group"><label>Observaciones</label><textarea className="input" rows={3} value={form.observaciones} onChange={e => setForm({ ...form, observaciones: e.target.value })} /></div>
        {action !== 'reprogramar' && (
          <>
            <button className="btn btn-outline" onClick={takePhoto}><CameraIcon size={18} /> {foto ? 'Foto tomada' : 'Tomar foto'}</button>
            <SignaturePad onSave={setFirma} />
            {firma && <div className="text-sm" style={{ color: '#047857' }}>Firma capturada</div>}
          </>
        )}
        <button className="btn" onClick={submit}><CheckCircle size={18} /> {action === 'reprogramar' ? 'Guardar reprogramacion' : 'Guardar e imprimir'}</button>
      </div>
    </div>
  );
}

function PrintTicketModal({
  pedido,
  ticketConfig,
  tipo,
  onClose
}: {
  pedido: any;
  ticketConfig: TicketConfig;
  tipo: ReceiptType;
  onClose: () => void;
}) {
  const [devices, setDevices] = useState<BluetoothDevice[]>([]);
  const [selectedAddress, setSelectedAddress] = useState(localStorage.getItem('printerAddress') || '');
  const [copies, setCopies] = useState(ticketConfig.copies || 1);
  const [loading, setLoading] = useState(true);
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    BluetoothPrinter.listBondedPrinters()
      .then(result => {
        setDevices(result.devices || []);
        if (!selectedAddress && result.devices?.[0]) setSelectedAddress(result.devices[0].address);
      })
      .catch((err: any) => alert(`No se pudieron leer impresoras Bluetooth: ${err.message || err}`))
      .finally(() => setLoading(false));
  }, []);

  const handlePrint = async () => {
    if (!selectedAddress) return alert('Seleccione una impresora Bluetooth emparejada');
    setPrinting(true);
    try {
      localStorage.setItem('printerAddress', selectedAddress);
      const paperWidth = ticketConfig.paperWidth || ticketConfig.headerTemplate?.paperWidthDefault || 58;
      const headerHtml = buildHeaderHtml(ticketConfig.headerTemplate, ticketConfig.membrete, paperWidth);
      const headerText = buildHeaderText(ticketConfig.headerTemplate, ticketConfig.membrete, ticketConfig.width || 32);
      const headerBitmapDataUrl = ticketConfig.nativeDemoBitmap
        ? ''
        : await renderHeaderBitmapDataUrl(ticketConfig.headerTemplate, ticketConfig.membrete, paperWidth).catch(() => '');
      await BluetoothPrinter.print({
        address: selectedAddress,
        headerHtml,
        headerText: headerBitmapDataUrl ? '' : headerText,
        headerBitmapDataUrl,
        text: buildReceiptText(pedido, ticketConfig, tipo, false),
        copies: Math.max(1, Number(copies || 1)),
        width: paperPixels(paperWidth),
        demoBitmap: Boolean(ticketConfig.nativeDemoBitmap)
      });
      alert('Ticket impreso correctamente');
      onClose();
    } catch (err: any) {
      alert(`No se pudo imprimir: ${err.message || err}`);
    } finally {
      setPrinting(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
      <div className="card" style={{ width: '100%', maxWidth: '420px', maxHeight: '90vh', overflowY: 'auto', background: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Printer size={20} /> {tipo === 'retiro' ? 'Imprimir retiro' : tipo === 'entrega' ? 'Imprimir entrega' : tipo === 'fallida' ? 'Imprimir visita fallida' : 'Imprimir comanda'}
          </h3>
          <X size={24} onClick={onClose} style={{ cursor: 'pointer', color: '#6b7280' }} />
        </div>

        <div className="form-group">
          <label>Impresora Bluetooth emparejada</label>
          <select className="select" value={selectedAddress} onChange={e => setSelectedAddress(e.target.value)} disabled={loading}>
            <option value="">{loading ? 'Buscando...' : 'Seleccione impresora...'}</option>
            {devices.map(device => (
              <option key={device.address} value={device.address}>{device.name || 'Impresora'} - {device.address}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Cantidad de vias</label>
          <input className="input" type="number" min={1} max={5} value={copies} onChange={e => setCopies(Number(e.target.value))} />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ fontSize: '0.875rem', fontWeight: '500', color: '#374151' }}>Vista previa del ticket</label>
          <div style={{ 
            background: '#f9fafb', 
            border: '1px solid #e5e7eb', 
            borderRadius: '4px', 
            padding: '0.75rem', 
            fontSize: '0.75rem', 
            maxHeight: '220px',
            overflowY: 'auto',
            fontFamily: 'monospace'
          }} data-legacy-preview-size={buildReceiptHtml(pedido, ticketConfig, tipo).length}>
            <HeaderPreview template={ticketConfig.headerTemplate} membrete={ticketConfig.membrete} paperWidth={ticketConfig.paperWidth || 58} />
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>{buildReceiptText(pedido, ticketConfig, tipo)}</pre>
          </div>
        </div>

        <button className="btn" style={{ width: '100%', justifyContent: 'center', marginTop: '1rem' }} onClick={handlePrint} disabled={printing || loading}>
          <Printer size={18} /> {printing ? 'Imprimiendo...' : 'Imprimir'}
        </button>
      </div>
    </div>
  );
}

function Viajes({ choferId, onLogout, otaStatus, onOtaReload, onOtaCheck, onNativeUpdate, onOtaCriticalChange }: {
  choferId: string;
  onLogout: () => void;
  otaStatus: OtaStatus;
  onOtaReload: () => void;
  onOtaCheck: () => void;
  onNativeUpdate: (url?: string) => void;
  onOtaCriticalChange: (critical: boolean) => void;
}) {
  const [viajes, setViajes] = useState<any[]>([]);
  const [activeViaje, setActiveViaje] = useState<any>(null);
  const [repartos, setRepartos] = useState<any[]>([]);
  const [activeReparto, setActiveReparto] = useState<any>(null);
  const [localStopAction, setLocalStopAction] = useState<{ parada: any; action: 'retiro' | 'entrega' | 'fallida' | 'reprogramar' } | null>(null);
  const [pendingEvents, setPendingEvents] = useState(loadQueue(choferId).length);
  const [pendingTracking, setPendingTracking] = useState(loadTrackingQueue(choferId).length);
  const [gpsTestRunning, setGpsTestRunning] = useState(false);
  const gpsTestWatchRef = useRef<string | undefined>(undefined);
  const [ticketConfig, setTicketConfig] = useState<TicketConfig>({
    membrete: '',
    width: 32,
    copies: 2,
    fields: defaultTicketFields,
    paperWidth: 58,
    headerTemplate: null
  });
  
  const [podPedido, setPodPedido] = useState<any>(null);
  const [printPedido, setPrintPedido] = useState<PrintPedidoState>(null);
  const [showIncidencia, setShowIncidencia] = useState(false);
  const [showGastos, setShowGastos] = useState(false);
  const [showPrintSettings, setShowPrintSettings] = useState(false);
  const [notice, setNotice] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const repartosSignatureRef = useRef<string>('');
  const viajesSignatureRef = useRef<string>('');
  const activeRepartoSignatureRef = useRef<string>('');
  const activeRepartoIdRef = useRef<number | null>(null);
  const eventsRef = useRef<EventSource | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const wsReconnectRef = useRef<number | null>(null);
  const realtimeEnabledRef = useRef(true);

  if (!choferId || choferId === 'null') {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Esta app requiere un perfil de chofer activo para operar. Los usuarios admin pueden usar el panel web.</div>;
  }

  const notifyPhone = async (title: string, body: string) => {
    setNotice(`${title}: ${body}`);
    window.setTimeout(() => setNotice(''), 8000);
    if (!Capacitor.isNativePlatform()) return;
    try {
      const permission = await LocalNotifications.requestPermissions();
      if (permission.display !== 'granted') return;
      await LocalNotifications.schedule({
        notifications: [{
          id: Date.now() % 2147483647,
          title,
          body,
          schedule: { at: new Date(Date.now() + 250) }
        }]
      });
    } catch (err) {
      console.warn('No se pudo mostrar notificacion local', err);
    }
  };

  const loadViajes = () => {
    fetch(`${getApiUrl()}/viajes/chofer/${choferId}`, { headers: getAuthHeaders(), cache: 'no-store' })
      .then(res => res.ok ? res.json() : Promise.reject(new Error('Response not ok')))
      .then(data => {
        const items = (Array.isArray(data) ? data : [])
          .filter((v: any) => String(v.tipo_viaje || '').toUpperCase() !== 'REPARTO_LOCAL');
        const nextSignature = jobSignature(items);
        if (viajesSignatureRef.current && viajesSignatureRef.current !== nextSignature) {
          const previousIds = new Set(JSON.parse(viajesSignatureRef.current || '[]').map((item: any) => item.id));
          const created = items.find((item: any) => !previousIds.has(item.id));
          if (created) notifyPhone('Nuevo viaje intersucursal asignado', `Viaje #${created.id} - ${created.vehiculo_chapa || 'vehiculo sin chapa'}`);
        }
        viajesSignatureRef.current = nextSignature;
        setViajes(items);
        const active = items.find((v: any) => !['planificado', 'finalizado'].includes(String(v.estado || '').toLowerCase()));
        if (active) setActiveViaje(active);
        else setActiveViaje(null);
      })
      .catch(err => {
        console.error('Error loading viajes:', err);
        setViajes([]);
      });
  };

  const loadRepartos = () => {
    fetch(`${getApiUrl()}/chofer/repartos`, { headers: getAuthHeaders(), cache: 'no-store' })
      .then(res => res.ok ? res.json() : [])
      .then(data => {
        const items = Array.isArray(data) ? data : [];
        const nextSignature = jobSignature(items);
        if (repartosSignatureRef.current && repartosSignatureRef.current !== nextSignature) {
          const previousIds = new Set(JSON.parse(repartosSignatureRef.current || '[]').map((item: any) => item.id));
          const created = items.find((item: any) => !previousIds.has(item.id));
          if (created) {
            notifyPhone(
              'Nuevo reparto local asignado',
              `Reparto #${created.id} - ${created.zona || created.ciudad || 'Zona sin definir'} - ${created.total_paradas || created.paradas_total || 0} paradas`
            );
          } else {
            notifyPhone('Cambio de reparto local', 'Se actualizaron paradas, estado o avance de tu ruta');
          }
        }
        repartosSignatureRef.current = nextSignature;
        setRepartos(items);
        localStorage.setItem(cacheKey(choferId), JSON.stringify(items));
      })
      .catch(() => {
        try {
          setRepartos(JSON.parse(localStorage.getItem(cacheKey(choferId)) || '[]'));
        } catch {
          setRepartos([]);
        }
      });
  };

  const openReparto = async (id: number) => {
    try {
      const res = await fetch(`${getApiUrl()}/chofer/repartos/${id}`, { headers: getAuthHeaders(), cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo abrir reparto');
      setActiveReparto(data);
      activeRepartoSignatureRef.current = localDetailSignature(data);
      localStorage.setItem(`${cacheKey(choferId)}:${id}`, JSON.stringify(data));
    } catch (err: any) {
      const cached = localStorage.getItem(`${cacheKey(choferId)}:${id}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        setActiveReparto(parsed);
        activeRepartoSignatureRef.current = localDetailSignature(parsed);
      }
      else alert(err.message || 'No se pudo abrir reparto');
    }
  };

  const refreshActiveReparto = async (notifyChanges = false) => {
    const id = activeRepartoIdRef.current;
    if (!id) return;
    try {
      const res = await fetch(`${getApiUrl()}/chofer/repartos/${id}`, { headers: getAuthHeaders(), cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo refrescar reparto');
      const nextSignature = localDetailSignature(data);
      if (notifyChanges && activeRepartoSignatureRef.current && activeRepartoSignatureRef.current !== nextSignature) {
        notifyPhone('Cambio de ruta/paradas', `Reparto #${id} fue actualizado desde el backoffice`);
      }
      activeRepartoSignatureRef.current = nextSignature;
      setActiveReparto(data);
      localStorage.setItem(`${cacheKey(choferId)}:${id}`, JSON.stringify(data));
    } catch {
      // La vista abierta permanece con el cache local si la conexion cae.
    }
  };

  const refreshFromRealtimeEvent = (event: any) => {
    const type = String(event?.event || event?.type || '');
    const payload = event?.payload || event || {};
    const legacyType = String(payload?.type || '');
    if (type.includes('reparto') || type.includes('route') || legacyType.includes('REPARTO_LOCAL')) {
      loadRepartos();
      if (activeRepartoIdRef.current && Number(payload?.viaje_id) === Number(activeRepartoIdRef.current)) {
        refreshActiveReparto(true);
      }
      return;
    }
    if (type.includes('viaje') || legacyType.includes('INTERURBANO') || legacyType.includes('VIAJE')) {
      loadViajes();
    }
    if (type === 'driver.snapshot' || type === 'system.connected') {
      loadViajes();
      loadRepartos();
      refreshActiveReparto(true);
    }
  };

  const realtimeWsUrl = (token: string) => {
    const apiUrl = getApiUrl();
    const base = apiUrl.startsWith('http')
      ? apiUrl.replace(/\/api\/?$/, '')
      : `${window.location.origin}${apiUrl}`.replace(/\/api\/?$/, '');
    return `${base.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:')}/ws?client=driver&token=${encodeURIComponent(token)}`;
  };

  const startDriverEvents = () => {
    const token = localStorage.getItem('choferToken');
    if (!token || wsRef.current) return;
    const ws = new WebSocket(realtimeWsUrl(token));
    wsRef.current = ws;
    ws.onopen = () => {
      if (wsReconnectRef.current) window.clearTimeout(wsReconnectRef.current);
      wsReconnectRef.current = null;
    };
    ws.onmessage = (message) => {
      try {
        const payload = JSON.parse(message.data || '{}');
        refreshFromRealtimeEvent(payload);
        const event = payload.event || payload.type || '';
        const data = payload.payload || {};
        if (['driver.viaje.assigned', 'driver.reparto.assigned', 'driver.route.changed', 'driver.notification'].includes(event)) {
          notifyPhone(data.title || 'Nueva novedad', data.body || 'La ruta fue actualizada');
        }
      } catch {
        // Mensaje realtime invalido.
      }
    };
    ws.onclose = () => {
      if (wsRef.current === ws) wsRef.current = null;
      if (!realtimeEnabledRef.current) return;
      if (!eventsRef.current) startDriverEventsFallback(token);
      wsReconnectRef.current = window.setTimeout(startDriverEvents, 4000);
    };
    ws.onerror = () => ws.close();
  };

  const startDriverEventsFallback = (token: string) => {
    if (eventsRef.current) return;
    const url = `${getApiUrl()}/chofer/events?token=${encodeURIComponent(token)}`;
    const events = new EventSource(url);
    eventsRef.current = events;
    events.addEventListener('driver-event', (message) => {
      const payload = JSON.parse((message as MessageEvent).data || '{}');
      refreshFromRealtimeEvent(payload);
    });
    events.onerror = () => {
      events.close();
      if (eventsRef.current === events) eventsRef.current = null;
    };
  };

  const registerPushNotifications = async () => {
    if (!Capacitor.isNativePlatform()) return;
    try {
      const permission = await PushNotifications.requestPermissions();
      if (permission.receive !== 'granted') return;
      await (PushNotifications as any).createChannel?.({
        id: 'chofer_assignments',
        name: 'Asignaciones de chofer',
        description: 'Nuevos viajes, repartos y cambios de ruta',
        importance: 5,
        visibility: 1,
        sound: 'default'
      });
      await PushNotifications.register();
      await PushNotifications.addListener('registration', async token => {
        await fetch(`${getApiUrl()}/chofer/device-token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          body: JSON.stringify({
            token: token.value,
            platform: Capacitor.getPlatform(),
            app_version: '1.0'
          })
        }).catch(() => undefined);
      });
      await PushNotifications.addListener('registrationError', error => {
        console.warn('No se pudo registrar FCM', error);
      });
      await PushNotifications.addListener('pushNotificationReceived', notification => {
        setNotice(`${notification.title || 'Nueva novedad'}: ${notification.body || ''}`);
        if (notification.data?.type === 'APP_UPDATE_AVAILABLE') onOtaCheck();
        loadViajes();
        loadRepartos();
        refreshActiveReparto(true);
      });
      await PushNotifications.addListener('pushNotificationActionPerformed', notification => {
        const data = notification.notification.data || {};
        loadViajes();
        loadRepartos();
        if (data.viaje_id) {
          if (String(data.tipo_viaje || '').toUpperCase() === 'REPARTO_LOCAL') openReparto(Number(data.viaje_id));
        }
      });
    } catch (err) {
      console.warn('Push FCM no disponible todavia', err);
    }
  };

  const enqueueLocalEvent = (event: LocalQueueEvent) => {
    const queue = [...loadQueue(choferId), event];
    saveQueue(choferId, queue);
    setPendingEvents(queue.length);
  };

  const flushLocalQueue = async () => {
    const queue = loadQueue(choferId);
    if (!queue.length) return;
    try {
      const res = await fetch(`${getApiUrl()}/reparto-local/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ eventos: queue })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'sync failed');
      const failedKeys = new Set((data.results || []).filter((item: any) => item && item.ok === false).map((item: any) => item.idempotency_key));
      const remaining = queue.filter(item => failedKeys.has(item.idempotency_key));
      saveQueue(choferId, remaining);
      setPendingEvents(remaining.length);
      loadRepartos();
      if (activeReparto?.viaje?.id) openReparto(activeReparto.viaje.id);
    } catch {
      setPendingEvents(queue.length);
    }
  };

  const sendLocalAction = async (event: LocalQueueEvent, endpoint: string, method = 'POST') => {
    try {
      const res = await fetch(`${getApiUrl()}${endpoint}`, {
        method,
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ ...event.payload, idempotency_key: event.idempotency_key, latitud: event.latitud, longitud: event.longitud })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
      if (data?.detail?.viaje || data?.detail?.paradas) setActiveReparto(data.detail);
      else if (data?.viaje || data?.paradas) setActiveReparto(data);
      else if (activeReparto?.viaje?.id) await openReparto(activeReparto.viaje.id);
      loadRepartos();
      return true;
    } catch (err: any) {
      if (isNetworkLikeError(err)) {
        enqueueLocalEvent(event);
        alert('No hay conexion estable. La accion quedo pendiente de sincronizar.');
      } else {
        alert(err?.message || 'No se pudo completar la accion');
      }
      return false;
    }
  };

  const enqueueTrackingPoint = (point: TrackingQueueItem) => {
    const queue = [...loadTrackingQueue(choferId), point];
    saveTrackingQueue(choferId, queue);
    setPendingTracking(queue.length);
  };

  const sendTrackingPoint = async (point: Omit<TrackingQueueItem, 'idempotency_key'>, queueOnFail = true) => {
    const item: TrackingQueueItem = {
      idempotency_key: idempotencyKey('tracking'),
      ...point
    };
    try {
      const res = await fetch(`${getApiUrl()}/tracking`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(item)
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Tracking error ${res.status}`);
      }
      return true;
    } catch (err) {
      if (queueOnFail && isNetworkLikeError(err)) enqueueTrackingPoint(item);
      return false;
    }
  };

  const flushTrackingQueue = async () => {
    const queue = loadTrackingQueue(choferId);
    if (!queue.length) {
      setPendingTracking(0);
      return;
    }

    const remaining: TrackingQueueItem[] = [];
    for (const item of queue) {
      try {
        const res = await fetch(`${getApiUrl()}/tracking`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          body: JSON.stringify(item)
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `Tracking error ${res.status}`);
        }
      } catch (err) {
        if (isNetworkLikeError(err)) remaining.push(item);
      }
    }
    saveTrackingQueue(choferId, remaining);
    setPendingTracking(remaining.length);
  };

  useEffect(() => {
    realtimeEnabledRef.current = true;
    setIsLoading(true);
    loadViajes();
    loadRepartos();
    flushLocalQueue();
    flushTrackingQueue();
    startDriverEvents();
    registerPushNotifications();
    const cachedHeader = localStorage.getItem('headerTemplateCache');
    let headerTemplate: HeaderTemplate | null = null;
    if (cachedHeader) {
      try {
        headerTemplate = JSON.parse(cachedHeader);
      } catch {
        headerTemplate = null;
      }
    }
    fetch(`${getApiUrl()}/configuracion`, { headers: getAuthHeaders() }).then(res => res.json()).then(data => {
      const byKey = Object.fromEntries(data.map((item: any) => [item.clave, item.valor]));
      let fields = defaultTicketFields;
      if (byKey.ticket_fields) {
        try {
          fields = { ...defaultTicketFields, ...JSON.parse(String(byKey.ticket_fields)) };
        } catch {
          fields = defaultTicketFields;
        }
      }
      setTicketConfig({
        membrete: String(byKey.membrete || ''),
        width: Number(byKey.ticket_width_chars || 32),
        copies: Number(byKey.ticket_copies || 2),
        fields,
        paperWidth: headerTemplate?.paperWidthDefault || 58,
        headerTemplate
      });
    }).catch(err => {
      console.warn('Error loading configuracion:', err);
      setTicketConfig(prev => ({ ...prev, headerTemplate, paperWidth: headerTemplate?.paperWidthDefault || prev.paperWidth }));
    });
    fetch(`${getApiUrl()}/header-template`, { headers: getAuthHeaders() })
      .then(res => res.json())
      .then(data => {
        if (data?.blocks) {
          localStorage.setItem('headerTemplateCache', JSON.stringify(data));
          setTicketConfig(prev => ({ ...prev, headerTemplate: data, paperWidth: data.paperWidthDefault === 80 ? 80 : 58 }));
        }
      })
      .catch(err => {
        console.warn('Error loading header-template:', err);
      });
    const syncPending = () => {
      flushLocalQueue();
      flushTrackingQueue();
    };
    const refreshJobs = () => {
      loadViajes();
      loadRepartos();
    };
    const foregroundRefresh = () => {
      if (document.visibilityState === 'visible') {
        refreshJobs();
        refreshActiveReparto(true);
        syncPending();
      }
    };
    // Set loading to false after initial data load (with small delay for data to appear)
    const loadingTimer = setTimeout(() => setIsLoading(false), 500);
    window.addEventListener('online', syncPending);
    document.addEventListener('visibilitychange', foregroundRefresh);
    const syncTimer = window.setInterval(syncPending, 30000);
    const pollingTimer = window.setInterval(() => {
      refreshJobs();
      refreshActiveReparto(true);
    }, 120000);
    return () => {
      clearTimeout(loadingTimer);
      window.removeEventListener('online', syncPending);
      document.removeEventListener('visibilitychange', foregroundRefresh);
      window.clearInterval(syncTimer);
      window.clearInterval(pollingTimer);
      eventsRef.current?.close();
      eventsRef.current = null;
      realtimeEnabledRef.current = false;
      wsRef.current?.close();
      wsRef.current = null;
      if (wsReconnectRef.current) window.clearTimeout(wsReconnectRef.current);
      wsReconnectRef.current = null;
    };
  }, [choferId]);

  useEffect(() => {
    activeRepartoIdRef.current = activeReparto?.viaje?.id ? Number(activeReparto.viaje.id) : null;
  }, [activeReparto]);

  useEffect(() => {
    const critical = Boolean(localStopAction || podPedido || printPedido || showIncidencia || showGastos || showPrintSettings);
    onOtaCriticalChange(critical);
    if (!critical) {
      tryQueuePendingOta({ apiUrl: getApiUrl(), token: localStorage.getItem('choferToken'), safeToQueue: true })
        .then(queued => { if (queued) onOtaCheck(); })
        .catch(() => undefined);
    }
  }, [localStopAction, podPedido, printPedido, showIncidencia, showGastos, showPrintSettings]);

  useEffect(() => {
    const trackedViaje = activeReparto?.viaje || activeViaje;
    if (!trackedViaje) {
      if (Capacitor.isNativePlatform()) BackgroundLocation.stop().catch(() => undefined);
      return;
    }
    
    let watchId: string | undefined;
    const startTracking = async () => {
      if (Capacitor.isNativePlatform()) {
        BackgroundLocation.start({
          apiUrl: getApiUrl(),
          token: localStorage.getItem('choferToken') || '',
          choferId,
          viajeId: trackedViaje.id ? String(trackedViaje.id) : '',
          vehiculoId: trackedViaje.vehiculo_id ? String(trackedViaje.vehiculo_id) : ''
        }).catch(err => console.warn('No se pudo iniciar GPS en segundo plano', err));
      }
      try {
        watchId = await Geolocation.watchPosition({ enableHighAccuracy: true }, (position, _err) => {
          if (!position) return;
          sendTrackingPoint({
            viaje_id: trackedViaje.id || null,
            vehiculo_id: trackedViaje.vehiculo_id || null,
            chofer_id: choferId,
            latitud: position.coords.latitude,
            longitud: position.coords.longitude,
            timestamp: new Date().toISOString()
          });
        });
      } catch (e) {
        console.error("Error watching position", e);
      }
    };
    startTracking();

    return () => {
      if (watchId) {
        Geolocation.clearWatch({ id: watchId });
      }
    };
  }, [activeViaje, activeReparto, choferId]);

  const syncHeaderTemplate = async () => {
    try {
      const response = await fetch(`${getApiUrl()}/header-template`, { headers: getAuthHeaders() });
      const data = await response.json();
      if (!response.ok || !data?.blocks) throw new Error(data.error || 'No se pudo sincronizar');
      localStorage.setItem('headerTemplateCache', JSON.stringify(data));
      setTicketConfig(prev => ({ ...prev, headerTemplate: data, paperWidth: data.paperWidthDefault === 80 ? 80 : 58 }));
      alert('Diseno sincronizado');
    } catch (err: any) {
      alert(`No se pudo sincronizar. Se mantiene el ultimo diseno cacheado. ${err.message || ''}`);
    }
  };

  const printTestTicket = async () => {
    setPrintPedido({
      tipo: 'comanda',
      ticketConfig: {
        ...ticketConfig,
        nativeDemoBitmap: false
      },
      pedido: {
        numero_guia: 'PRUEBA-0001',
        remitente_nombre: 'Empresa Demo',
        remitente_doc: '80012345-6',
        destinatario_nombre: 'Cliente de prueba',
        sucursal_origen_nombre: 'Asuncion Central',
        sucursal_destino_nombre: 'Ciudad del Este',
        tipo_carga: 'Paquete',
        cantidad_bultos: 1,
        peso: 2.5,
        precio: 25000,
        tipo_pago: 'contado',
        estado: 'prueba membrete real'
      }
    });
  };

  const stopGpsTest = async () => {
    if (gpsTestWatchRef.current) {
      await Geolocation.clearWatch({ id: gpsTestWatchRef.current });
      gpsTestWatchRef.current = undefined;
    }
    setGpsTestRunning(false);
  };

  const toggleGpsTest = async () => {
    if (gpsTestRunning) return stopGpsTest();
    try {
      const sendPosition = (position: any) => {
        if (!position) return;
        sendTrackingPoint({
          viaje_id: null,
          vehiculo_id: null,
          chofer_id: choferId,
          latitud: position.coords.latitude,
          longitud: position.coords.longitude,
          timestamp: new Date().toISOString()
        });
      };
      const current = await Geolocation.getCurrentPosition({ enableHighAccuracy: true });
      sendPosition(current);
      gpsTestWatchRef.current = await Geolocation.watchPosition({ enableHighAccuracy: true }, (position) => sendPosition(position));
      setGpsTestRunning(true);
    } catch (err: any) {
      alert(`No se pudo iniciar prueba GPS: ${err.message || err}`);
    }
  };

  useEffect(() => () => {
    if (gpsTestWatchRef.current) Geolocation.clearWatch({ id: gpsTestWatchRef.current });
  }, []);

  const updateViajeEstado = async (viajeId: number, estado: string, incidencias?: string) => {
    const gps = await currentGps();
    try {
      const res = await fetch(`${getApiUrl()}/viajes/${viajeId}/estado`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ estado, incidencias, ...gps })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
      if (data.viaje) {
        if (estado === 'finalizado' || ['finalizado', 'cancelado', 'con_incidencia'].includes(String(data.viaje.estado || '').toLowerCase())) {
          setActiveViaje(null);
        } else {
          setActiveViaje(data.viaje);
        }
      }
      setNotice(data.message || `Estado actualizado a ${estado.replace('_', ' ')}`);
      window.setTimeout(() => setNotice(''), 4500);
      loadViajes();
    } catch (err: any) {
      if (isNetworkLikeError(err)) {
        alert('No hay conexion con el servidor. Reintente cuando vuelva la senal.');
      } else {
        alert(err?.message || 'No se pudo actualizar el viaje');
      }
    }
  };

  const updatePedidoPod = (pedidoId: number, podData: any) => {
    fetch(`${getApiUrl()}/pedidos/${pedidoId}/pod`, {
      method: 'PUT', 
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() }, 
      body: JSON.stringify(podData)
    }).then(async (res) => {
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
      if (podData.estado === 'recolectado' && podPedido) {
        setPrintPedido({ pedido: { ...podPedido, ...(data.pedido || {}), ...podData }, tipo: 'retiro' });
      }
      setPodPedido(null);
      loadViajes();
    }).catch((err) => alert(err.message || 'No se pudo guardar la gestion'));
  };

  const startLocalReparto = async () => {
    if (!activeReparto?.viaje?.id) return;
    const gps = await currentGps();
    const event: LocalQueueEvent = {
      idempotency_key: idempotencyKey('viaje-local-iniciar'),
      tipo_evento: 'VIAJE_LOCAL_INICIADO',
      viaje_id: activeReparto.viaje.id,
      payload: {},
      ...gps,
      created_at: new Date().toISOString()
    };
    await sendLocalAction(event, `/reparto-local/viajes/${activeReparto.viaje.id}/iniciar`);
  };

  const finishLocalReparto = async () => {
    if (!activeReparto?.viaje?.id) return;
    const gps = await currentGps();
    const event: LocalQueueEvent = {
      idempotency_key: idempotencyKey('viaje-local-finalizar'),
      tipo_evento: 'VIAJE_LOCAL_FINALIZADO',
      viaje_id: activeReparto.viaje.id,
      payload: { permitir_pendientes: false },
      ...gps,
      created_at: new Date().toISOString()
    };
    const ok = await sendLocalAction(event, `/reparto-local/viajes/${activeReparto.viaje.id}/finalizar`);
    if (ok) setActiveReparto(null);
  };

  const updateLocalStopStatus = async (parada: any, estado: string) => {
    const gps = await currentGps();
    const event: LocalQueueEvent = {
      idempotency_key: idempotencyKey(`parada-${estado}`),
      tipo_evento: estado,
      viaje_id: parada.viaje_id || activeReparto?.viaje?.id,
      parada_id: parada.id,
      pedido_id: parada.pedido_id,
      payload: { estado },
      ...gps,
      created_at: new Date().toISOString()
    };
    await sendLocalAction(event, `/reparto-local/paradas/${parada.id}/estado`, 'PUT');
  };

  const completeLocalStop = async (data: any) => {
    if (!localStopAction) return;
    const { parada, action } = localStopAction;
    const gps = await currentGps();
    const eventType = action === 'retiro'
      ? 'RETIRO_COMPLETADO'
      : action === 'entrega'
        ? 'ENTREGA_COMPLETADA'
        : action === 'reprogramar'
          ? 'PARADA_REPROGRAMADA'
          : 'VISITA_FALLIDA';
    const event: LocalQueueEvent = {
      idempotency_key: idempotencyKey(eventType.toLowerCase()),
      tipo_evento: eventType,
      viaje_id: parada.viaje_id || activeReparto?.viaje?.id,
      parada_id: parada.id,
      pedido_id: parada.pedido_id,
      payload: data,
      ...gps,
      created_at: new Date().toISOString()
    };
    const endpoint = action === 'retiro'
      ? `/reparto-local/paradas/${parada.id}/retiro`
      : action === 'entrega'
        ? `/reparto-local/paradas/${parada.id}/entrega`
        : action === 'reprogramar'
          ? `/reparto-local/paradas/${parada.id}/reprogramar`
          : `/reparto-local/paradas/${parada.id}/fallida`;
    await sendLocalAction(event, endpoint);
    setLocalStopAction(null);
    if (action !== 'reprogramar') {
      const pedido = { ...(parada.pedido || parada), ...data, numero_guia: parada.numero_guia || parada.pedido?.numero_guia };
      setPrintPedido({ pedido, tipo: action });
    }
  };

  const openNavigation = (parada: any, app: 'maps' | 'waze') => {
    openPointNavigation({
      label: parada.nombre_contacto || parada.direccion || 'Parada',
      tipo: parada.tipo_parada,
      direccion: parada.direccion,
      latitud: parada.latitud,
      longitud: parada.longitud
    }, app);
  };

  if (showPrintSettings) {
    return (
      <div className="app-container">
        <div className="header">Impresion <button className="header-btn" onClick={() => setShowPrintSettings(false)}>Volver</button></div>
        <div className="content">
          <div className="card">
            <div className="text-lg">Membrete y prueba</div>
            <div className="text-sm">{ticketConfig.headerTemplate?.name || 'Diseno cacheado heredado'} - {ticketConfig.paperWidth || 58} mm</div>
            <div style={{ border: '1px solid #e5e7eb', background: '#fff', padding: '0.5rem', maxHeight: '220px', overflow: 'auto' }}>
              <HeaderPreview template={ticketConfig.headerTemplate} membrete={ticketConfig.membrete} paperWidth={ticketConfig.paperWidth || 58} />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button className="btn btn-outline" style={{ flex: 1 }} onClick={syncHeaderTemplate}>Sincronizar diseno</button>
              <button className="btn btn-outline" style={{ flex: 1 }} onClick={printTestTicket}><Printer size={16} /> Imprimir prueba</button>
            </div>
          </div>
          {printPedido && (
            <PrintTicketModal
              pedido={printPedido.pedido}
              tipo={printPedido.tipo}
              ticketConfig={printPedido.ticketConfig || ticketConfig}
              onClose={() => setPrintPedido(null)}
            />
          )}
        </div>
      </div>
    );
  }

  if (activeReparto) {
    const viaje = activeReparto.viaje || activeReparto;
    const paradas = activeReparto.paradas || [];
    const routePoints = localRoutePoints(paradas);
    const finalStopStates = ['RETIRADO', 'ENTREGADO', 'PARCIAL', 'COMPLETADO', 'FALLIDO', 'CANCELADO', 'REPROGRAMADO'];
    const pendingStops = paradas
      .slice()
      .sort((a: any, b: any) => Number(a.orden || 0) - Number(b.orden || 0))
      .filter((parada: any) => !finalStopStates.includes(String(parada.estado || '').toUpperCase()));
    const nextStop = pendingStops[0];
    return (
      <div className="app-container">
        <div className="header">Reparto local <button className="header-btn" onClick={() => setActiveReparto(null)}>Volver</button>
          <VersionIndicator otaStatus={otaStatus} />
        </div>
        <div className="content">
          {notice && <div className="notice-box">{notice}</div>}
          <div className="card">
            <div className="text-lg">{String(viaje.estado || '').toUpperCase() === 'EN_CURSO' ? 'Reparto local en curso' : 'Reparto local asignado'}</div>
            <div className="text-sm">Reparto #{viaje.id} | Zona: {viaje.zona || 'S/N'} | Ciudad: {viaje.ciudad || 'S/N'}</div>
            <div className="text-sm">Vehiculo: {viaje.vehiculo_chapa || 'S/N'} | Chofer: {viaje.chofer_nombre || 'S/N'} | Estado: {String(viaje.estado || '').toUpperCase()}</div>
            <div className="text-sm">Fecha: {viaje.fecha_inicio ? new Date(viaje.fecha_inicio).toLocaleString() : 'S/N'}</div>
            <div className="progress-row">
              <span>{activeReparto.avance?.completadas || 0}/{activeReparto.avance?.total || paradas.length} paradas completadas</span>
              <span>{activeReparto.avance?.fallidas || 0} fallida(s)</span>
              <span>{activeReparto.avance?.pendientes || 0} pendiente(s)</span>
            </div>
            {pendingEvents > 0 && <div className="error-box">{pendingEvents} accion(es) pendientes de sincronizar</div>}
            {pendingTracking > 0 && <div className="error-box">{pendingTracking} ubicacion(es) GPS pendientes de sincronizar</div>}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {String(viaje.estado).toUpperCase() !== 'EN_CURSO' && (
                <button className="btn" style={{ flex: 1 }} onClick={startLocalReparto}><Play size={18} /> Iniciar reparto</button>
              )}
              <button className="btn btn-outline" style={{ flex: 1 }} onClick={flushLocalQueue}><RefreshCw size={18} /> Sincronizar</button>
              <button className="btn btn-outline" style={{ flex: 1, color: '#10b981', borderColor: '#10b981' }} onClick={() => setShowGastos(true)}><DollarSign size={18} /> Gastos</button>
              <button className="btn btn-outline" style={{ flex: 1, color: '#ef4444', borderColor: '#ef4444' }} onClick={() => setShowIncidencia(true)}><AlertTriangle size={18} /> Incidencia</button>
              <button className="btn btn-outline" style={{ flex: 1 }} onClick={finishLocalReparto}><CheckCircle size={18} /> Finalizar</button>
            </div>
          </div>

          {nextStop && (
            <div className="card" style={{ borderLeft: '5px solid #f59e0b' }}>
              <div className="text-lg">Siguiente parada: #{nextStop.orden} {String(nextStop.tipo_parada || '').replace('_', ' + ')}</div>
              <div className="text-sm"><strong>Contacto:</strong> {nextStop.nombre_contacto || 'S/N'}</div>
              <div className="text-sm"><strong>Direccion:</strong> {nextStop.direccion || 'S/N'}</div>
              {nextStop.referencia_direccion && <div className="text-sm"><strong>Referencia:</strong> {nextStop.referencia_direccion}</div>}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <button className="btn btn-outline" onClick={() => openNavigation(nextStop, 'maps')}><Navigation size={16} /> Maps</button>
                <button className="btn btn-outline" onClick={() => updateLocalStopStatus(nextStop, 'LLEGUE')}>Ya llegue</button>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {String(nextStop.tipo_parada || '').toUpperCase().includes('RETIRO') && !['RETIRADO', 'ENTREGADO', 'PARCIAL', 'FALLIDO', 'CANCELADO'].includes(String(nextStop.estado || '').toUpperCase()) && <button className="btn" style={{ flex: 1 }} onClick={() => setLocalStopAction({ parada: nextStop, action: 'retiro' })}>Registrar retiro</button>}
                {String(nextStop.tipo_parada || '').toUpperCase().includes('ENTREGA') && !['ENTREGADO', 'PARCIAL', 'FALLIDO', 'CANCELADO'].includes(String(nextStop.estado || '').toUpperCase()) && <button className="btn" style={{ flex: 1, background: '#10b981' }} onClick={() => setLocalStopAction({ parada: nextStop, action: 'entrega' })}>Registrar entrega</button>}
              </div>
            </div>
          )}

          <div className="card">
            <div className="text-lg">Puntos a visitar</div>
            <div className="text-sm">{routePoints.filter(hasRouteCoords).length}/{routePoints.length} paradas con coordenadas</div>
            <button className="btn" style={{ width: '100%', marginTop: '0.75rem' }} onClick={() => openRouteNavigation(routePoints)}>
              <Navigation size={18} /> Abrir ruta completa en Maps
            </button>
            <div style={{ display: 'grid', gap: '0.5rem', marginTop: '0.75rem' }}>
              {routePoints.map((point, index) => (
                <div key={`${point.label}-${index}`} style={{ border: '1px solid #e5e7eb', borderRadius: '6px', padding: '0.5rem', background: '#f9fafb' }}>
                  <div className="text-sm"><strong>{point.label}</strong></div>
                  <div className="text-sm">{point.direccion || 'Sin direccion'}</div>
                </div>
              ))}
            </div>
          </div>

          {paradas.map((parada: any) => {
            const type = String(parada.tipo_parada || '').toUpperCase();
            const status = String(parada.estado || '').toUpperCase();
            const done = finalStopStates.includes(status);
            const canChangeRouteStatus = !done;
            const canRetiro = type.includes('RETIRO') && !['RETIRADO', 'ENTREGADO', 'PARCIAL', 'FALLIDO', 'CANCELADO'].includes(status);
            const canEntrega = type.includes('ENTREGA') && !['ENTREGADO', 'PARCIAL', 'FALLIDO', 'CANCELADO'].includes(status);
            const canFail = !['RETIRADO', 'ENTREGADO', 'PARCIAL', 'FALLIDO', 'CANCELADO'].includes(status);
            return (
              <div key={parada.id} className="card" style={done ? { borderLeft: '5px solid #10b981' } : { borderLeft: '5px solid #2563eb' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
                  <div className="text-lg">#{parada.orden} {type.replace('_', ' + ')}</div>
                  <span className={`badge ${done ? 'completado' : 'planificado'}`}>{parada.estado || 'PENDIENTE'}</span>
                </div>
                <div className="text-sm"><strong>Contacto:</strong> {parada.nombre_contacto || 'S/N'}</div>
                <div className="text-sm"><strong>Telefono:</strong> {parada.telefono_contacto || 'S/N'}</div>
                <div className="text-sm"><strong>Direccion:</strong> {parada.direccion || 'S/N'}</div>
                {parada.referencia_direccion && <div className="text-sm"><strong>Referencia:</strong> {parada.referencia_direccion}</div>}
                <div className="text-sm"><strong>Carga:</strong> {parada.cantidad_bultos || parada.pedido?.cantidad_bultos || 1} bultos | {parada.tipo_carga || parada.pedido?.tipo_carga || 'Carga'}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <button className="btn btn-outline" onClick={() => openNavigation(parada, 'maps')}><Navigation size={16} /> Maps</button>
                  <button className="btn btn-outline" onClick={() => openNavigation(parada, 'waze')}><MapPin size={16} /> Waze</button>
                  {canChangeRouteStatus && <button className="btn btn-outline" onClick={() => updateLocalStopStatus(parada, 'EN_CAMINO')}>En camino</button>}
                  {canChangeRouteStatus && <button className="btn btn-outline" onClick={() => updateLocalStopStatus(parada, 'LLEGUE')}>Llegue</button>}
                </div>
                {status === 'RETIRADO' && <div className="notice-box">Retiro registrado. Puede reimprimir comprobante o continuar con entrega si corresponde.</div>}
                {['ENTREGADO', 'PARCIAL'].includes(status) && <div className="notice-box">Entrega registrada. Puede reimprimir el comprobante.</div>}
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {canRetiro && <button className="btn" style={{ flex: 1 }} onClick={() => setLocalStopAction({ parada, action: 'retiro' })}>Registrar retiro</button>}
                  {canEntrega && <button className="btn" style={{ flex: 1, background: '#10b981' }} onClick={() => setLocalStopAction({ parada, action: 'entrega' })}>Registrar entrega</button>}
                  {canFail && <button className="btn btn-outline" style={{ flex: 1, color: '#b91c1c', borderColor: '#ef4444' }} onClick={() => setLocalStopAction({ parada, action: 'fallida' })}>Registrar visita fallida</button>}
                  {canFail && <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setLocalStopAction({ parada, action: 'reprogramar' })}>Reprogramar</button>}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                  <button className="btn btn-outline" onClick={() => setPrintPedido({ pedido: parada.pedido || parada, tipo: 'retiro' })}><Printer size={16} /> Retiro</button>
                  <button className="btn btn-outline" onClick={() => setPrintPedido({ pedido: parada.pedido || parada, tipo: 'entrega' })}><Printer size={16} /> Entrega</button>
                  <button className="btn btn-outline" onClick={() => setPrintPedido({ pedido: parada.pedido || parada, tipo: 'fallida' })}><Printer size={16} /> Fallida</button>
                </div>
              </div>
            );
          })}
        </div>

        {localStopAction && (
          <LocalStopModal
            parada={localStopAction.parada}
            action={localStopAction.action}
            onClose={() => setLocalStopAction(null)}
            onSave={completeLocalStop}
          />
        )}
        {printPedido && (
          <PrintTicketModal pedido={printPedido.pedido} tipo={printPedido.tipo} ticketConfig={printPedido.ticketConfig || ticketConfig} onClose={() => setPrintPedido(null)} />
        )}
        {showIncidencia && (
          <IncidenciaModal
            onClose={() => setShowIncidencia(false)}
            onSave={(nota) => { updateViajeEstado(viaje.id, 'con_incidencia', nota); setShowIncidencia(false); }}
          />
        )}
        {showGastos && (
          <GastosModal
            choferId={choferId}
            viajeId={viaje.id}
            onClose={() => setShowGastos(false)}
            onSave={() => {}}
          />
        )}
      </div>
    );
  }

  if (activeViaje) {
    const routePoints = interurbanRoutePoints(activeViaje);
    return (
      <div className="app-container">
        <div className="header">Viaje en Curso <button className="header-btn" onClick={() => setActiveViaje(null)}>Volver</button>
          <VersionIndicator otaStatus={otaStatus} />
        </div>
        <div className="content">
          <div className="card">
            <div className="text-lg">Vehículo: {activeViaje.vehiculo_chapa}</div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.5rem' }}>
              <div className={`badge ${activeViaje.estado === 'con_incidencia' ? 'borrador' : 'en_curso'}`} style={activeViaje.estado === 'con_incidencia' ? {background: '#fee2e2', color: '#b91c1c'} : {}}>
                {activeViaje.estado.replace('_', ' ').toUpperCase()}
              </div>
              <button className="btn btn-outline" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', borderColor: '#ef4444', color: '#ef4444' }} onClick={() => setShowIncidencia(true)}>
                <AlertTriangle size={14} style={{ marginRight: '0.25rem' }}/> Reportar Incidencia
              </button>
            </div>
            {activeViaje.incidencias && (
              <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#b91c1c', background: '#fee2e2', padding: '0.5rem', borderRadius: '4px' }}>
                <strong>Incidencia:</strong> {activeViaje.incidencias}
              </div>
            )}
            {pendingTracking > 0 && <div className="error-box">{pendingTracking} ubicacion(es) GPS pendientes de sincronizar</div>}
            
            <div className="divider"></div>
            
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
              <button className="btn" style={{ flex: 1, background: '#3b82f6', borderColor: '#3b82f6', fontSize: '0.85rem' }} onClick={() => updateViajeEstado(activeViaje.id, 'llegada_retiro')}>
                <MapPin size={16} className="inline"/> Llegada a Retiro
              </button>
              <button className="btn" style={{ flex: 1, background: '#8b5cf6', borderColor: '#8b5cf6', fontSize: '0.85rem' }} onClick={() => updateViajeEstado(activeViaje.id, 'llegada_sucursal')}>
                <Navigation size={16} className="inline"/> Llegada a Sucursal
              </button>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
              <button className="btn btn-outline" style={{ flex: 1, fontSize: '0.85rem', color: '#10b981', borderColor: '#10b981' }} onClick={() => setShowGastos(true)}>
                <DollarSign size={16} className="inline"/> Gastos
              </button>
            </div>

            <div className="card" style={{ background: '#f9fafb', boxShadow: 'none', border: '1px solid #e5e7eb', padding: '1rem', marginBottom: '1rem' }}>
              <div className="text-lg">Ruta interurbana</div>
              <div className="text-sm">{routePoints.filter(hasRouteCoords).length}/{routePoints.length} puntos con coordenadas</div>
              <button className="btn" style={{ width: '100%', marginTop: '0.75rem' }} onClick={() => openRouteNavigation(routePoints)}>
                <Navigation size={18} /> Abrir ruta completa en Maps
              </button>
              <div style={{ display: 'grid', gap: '0.5rem', marginTop: '0.75rem' }}>
                {routePoints.length === 0 && <div className="text-sm">No hay coordenadas cargadas para este viaje.</div>}
                {routePoints.map((point, index) => (
                  <div key={`${point.label}-${index}`} style={{ border: '1px solid #e5e7eb', borderRadius: '6px', padding: '0.5rem', background: '#fff' }}>
                    <div className="text-sm"><strong>{point.label}</strong></div>
                    <div className="text-sm">{point.direccion || 'Sin direccion'}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.5rem' }}>
                      <button className="btn btn-outline" onClick={() => openPointNavigation(point, 'maps')}><Navigation size={16} /> Maps</button>
                      <button className="btn btn-outline" onClick={() => openPointNavigation(point, 'waze')}><MapPin size={16} /> Waze</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="text-lg" style={{marginTop: '0.5rem'}}>Pedidos ({activeViaje.pedidos?.length || 0})</div>
            {activeViaje.pedidos?.map((p: any) => (
              <div key={p.id} className="card" style={{ background: '#f9fafb', boxShadow: 'none', border: '1px solid #e5e7eb', padding: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <strong>{p.numero_guia || `#${p.id}`}</strong>
                  <div className={`badge ${p.estado === 'entregado' ? 'completado' : 'planificado'}`}>{p.estado}</div>
                </div>
                <div style={{ fontSize: '0.85rem', marginTop: '0.5rem', color: '#4b5563' }}>
                  <div style={{ marginBottom: '0.25rem' }}><strong>Remitente:</strong> {p.remitente_nombre}</div>
                  <div style={{ marginBottom: '0.25rem' }}><strong>Origen:</strong> {p.sucursal_origen_nombre || p.remitente_direccion}</div>
                  <div style={{ marginBottom: '0.25rem' }}><strong>Destinatario:</strong> {p.destinatario_nombre}</div>
                  <div style={{ marginBottom: '0.25rem' }}><strong>Destino:</strong> {p.sucursal_destino_nombre || p.destinatario_direccion}</div>
                  <div><strong>Carga:</strong> {p.tipo_carga} | {p.cantidad_bultos} bultos</div>
                </div>
                
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                  <button className="btn btn-outline" style={{flex: 1, fontSize:'0.8rem'}} onClick={() => setPrintPedido({ pedido: p, tipo: 'comanda' })}>
                    <Printer size={16}/> Comanda
                  </button>
                  <button className="btn btn-outline" style={{flex: 1, fontSize:'0.8rem', borderColor: '#10b981', color: '#047857'}} onClick={() => setPrintPedido({ pedido: p, tipo: 'retiro' })}>
                    <Printer size={16}/> Retiro
                  </button>
                  
                  {p.estado !== 'entregado' && (
                    <button className="btn" style={{flex: 2, fontSize:'0.8rem'}} onClick={() => setPodPedido(p)}>
                      <Edit3 size={16}/> Gestionar (Entregar/Retirar)
                    </button>
                  )}
                </div>
                {p.foto_pod && <div style={{marginTop: '0.5rem', fontSize: '0.75rem', color:'#10b981', display: 'flex', alignItems: 'center', gap: '0.25rem'}}><CheckCircle size={14}/> Comprobante (POD) registrado</div>}
              </div>
            ))}

            <div className="divider"></div>
            <button className="btn btn-outline" onClick={() => updateViajeEstado(activeViaje.id, 'finalizado')} style={{ width: '100%' }}>
              <CheckCircle size={20}/> Finalizar Viaje Completo
            </button>
          </div>
        </div>

        {podPedido && (
          <PODModal 
            pedido={podPedido} 
            onClose={() => setPodPedido(null)} 
            onSave={(data) => updatePedidoPod(podPedido.id, data)} 
          />
        )}

        {showIncidencia && (
          <IncidenciaModal 
            onClose={() => setShowIncidencia(false)}
            onSave={(nota) => { updateViajeEstado(activeViaje.id, 'con_incidencia', nota); setShowIncidencia(false); }}
          />
        )}

        {showGastos && (
          <GastosModal 
            choferId={choferId} 
            viajeId={activeViaje.id} 
            onClose={() => setShowGastos(false)} 
            onSave={() => {}} 
          />
        )}

        {printPedido && (
          <PrintTicketModal
            pedido={printPedido.pedido}
            tipo={printPedido.tipo}
            ticketConfig={printPedido.ticketConfig || ticketConfig}
            onClose={() => setPrintPedido(null)}
          />
        )}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="app-container">
        <div className="header">Mis Viajes</div>
        <div className="content" style={{ justifyContent: 'center', alignItems: 'center' }}>
          <div className="card" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
            <RefreshCw size={48} style={{ animation: 'spin 1s linear infinite', color: 'var(--primary-color)', margin: '0 auto 1rem' }} />
            <div className="text-lg">Cargando datos...</div>
            <div className="text-sm" style={{ marginTop: '0.5rem' }}>Por favor espera mientras se cargan tus viajes y repartos</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <div className="header">
        <button style={{ position: 'absolute', left: '1rem', top: '1rem', background: 'none', border: 'none', color: 'white', fontWeight: 'bold', cursor: 'pointer' }} onClick={() => setShowPrintSettings(true)}>
          <Settings size={18} />
        </button>
        Mis Viajes <button className="header-btn" onClick={onLogout}>Salir</button>
        <VersionIndicator otaStatus={otaStatus} />
      </div>
      <div className="content">
        <OtaUpdateBanner status={otaStatus} onReload={onOtaReload} onCheck={onOtaCheck} onNativeUpdate={onNativeUpdate} />
        {notice && <div className="notice-box">{notice}</div>}
        <div className="card">
          <div className="text-lg">Prueba GPS</div>
          <div className="text-sm">Envia tu ubicacion al mapa del sistema aunque no tengas viaje activo.</div>
          {pendingTracking > 0 && <div className="error-box">{pendingTracking} ubicacion(es) GPS pendientes de sincronizar</div>}
          <button className={`btn ${gpsTestRunning ? 'btn-outline' : ''}`} onClick={toggleGpsTest}>
            <Navigation size={18} /> {gpsTestRunning ? 'Detener prueba GPS' : 'Iniciar prueba GPS'}
          </button>
        </div>

        <div className="text-lg">Repartos locales</div>
        {pendingEvents > 0 && <div className="error-box">{pendingEvents} accion(es) pendientes de sincronizar</div>}
        {repartos.length === 0 ? (
          <div className="card text-center" style={{ padding: '1.25rem' }}>No hay repartos locales asignados</div>
        ) : (
          repartos.map((v) => (
            <div key={`local-${v.id}`} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
                <span className="text-lg">Reparto #{v.id}</span>
                <span className={`badge ${String(v.estado).toUpperCase() === 'EN_CURSO' ? 'en_curso' : 'planificado'}`}>{v.estado}</span>
              </div>
              <div className="text-sm">Zona: {v.zona || v.ciudad || 'Sin zona'}</div>
              <div className="text-sm">Vehiculo: {v.vehiculo_chapa || 'S/N'}</div>
              <div className="text-sm">{v.completadas || 0}/{v.total_paradas || 0} paradas completadas</div>
              <button className="btn" onClick={() => openReparto(v.id)}>
                <MapPin size={18} /> Abrir reparto
              </button>
            </div>
          ))
        )}

        <div className="text-lg">Viajes intersucursal</div>
        {viajes.length === 0 ? (
          <div className="card text-center" style={{ padding: '1.25rem' }}>No hay viajes intersucursal asignados</div>
        ) : (
          viajes.map((v) => (
            <div key={v.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="text-lg">Viaje #{v.id}</span>
                <span className={`badge ${v.estado === 'en_curso' ? 'en_curso' : 'planificado'}`}>{v.estado}</span>
              </div>
              <div className="text-sm" style={{ marginTop: '0.5rem' }}>Vehículo: {v.vehiculo_chapa}</div>
              <div className="text-sm">Fecha: {new Date(v.fecha_inicio).toLocaleDateString()}</div>
              <div className="divider"></div>
              <div className="text-sm mb-2">{v.pedidos?.length || 0} pedidos asignados</div>
              
              {v.estado === 'planificado' && (
                <button className="btn" style={{ width: '100%', marginTop: '0.5rem' }} onClick={() => updateViajeEstado(v.id, 'en_curso')}>
                  <Play size={20} /> Iniciar Viaje
                </button>
              )}
              <button className="btn btn-outline" style={{ width: '100%', marginTop: '0.5rem' }} onClick={() => setActiveViaje(v)}>
                <Navigation size={18} /> Ver ruta y gestionar
              </button>
            </div>
          ))
        )}
        {printPedido && (
          <PrintTicketModal
            pedido={printPedido.pedido}
            tipo={printPedido.tipo}
            ticketConfig={printPedido.ticketConfig || ticketConfig}
            onClose={() => setPrintPedido(null)}
          />
        )}
      </div>
    </div>
  );
}

export default function AppWrapper() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}

function App() {
  const [choferId, setChoferId] = useState<string | null>(localStorage.getItem('choferId'));
  const [otaStatus, setOtaStatus] = useState<OtaStatus>({ supported: false, busy: false, updateReady: false, message: '' });
  const [otaCritical, setOtaCritical] = useState(false);

  const checkOta = () => {
    const sessionToken = choferId && choferId !== 'null' ? localStorage.getItem('choferToken') : null;
    runChoferOtaCheck({
      apiUrl: getApiUrl(),
      token: sessionToken,
      choferId,
      safeToQueue: !otaCritical,
      onStatus: setOtaStatus
    }).catch(() => undefined);
  };

  useEffect(() => {
    checkOta();
    const timer = window.setInterval(checkOta, 30 * 60 * 1000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') checkOta();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [choferId, otaCritical]);

  const handleLogin = (session: DriverSession) => {
    localStorage.setItem('choferId', session.choferId);
    localStorage.setItem('choferNombre', session.choferNombre);
    localStorage.setItem('choferToken', session.token);
    localStorage.setItem('choferRefreshToken', session.refreshToken);
    setChoferId(session.choferId);
  };
  const handleLogout = () => {
    if (Capacitor.isNativePlatform()) BackgroundLocation.stop().catch(() => undefined);
    localStorage.removeItem('choferId');
    localStorage.removeItem('choferNombre');
    localStorage.removeItem('choferToken');
    localStorage.removeItem('choferRefreshToken');
    setChoferId(null);
  };
  const openNativeApkUpdate = (url?: string) => {
    if (!url) {
      alert('No hay enlace de APK configurado en backoffice.');
      return;
    }
    openExternalUrl(url);
  };
  if (!choferId || choferId === 'null') {
    return <Login onLogin={handleLogin} otaStatus={otaStatus} onOtaReload={reloadForOtaUpdate} onOtaCheck={checkOta} onNativeUpdate={openNativeApkUpdate} />;
  }
  return (
    <Viajes
      choferId={choferId}
      onLogout={handleLogout}
      otaStatus={otaStatus}
      onOtaReload={reloadForOtaUpdate}
      onOtaCheck={checkOta}
      onNativeUpdate={openNativeApkUpdate}
      onOtaCriticalChange={setOtaCritical}
    />
  );
}
