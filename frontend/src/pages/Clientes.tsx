import { useEffect, useState, type FormEvent } from 'react';
import { Edit, Plus, X } from 'lucide-react';

export default function Clientes() {
  const [clientes, setClientes] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ nombre: '', ruc: '', direccion: '', telefono: '', latitud: '', longitud: '' });
  const [mapsLink, setMapsLink] = useState('');

  useEffect(() => {
    loadClientes();
  }, []);

  const loadClientes = () => {
    fetch('/api/clientes')
      .then(res => res.json())
      .then(data => setClientes(data))
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
    fetch(editingId ? `/api/clientes/${editingId}` : '/api/clientes', {
      method: editingId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    }).then(() => {
      setShowModal(false);
      setEditingId(null);
      setFormData({ nombre: '', ruc: '', direccion: '', telefono: '', latitud: '', longitud: '' });
      setMapsLink('');
      loadClientes();
    });
  };

  const openNew = () => {
    setEditingId(null);
    setFormData({ nombre: '', ruc: '', direccion: '', telefono: '', latitud: '', longitud: '' });
    setMapsLink('');
    setShowModal(true);
  };

  const openEdit = (cliente: any) => {
    setEditingId(cliente.id);
    setFormData({
      nombre: cliente.nombre || '',
      ruc: cliente.ruc || '',
      direccion: cliente.direccion || '',
      telefono: cliente.telefono || '',
      latitud: cliente.latitud === null || cliente.latitud === undefined ? '' : String(cliente.latitud),
      longitud: cliente.longitud === null || cliente.longitud === undefined ? '' : String(cliente.longitud)
    });
    setMapsLink('');
    setShowModal(true);
  };

  return (
    <div>
      <div className="page-header">
        <h1>Gestión de Clientes</h1>
        <button className="btn btn-primary" onClick={openNew}>
          <Plus size={20} /> Nuevo Cliente
        </button>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Nombre / Razón Social</th>
              <th>RUC</th>
              <th>Dirección</th>
              <th>Teléfono</th>
              <th>Latitud</th>
              <th>Longitud</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {clientes.map(c => (
              <tr key={c.id}>
                <td>{c.id}</td>
                <td>{c.nombre}</td>
                <td>{c.ruc}</td>
                <td>{c.direccion}</td>
                <td>{c.telefono}</td>
                <td>{c.latitud}</td>
                <td>{c.longitud}</td>
                <td><button className="btn btn-outline" onClick={() => openEdit(c)}><Edit size={16} /> Editar</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>{editingId ? 'Editar Cliente' : 'Nuevo Cliente'}</h2>
              <button onClick={() => { setShowModal(false); setEditingId(null); }} style={{background:'none',border:'none',cursor:'pointer'}}><X/></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Razón Social</label>
                <input name="nombre" required value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} />
              </div>
              <div className="form-group">
                <label>RUC</label>
                <input name="ruc" required value={formData.ruc} onChange={e => setFormData({...formData, ruc: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Dirección</label>
                <input name="direccion" required value={formData.direccion} onChange={e => setFormData({...formData, direccion: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Teléfono</label>
                <input name="telefono" required value={formData.telefono} onChange={e => setFormData({...formData, telefono: e.target.value})} />
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
              <button type="submit" className="btn btn-primary">Guardar</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
