import { useState, useEffect, useRef, type FormEvent } from 'react';
import { Truck, MapPin, CheckCircle, Navigation, Play, Printer, Camera as CameraIcon, X, AlertTriangle, Edit3, DollarSign, UserPlus, Settings } from 'lucide-react';
import { registerPlugin } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Geolocation } from '@capacitor/geolocation';
import './index.css';

const DEFAULT_NATIVE_API_URL = 'http://192.168.3.45:3001/api';

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
};

const BluetoothPrinter = registerPlugin<{
  listBondedPrinters: () => Promise<{ devices: BluetoothDevice[] }>;
  print: (options: { address: string; text: string; copies: number }) => Promise<{ success: boolean }>;
}>('BluetoothPrinter');

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

function wrapLine(text: string, width: number) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';

  for (const word of words) {
    if (!line) {
      line = word;
    } else if (`${line} ${word}`.length <= width) {
      line += ` ${word}`;
    } else {
      lines.push(line);
      line = word;
    }

    while (line.length > width) {
      lines.push(line.slice(0, width));
      line = line.slice(width);
    }
  }

  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

function addWrappedField(lines: string[], label: string, value: any, width: number) {
  if (value === undefined || value === null || value === '') return;
  const prefix = `${label}: `;
  const available = Math.max(8, width - prefix.length);
  const wrapped = wrapLine(String(value), available);
  lines.push(`${prefix}${wrapped[0]}`.slice(0, width));
  for (const line of wrapped.slice(1)) {
    lines.push(`${' '.repeat(Math.min(prefix.length, width - 1))}${line}`.slice(0, width));
  }
}

function centerText(text: string, width: number) {
  const safe = String(text || '').slice(0, width);
  const left = Math.max(0, Math.floor((width - safe.length) / 2));
  return `${' '.repeat(left)}${safe}`;
}

