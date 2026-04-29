import { useEffect, useState, type FormEvent } from 'react';
import { Plus, X, Edit, Trash } from 'lucide-react';

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

  useEffect(() => {
    loadSucursales();
  }, []);

  const loadSucursales = () => {
    fetch('/api/sucursales')
      .then(res => res.json())
      .then(data => setSucursales(data))
      .catch(console.error);
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
      if (data.latitud && data.longitud) {
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
    }).then(() => {
      setShowModal(false);
      setEditingId(null);
      setFormData({ nombre: '', codigo: '', direccion: '', telefono: '', ciudad: '', latitud: '', longitud: '' });
      setMapsLink('');
      loadSucursales();
    });
  };

  const handleEdit = (sucursal: any) => {
    setEditingId(sucursal.id);
    setFormData({
      nombre: sucursal.nombre || '',
      codigo: sucursal.codigo || '',
      direccion: sucursal.direccion || '',
      telefono: sucursal.telefono || '',
      ciudad: sucursal.ciudad || '',
      latitud: sucursal.latitud || '',
      longitud: sucursal.longitud || ''
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
                <td>{s.latitud}</td>
                <td>{s.longitud}</td>
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
              <button type="submit" className="btn btn-primary" style={{ marginTop: '1rem', width: '100%', justifyContent: 'center' }}>Guardar</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
