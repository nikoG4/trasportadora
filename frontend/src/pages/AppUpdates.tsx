import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { AlertTriangle, Ban, CheckCircle, Pause, RefreshCw, RotateCcw, Rocket, Smartphone, Upload } from 'lucide-react';

type Release = {
  id: number;
  platform: string;
  channel: string;
  version_web: string;
  min_native_version?: string;
  max_native_version?: string;
  sha256: string;
  signature_algorithm: string;
  estado: string;
  rollout_percent: number;
  obligatorio: number;
  notas?: string;
  size_bytes: number;
  created_at: string;
  activated_at?: string;
  revoked_at?: string;
  total_events?: number;
  failed_events?: number;
};

type UpdateEvent = {
  id: number;
  release_id?: number;
  device_id?: string;
  event_type: string;
  status?: string;
  error?: string;
  bundle_version?: string;
  created_at: string;
};

type NativeApkConfig = {
  latest_native_version: string;
  min_supported_native_version: string;
  apk_url: string;
  obligatorio: number;
  notas: string;
  published_at?: string;
  size_bytes?: number;
};

function authHeaders(extra?: Record<string, string>) {
  const token = localStorage.getItem('adminToken');
  return {
    ...(extra || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

async function apiJson(path: string, options?: RequestInit) {
  const response = await fetch(path, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'No se pudo completar la operacion');
  return data;
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('No se pudo leer el archivo'));
    reader.readAsDataURL(file);
  });
}

