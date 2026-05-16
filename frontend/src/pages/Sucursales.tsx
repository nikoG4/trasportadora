import { useEffect, useState, type FormEvent } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Plus, X, Edit, Trash, MapPin } from 'lucide-react';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

function toNumber(value: any) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatCoord(value: any) {
  const parsed = toNumber(value);
  if (parsed === null) return 'Sin coordenadas';
  return parsed.toFixed(6);
}

function BranchMapPicker({ onPick }: { onPick: (latitud: number, longitud: number) => void }) {
  useMapEvents({
    click(event) {
      onPick(Number(event.latlng.lat.toFixed(6)), Number(event.latlng.lng.toFixed(6)));
    }
  });
  return null;
}

export default function Sucursales() {
  const [sucursales, setSucursales] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    nombre: '',
    codigo: '',
    direccion: '',
    telefono: '',
    ciudad: '',
    latitud: '',
    longitud: ''
  });
  const [mapsLink, setMapsLink] = useState('');
  const [defaultMap, setDefaultMap] = useState({ center: [-25.5167, -54.6167] as [number, number], zoom: 13 });
  const selectedLat = toNumber(formData.latitud);
  const selectedLng = toNumber(formData.longitud);
  const mapCenter: [number, number] = selectedLat !== null && selectedLng !== null ? [selectedLat, selectedLng] : defaultMap.center;

  useEffect(() => {
    loadSucursales();
  }, []);

  const loadSucursales = () => {
    fetch('/api/sucursales')
      .then(res => res.json())
      .then(data => setSucursales(data))
      .catch(console.error);
    fetch('/api/configuracion')
      .then(res => res.json())
      .then(data => {
        const byKey = Object.fromEntries((Array.isArray(data) ? data : []).map((item: any) => [item.clave, item.valor]));
        const lat = toNumber(byKey.map_default_lat);
        const lng = toNumber(byKey.map_default_lng);
        const zoom = toNumber(byKey.map_default_zoom);
        if (lat !== null && lng !== null) setDefaultMap({ center: [lat, lng], zoom: zoom !== null ? Math.min(19, Math.max(3, zoom)) : 13 });
      })
      .catch(() => undefined);
  };

  const handleParseMapsLink = async () => {
    if (!mapsLink) return;
    try {
      const res = await fetch('/api/utils/parse-maps-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ link: mapsLink })
      });
      const data = await res.json();
      if (data.latitud !== undefined && data.longitud !== undefined) {
        setFormData(prev => ({ ...prev, latitud: data.latitud.toString(), longitud: data.longitud.toString() }));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const method = editingId ? 'PUT' : 'POST';
    const url = editingId 
      ? `/api/sucursales/${editingId}`
      : '/api/sucursales';

    fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    }).then(async res => {
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'No se pudo guardar la sucursal');
      setShowModal(false);
      setEditingId(null);
      setFormData({ nombre: '', codigo: '', direccion: '', telefono: '', ciudad: '', latitud: '', longitud: '' });
      setMapsLink('');
      loadSucursales();
    }).catch(err => alert(err.message || 'No se pudo guardar la sucursal'));
  };

  const handleEdit = (sucursal: any) => {
    setEditingId(sucursal.id);
    setFormData({
      nombre: sucursal.nombre || '',
      codigo: sucursal.codigo || '',
      direccion: sucursal.direccion || '',
      telefono: sucursal.telefono || '',
      ciudad: sucursal.ciudad || '',
      latitud: sucursal.latitud ?? '',
      longitud: sucursal.longitud ?? ''
    });
    setMapsLink('');
    setShowModal(true);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('¿Está seguro de eliminar esta sucursal?')) {
      fetch(`/api/sucursales/${id}`, {
        method: 'DELETE'
      }).then(() => loadSucursales());
    }
  };

  const openNewModal = () => {
    setEditingId(null);
    setFormData({ nombre: '', codigo: '', direccion: '', telefono: '', ciudad: '', latitud: '', longitud: '' });
    setMapsLink('');
    setShowModal(true);
  };

  return (
    <div>
      <div className="page-header">
        <h1>Gestión de Sucursales</h1>
        <button className="btn btn-primary" onClick={openNewModal}>
          <Plus size={20} /> Nueva Sucursal
        </button>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Código</th>
              <th>Nombre</th>
              <th>Ciudad</th>
              <th>Dirección</th>
              <th>Teléfono</th>
              <th>Latitud</th>
              <th>Longitud</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {sucursales.map(s => (
              <tr key={s.id}>
                <td>{s.id}</td>
                <td>{s.codigo}</td>
                <td>{s.nombre}</td>
                <td>{s.ciudad}</td>
                <td>{s.direccion}</td>
                <td>{s.telefono}</td>
                <td>{formatCoord(s.latitud)}</td>
                <td>{formatCoord(s.longitud)}</td>
                <td>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn btn-outline" style={{ padding: '0.25rem' }} onClick={() => handleEdit(s)}>
                      <Edit size={16} />
                    </button>
                    <button className="btn btn-outline" style={{ padding: '0.25rem', color: '#dc2626', borderColor: '#fca5a5' }} onClick={() => handleDelete(s.id)}>
                      <Trash size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {sucursales.length === 0 && (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
                  No hay sucursales registradas
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>{editingId ? 'Editar Sucursal' : 'Nueva Sucursal'}</h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Código</label>
                <input name="codigo" required value={formData.codigo} onChange={e => setFormData({ ...formData, codigo: e.target.value })} placeholder="Ej: ASU-01" />
              </div>
              <div className="form-group">
                <label>Nombre</label>
                <input name="nombre" required value={formData.nombre} onChange={e => setFormData({ ...formData, nombre: e.target.value })} placeholder="Ej: Agencia Asunción Centro" />
              </div>
              <div className="form-group">
                <label>Ciudad</label>
                <input name="ciudad" required value={formData.ciudad} onChange={e => setFormData({ ...formData, ciudad: e.target.value })} placeholder="Ej: Asunción" />
              </div>
              <div className="form-group">
                <label>Dirección</label>
                <input name="direccion" required value={formData.direccion} onChange={e => setFormData({ ...formData, direccion: e.target.value })} placeholder="Dirección completa" />
              </div>
              <div className="form-group">
                <label>Teléfono</label>
                <input name="telefono" required value={formData.telefono} onChange={e => setFormData({ ...formData, telefono: e.target.value })} placeholder="Ej: +595..." />
              </div>
              <div className="form-group">
                <label>Enlace de Google Maps</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input value={mapsLink} onChange={e => setMapsLink(e.target.value)} placeholder="Pegue el enlace aquí" style={{ flex: 1 }} />
                  <button type="button" onClick={handleParseMapsLink} className="btn btn-outline">Extraer</button>
                </div>
              </div>
              <div className="form-group">
                <label>Latitud</label>
                <input name="latitud" value={formData.latitud} onChange={e => setFormData({ ...formData, latitud: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Longitud</label>
                <input name="longitud" value={formData.longitud} onChange={e => setFormData({ ...formData, longitud: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Ubicacion en mapa</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#4b5563', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                  <MapPin size={16} />
                  Haga clic en el mapa para marcar la sucursal.
                </div>
                <div style={{ height: 260, border: '1px solid #e5e7eb', borderRadius: '0.5rem', overflow: 'hidden' }}>
                  <MapContainer center={mapCenter} zoom={selectedLat !== null && selectedLng !== null ? 16 : defaultMap.zoom} style={{ height: '100%', width: '100%' }} key={`${mapCenter[0]}-${mapCenter[1]}-${defaultMap.zoom}-${editingId || 'new'}`}>
                    <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    <BranchMapPicker onPick={(latitud, longitud) => setFormData(prev => ({ ...prev, latitud: String(latitud), longitud: String(longitud) }))} />
                    {selectedLat !== null && selectedLng !== null && (
                      <Marker position={[selectedLat, selectedLng]}>
                        <Popup>
                          {formData.nombre || 'Sucursal'}<br />
                          {formatCoord(selectedLat)}, {formatCoord(selectedLng)}
                        </Popup>
                      </Marker>
                    )}
                  </MapContainer>
                </div>
              </div>
              <button type="submit" className="btn btn-primary" style={{ marginTop: '1rem', width: '100%', justifyContent: 'center' }}>Guardar</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