function htmlToTicketText(html: string) {
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

function money(value: any) {
  const numeric = Number(value || 0);
  return `Gs. ${numeric.toLocaleString('es-PY')}`;
}

function buildReceiptText(pedido: any, config: TicketConfig, tipo: 'retiro' | 'comanda') {
  const width = Math.min(64, Math.max(24, Number(config.width || 32)));
  const enabled = { ...defaultTicketFields, ...(config.fields || {}) };
  const lines: string[] = [];
  const separator = '-'.repeat(width);

  const headerLines = htmlToTicketText(config.membrete).split('\n').filter(Boolean);
  headerLines.forEach(line => wrapLine(line, width).forEach(part => lines.push(centerText(part, width))));
  if (headerLines.length) lines.push(separator);

  lines.push(centerText(tipo === 'retiro' ? 'COMPROBANTE DE RETIRO' : 'COMANDA', width));
  lines.push(separator);

  const values: Record<string, any> = {
    ...pedido,
    fecha: new Date().toLocaleString('es-PY'),
    peso: pedido.peso ? `${pedido.peso}` : '',
    volumen: pedido.volumen ? `${pedido.volumen}` : '',
    precio: pedido.precio ? money(pedido.precio) : '',
    valor_declarado: pedido.valor_declarado ? money(pedido.valor_declarado) : ''
  };

  Object.keys(fieldLabels).forEach(key => {
    if (enabled[key]) addWrappedField(lines, fieldLabels[key], values[key], width);
  });

  lines.push(separator);
  if (tipo === 'retiro') {
    lines.push('Recibimos los bultos indicados');
    lines.push('para su transporte.');
    lines.push('');
    lines.push('Firma cliente:');
    lines.push('');
    lines.push('____________________________');
  }
  lines.push('');
  lines.push('');
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function Login({ onLogin }: { onLogin: (session: DriverSession) => void }) {
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
        choferId: String(data.chofer.id),
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
      <div className="header">App Chofer</div>
      <div className="content" style={{ justifyContent: 'center' }}>
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
    if (!monto || Number(monto) <= 0) return alert('Ingrese un monto válido');
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
      alert('Gasto registrado con éxito');
      onSave();
      onClose();
    }).catch(e => {
      alert('Error al guardar: ' + e.message);
    });
  };

  return (
    <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
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
            <option value="viatico">Viático</option>
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

function NuevoClienteModal({ onClose, onSave }: { onClose: () => void, onSave: () => void }) {
  const [nombre, setNombre] = useState('');
  const [ruc, setRuc] = useState('');
  const [direccion, setDireccion] = useState('');
  const [telefono, setTelefono] = useState('');
  const [latLng, setLatLng] = useState<{lat: number, lng: number} | null>(null);

  useEffect(() => {
    Geolocation.getCurrentPosition().then(pos => {
      setLatLng({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    }).catch(console.error);
  }, []);

  const handleSave = () => {
    if (!nombre) return alert('El nombre es requerido');
    fetch(`${getApiUrl()}/clientes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({
        nombre,
        ruc,
        direccion,
        telefono,
        latitud: latLng?.lat,
        longitud: latLng?.lng
      })
    }).then(() => {
      alert('Cliente registrado con éxito');
      onSave();
      onClose();
    }).catch(e => {
      alert('Error al guardar: ' + e.message);
    });
  };

  return (
    <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
      <div className="card" style={{ width: '100%', maxWidth: '400px', maxHeight: '90vh', overflowY: 'auto', background: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <UserPlus size={20} /> Nuevo Cliente
          </h3>
          <X size={24} onClick={onClose} style={{ cursor: 'pointer', color: '#6b7280' }} />
        </div>
        
        <div className="form-group">
          <label>Nombre/Razón Social</label>
          <input className="input" value={nombre} onChange={e => setNombre(e.target.value)} />
        </div>
        <div className="form-group">
          <label>RUC/CI</label>
          <input className="input" value={ruc} onChange={e => setRuc(e.target.value)} />
        </div>
        <div className="form-group">
          <label>Dirección</label>
          <input className="input" value={direccion} onChange={e => setDireccion(e.target.value)} />
        </div>
        <div className="form-group">
          <label>Teléfono</label>
          <input className="input" value={telefono} onChange={e => setTelefono(e.target.value)} />
        </div>
        
        {latLng && (
          <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '1rem' }}>
            Ubicación GPS capturada: {latLng.lat.toFixed(5)}, {latLng.lng.toFixed(5)}
          </div>
        )}

        <button className="btn" style={{ width: '100%', marginTop: '1rem' }} onClick={handleSave}>Registrar Cliente</button>
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
    <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
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
            <label>Motivo de Devolución</label>
            <input type="text" className="input" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Especifique el motivo..." />
          </div>
        )}

        <div className="form-group">
          <label>Bultos (Levantados/Entregados)</label>
          <input type="number" className="input" value={bultos} onChange={e => setBultos(Number(e.target.value))} />
        </div>

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
                onClick={() => onSave({ estado, motivo_devolucion: motivo, foto_pod: foto, firma_pod: firma, observaciones, bultos_reales: bultos })}>
          <CheckCircle size={18} /> Confirmar Gestión
        </button>
      </div>
    </div>
  );
}

function IncidenciaModal({ onClose, onSave }: { onClose: () => void, onSave: (nota: string) => void }) {
  const [nota, setNota] = useState('');
  return (
    <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
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

function PrintTicketModal({
  pedido,
  ticketConfig,
  tipo,
  onClose
}: {
  pedido: any;
  ticketConfig: TicketConfig;
  tipo: 'retiro' | 'comanda';
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
      await BluetoothPrinter.print({
        address: selectedAddress,
        text: buildReceiptText(pedido, ticketConfig, tipo),
        copies: Math.max(1, Number(copies || 1))
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
    <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
      <div className="card" style={{ width: '100%', maxWidth: '420px', maxHeight: '90vh', overflowY: 'auto', background: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Printer size={20} /> {tipo === 'retiro' ? 'Imprimir retiro' : 'Imprimir comanda'}
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

        <pre style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '4px', padding: '0.75rem', fontSize: '0.75rem', overflowX: 'auto', maxHeight: '220px' }}>
          {buildReceiptText(pedido, ticketConfig, tipo)}
        </pre>

        <button className="btn" style={{ width: '100%', justifyContent: 'center', marginTop: '1rem' }} onClick={handlePrint} disabled={printing || loading}>
          <Printer size={18} /> {printing ? 'Imprimiendo...' : 'Imprimir'}
        </button>
      </div>
    </div>
  );
}

function Viajes({ choferId, onLogout }: { choferId: string, onLogout: () => void }) {
  const [viajes, setViajes] = useState<any[]>([]);
  const [activeViaje, setActiveViaje] = useState<any>(null);
  const [gpsTestRunning, setGpsTestRunning] = useState(false);
  const gpsTestWatchRef = useRef<string | undefined>(undefined);
  const [ticketConfig, setTicketConfig] = useState<TicketConfig>({
    membrete: '',
    width: 32,
    copies: 2,
    fields: defaultTicketFields
  });
  
  const [podPedido, setPodPedido] = useState<any>(null);
  const [printPedido, setPrintPedido] = useState<{ pedido: any; tipo: 'retiro' | 'comanda' } | null>(null);
  const [showIncidencia, setShowIncidencia] = useState(false);
  const [showGastos, setShowGastos] = useState(false);
  const [showNuevoCliente, setShowNuevoCliente] = useState(false);

  const loadViajes = () => {
    fetch(`${getApiUrl()}/viajes/chofer/${choferId}`, { headers: getAuthHeaders() })
      .then(res => res.json())
      .then(data => {
        setViajes(data);
        const active = data.find((v: any) => v.estado !== 'planificado' && v.estado !== 'finalizado');
        if (active) setActiveViaje(active);
        else setActiveViaje(null);
      });
  };

  useEffect(() => {
    loadViajes();
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
        fields
      });
    });
  }, [choferId]);

  useEffect(() => {
    if (!activeViaje) return;
    
    let watchId: string | undefined;
    const startTracking = async () => {
      try {
        watchId = await Geolocation.watchPosition({ enableHighAccuracy: true }, (position, _err) => {
          if (!position) return;
          fetch(`${getApiUrl()}/tracking`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify({ 
              vehiculo_id: activeViaje.vehiculo_id, 
              chofer_id: choferId,
              latitud: position.coords.latitude, 
              longitud: position.coords.longitude 
            })
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
  }, [activeViaje, choferId]);

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
        fetch(`${getApiUrl()}/tracking`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          body: JSON.stringify({
            chofer_id: choferId,
            latitud: position.coords.latitude,
            longitud: position.coords.longitude
          })
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

  const updateViajeEstado = (viajeId: number, estado: string, incidencias?: string) => {
    fetch(`${getApiUrl()}/viajes/${viajeId}/estado`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', ...getAuthHeaders() }, body: JSON.stringify({ estado, incidencias })
    }).then(() => {
      if (estado === 'finalizado') setActiveViaje(null);
      loadViajes();
    });
  };

  const updatePedidoPod = (pedidoId: number, podData: any) => {
    fetch(`${getApiUrl()}/pedidos/${pedidoId}/pod`, {
      method: 'PUT', 
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() }, 
      body: JSON.stringify(podData)
    }).then(() => {
      if (podData.estado === 'recolectado' && podPedido) {
        setPrintPedido({ pedido: { ...podPedido, ...podData }, tipo: 'retiro' });
      }
      setPodPedido(null);
      loadViajes();
    });
  };

  if (activeViaje) {
    return (
      <div className="app-container">
        <div className="header">Viaje en Curso</div>
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
              <button className="btn btn-outline" style={{ flex: 1, fontSize: '0.85rem', color: '#f59e0b', borderColor: '#f59e0b' }} onClick={() => setShowNuevoCliente(true)}>
                <UserPlus size={16} className="inline"/> Cliente Ruta
              </button>
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
            <button className="btn btn-outline" onClick={() => updateViajeEstado(activeViaje.id, 'finalizado')} 
                    disabled={activeViaje.pedidos?.some((p:any) => p.estado !== 'entregado')} style={{ width: '100%' }}>
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

        {showNuevoCliente && (
          <NuevoClienteModal 
            onClose={() => setShowNuevoCliente(false)} 
            onSave={() => {}} 
          />
        )}

        {printPedido && (
          <PrintTicketModal
            pedido={printPedido.pedido}
            tipo={printPedido.tipo}
            ticketConfig={ticketConfig}
            onClose={() => setPrintPedido(null)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="app-container">
      <div className="header">Mis Viajes <button className="header-btn" onClick={onLogout}>Salir</button></div>
      <div className="content">
        <div className="card">
          <div className="text-lg">Prueba GPS</div>
          <div className="text-sm">Envia tu ubicacion al mapa del sistema aunque no tengas viaje activo.</div>
          <button className={`btn ${gpsTestRunning ? 'btn-outline' : ''}`} onClick={toggleGpsTest}>
            <Navigation size={18} /> {gpsTestRunning ? 'Detener prueba GPS' : 'Iniciar prueba GPS'}
          </button>
        </div>
        {viajes.length === 0 ? (
          <div className="card text-center" style={{ padding: '2rem' }}>No hay viajes asignados</div>
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
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [choferId, setChoferId] = useState<string | null>(localStorage.getItem('choferId'));
  const handleLogin = (session: DriverSession) => {
    localStorage.setItem('choferId', session.choferId);
    localStorage.setItem('choferNombre', session.choferNombre);
    localStorage.setItem('choferToken', session.token);
    localStorage.setItem('choferRefreshToken', session.refreshToken);
    setChoferId(session.choferId);
  };
  const handleLogout = () => {
    localStorage.removeItem('choferId');
    localStorage.removeItem('choferNombre');
    localStorage.removeItem('choferToken');
    localStorage.removeItem('choferRefreshToken');
    setChoferId(null);
  };
  if (!choferId) return <Login onLogin={handleLogin} />;
  return <Viajes choferId={choferId} onLogout={handleLogout} />;
}