function bytes(value: number) {
  if (!value) return '0 B';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function statusClass(status: string) {
  const value = String(status || '').toUpperCase();
  if (value === 'ACTIVE') return 'entregado';
  if (value === 'REVOKED') return 'cancelado';
  if (value === 'PAUSED') return 'asignado';
  return 'pendiente';
}

export default function AppUpdates() {
  const [releases, setReleases] = useState<Release[]>([]);
  const [events, setEvents] = useState<UpdateEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [apkFile, setApkFile] = useState<File | null>(null);
  const [nativeConfig, setNativeConfig] = useState<NativeApkConfig | null>(null);
  const [nativeForm, setNativeForm] = useState({
    latest_native_version: '',
    min_supported_native_version: '',
    apk_url: '',
    obligatorio: false,
    notas: ''
  });
  const [form, setForm] = useState({
    version_web: '',
    platform: 'android',
    channel: 'stable',
    min_native_version: '1.0.0',
    max_native_version: '',
    rollout_percent: 0,
    obligatorio: false,
    notas: ''
  });

  const activeStable = useMemo(
    () => releases.find(item => item.channel === 'stable' && item.estado === 'ACTIVE'),
    [releases]
  );

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [releaseData, eventData] = await Promise.all([
        apiJson('/api/app-updates/chofer/releases', { headers: authHeaders() }),
        apiJson('/api/app-updates/chofer/events', { headers: authHeaders() })
      ]);
      const nativeData = await apiJson('/api/app-updates/chofer/native', { headers: authHeaders() }).catch(() => null);
      setReleases(Array.isArray(releaseData) ? releaseData : []);
      setEvents(Array.isArray(eventData) ? eventData : []);
      if (nativeData) {
        setNativeConfig(nativeData);
        setNativeForm({
          latest_native_version: nativeData.latest_native_version || '',
          min_supported_native_version: nativeData.min_supported_native_version || '',
          apk_url: nativeData.apk_url || '',
          obligatorio: Boolean(nativeData.obligatorio),
          notas: nativeData.notas || ''
        });
      }
    } catch (err: any) {
      setError(err.message || 'No se pudo cargar OTA');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!file) {
      setError('Seleccione el ZIP generado desde app-chofer/dist.');
      return;
    }
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const dataUrl = await fileToDataUrl(file);
      await apiJson('/api/app-updates/chofer/releases', {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          ...form,
          rollout_percent: Number(form.rollout_percent || 0),
          zip_base64: dataUrl
        })
      });
      setMessage('Release creado en estado DRAFT.');
      setFile(null);
      setForm(prev => ({ ...prev, version_web: '', notas: '', rollout_percent: 0 }));
      await load();
    } catch (err: any) {
      setError(err.message || 'No se pudo crear release');
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (release: Release, estado: string, rollout?: number) => {
    setError('');
    setMessage('');
    try {
      await apiJson(`/api/app-updates/chofer/releases/${release.id}/status`, {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          estado,
          rollout_percent: rollout == null ? release.rollout_percent : rollout,
          obligatorio: Boolean(release.obligatorio)
        })
      });
      setMessage(`Release #${release.id} actualizado a ${estado}.`);
      await load();
    } catch (err: any) {
      setError(err.message || 'No se pudo cambiar estado');
    }
  };

  const rollback = async (release: Release) => {
    setError('');
    setMessage('');
    try {
      await apiJson(`/api/app-updates/chofer/releases/${release.id}/rollback`, {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' })
      });
      setMessage(`Rollback solicitado para release #${release.id}.`);
      await load();
    } catch (err: any) {
      setError(err.message || 'No se pudo hacer rollback');
    }
  };

  const submitNativeApk = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setMessage('');
    try {
      const apkBase64 = apkFile ? await fileToDataUrl(apkFile) : '';
      await apiJson('/api/app-updates/chofer/native', {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          ...nativeForm,
          apk_base64: apkBase64,
          obligatorio: nativeForm.obligatorio
        })
      });
      setApkFile(null);
      setMessage('APK nativa publicada. La app avisara cuando el chofer tenga una version vieja.');
      await load();
    } catch (err: any) {
      setError(err.message || 'No se pudo publicar APK');
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title"><Smartphone size={28} /> Actualizaciones app chofer</h1>
          <p style={{ color: '#6b7280', marginTop: '0.35rem' }}>OTA self-hosted para publicar HTML, CSS y JS sin reinstalar APK.</p>
        </div>
        <button className="btn btn-outline" onClick={load} disabled={loading}><RefreshCw size={16} /> Refrescar</button>
      </div>

      {error && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '0.75rem', borderRadius: 6, marginBottom: '1rem' }}>{error}</div>}
      {message && <div style={{ background: '#ecfdf5', color: '#065f46', padding: '0.75rem', borderRadius: 6, marginBottom: '1rem' }}>{message}</div>}

      <div className="dashboard-grid">
        <div className="stat-card">
          <div className="stat-title"><CheckCircle size={18} /> Stable activo</div>
          <div className="value">{activeStable?.version_web || 'Sin version'}</div>
          <p style={{ color: '#6b7280', marginTop: '0.5rem' }}>{activeStable ? `${activeStable.rollout_percent}% rollout` : 'No hay release activo en stable.'}</p>
        </div>
        <div className="stat-card">
          <div className="stat-title"><AlertTriangle size={18} /> Fallos reportados</div>
          <div className="value">{releases.reduce((sum, item) => sum + Number(item.failed_events || 0), 0)}</div>
          <p style={{ color: '#6b7280', marginTop: '0.5rem' }}>Ultimos eventos de descarga, ready y rollback.</p>
        </div>
      </div>

      <div className="stat-card">
        <h2 style={{ fontSize: '1.15rem', marginBottom: '1rem' }}><Upload size={18} className="inline-block mr-1" /> Nuevo bundle OTA</h2>
        <form onSubmit={submit}>
          <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}>
            <div className="form-group">
              <label>Version web</label>
              <input required value={form.version_web} onChange={e => setForm({ ...form, version_web: e.target.value })} placeholder="1.0.1" />
            </div>
            <div className="form-group">
              <label>Canal</label>
              <select value={form.channel} onChange={e => setForm({ ...form, channel: e.target.value })}>
                <option value="stable">stable</option>
                <option value="beta">beta</option>
                <option value="emergency">emergency</option>
              </select>
            </div>
            <div className="form-group">
              <label>Min APK</label>
              <input value={form.min_native_version} onChange={e => setForm({ ...form, min_native_version: e.target.value })} placeholder="1.0.0" />
            </div>
            <div className="form-group">
              <label>Max APK</label>
              <input value={form.max_native_version} onChange={e => setForm({ ...form, max_native_version: e.target.value })} placeholder="Opcional" />
            </div>
            <div className="form-group">
              <label>Rollout inicial</label>
              <input type="number" min={0} max={100} value={form.rollout_percent} onChange={e => setForm({ ...form, rollout_percent: Number(e.target.value) })} />
            </div>
            <div className="form-group">
              <label>ZIP dist</label>
              <input required type="file" accept=".zip,application/zip" onChange={e => setFile(e.target.files?.[0] || null)} />
            </div>
          </div>
          <div className="form-group">
            <label>Notas</label>
            <textarea rows={2} value={form.notas} onChange={e => setForm({ ...form, notas: e.target.value })} placeholder="Cambios principales, riesgos o instrucciones de prueba" />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <input type="checkbox" checked={form.obligatorio} onChange={e => setForm({ ...form, obligatorio: e.target.checked })} />
            Marcar como obligatorio
          </label>
          <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Subiendo...' : 'Crear release DRAFT'}</button>
        </form>
      </div>

      <div className="stat-card">
        <h2 style={{ fontSize: '1.15rem', marginBottom: '1rem' }}><Smartphone size={18} className="inline-block mr-1" /> APK nativa requerida</h2>
        <p style={{ color: '#6b7280', marginBottom: '1rem' }}>
          Use esto cuando el cambio requiere plugins, permisos, AndroidManifest, Firebase o codigo nativo. La app mostrara un aviso con boton de descarga.
        </p>
        {nativeConfig?.latest_native_version && (
          <div style={{ background: '#eff6ff', color: '#1e40af', padding: '0.75rem', borderRadius: 6, marginBottom: '1rem' }}>
            APK publicada: v{nativeConfig.latest_native_version}
            {nativeConfig.size_bytes ? ` - ${bytes(Number(nativeConfig.size_bytes))}` : ''}
            {nativeConfig.published_at ? ` - ${new Date(nativeConfig.published_at).toLocaleString()}` : ''}
          </div>
        )}
        <form onSubmit={submitNativeApk}>
          <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}>
            <div className="form-group">
              <label>Version APK nueva</label>
              <input required value={nativeForm.latest_native_version} onChange={e => setNativeForm({ ...nativeForm, latest_native_version: e.target.value })} placeholder="1.0.2" />
            </div>
            <div className="form-group">
              <label>Min APK soportada</label>
              <input value={nativeForm.min_supported_native_version} onChange={e => setNativeForm({ ...nativeForm, min_supported_native_version: e.target.value })} placeholder="1.0.2 si es obligatorio" />
            </div>
            <div className="form-group">
              <label>Subir APK</label>
              <input type="file" accept=".apk,application/vnd.android.package-archive" onChange={e => setApkFile(e.target.files?.[0] || null)} />
            </div>
            <div className="form-group">
              <label>O URL externa</label>
              <input value={nativeForm.apk_url} onChange={e => setNativeForm({ ...nativeForm, apk_url: e.target.value })} placeholder="https://..." />
            </div>
          </div>
          <div className="form-group">
            <label>Notas para choferes</label>
            <textarea rows={2} value={nativeForm.notas} onChange={e => setNativeForm({ ...nativeForm, notas: e.target.value })} placeholder="Ej: nueva impresion, permisos GPS, Firebase..." />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <input type="checkbox" checked={nativeForm.obligatorio} onChange={e => setNativeForm({ ...nativeForm, obligatorio: e.target.checked })} />
            Marcar APK como obligatoria
          </label>
          <button className="btn btn-primary" type="submit">Publicar aviso APK</button>
        </form>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Release</th>
              <th>Canal</th>
              <th>Estado</th>
              <th>Rollout</th>
              <th>Firma</th>
              <th>Eventos</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {releases.map(release => (
              <tr key={release.id}>
                <td>
                  <strong>#{release.id} {release.version_web}</strong>
                  <div style={{ color: '#6b7280', fontSize: '0.8rem' }}>{release.platform} - {bytes(release.size_bytes)}</div>
                  <div style={{ color: '#6b7280', fontSize: '0.75rem' }}>{String(release.sha256 || '').slice(0, 16)}...</div>
                </td>
                <td>{release.channel}</td>
                <td><span className={`status-badge ${statusClass(release.estado)}`}>{release.estado}</span></td>
                <td>{release.rollout_percent}%</td>
                <td>{release.signature_algorithm}</td>
                <td>{release.total_events || 0} total / {release.failed_events || 0} fallos</td>
                <td>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                    <button className="btn btn-outline" onClick={() => setStatus(release, 'ACTIVE', 10)}><Rocket size={14} /> 10%</button>
                    <button className="btn btn-outline" onClick={() => setStatus(release, 'ACTIVE', 100)}><Rocket size={14} /> 100%</button>
                    <button className="btn btn-outline" onClick={() => setStatus(release, 'PAUSED')}><Pause size={14} /> Pausar</button>
                    <button className="btn btn-outline" onClick={() => setStatus(release, 'REVOKED')}><Ban size={14} /> Revocar</button>
                    <button className="btn btn-outline" onClick={() => rollback(release)}><RotateCcw size={14} /> Rollback</button>
                  </div>
                </td>
              </tr>
            ))}
            {!releases.length && (
              <tr><td colSpan={7} style={{ textAlign: 'center', color: '#6b7280' }}>No hay releases OTA todavia.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Release</th>
              <th>Dispositivo</th>
              <th>Evento</th>
              <th>Estado/Error</th>
            </tr>
          </thead>
          <tbody>
            {events.slice(0, 50).map(event => (
              <tr key={event.id}>
                <td>{event.created_at ? new Date(event.created_at).toLocaleString() : ''}</td>
                <td>{event.release_id || event.bundle_version || '-'}</td>
                <td>{event.device_id || '-'}</td>
                <td>{event.event_type}</td>
                <td>{event.error || event.status || '-'}</td>
              </tr>
            ))}
            {!events.length && (
              <tr><td colSpan={5} style={{ textAlign: 'center', color: '#6b7280' }}>Sin eventos reportados.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
