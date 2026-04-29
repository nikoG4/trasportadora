import { useEffect, useState, type FormEvent } from 'react';
import { Plus, X } from 'lucide-react';

export default function Choferes() {
  const [choferes, setChoferes] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ nombre: '', documento: '', licencia: '', telefono: '', vencimiento_licencia: '', username: '', password: '' });

  useEffect(() => {
    loadChoferes();
  }, []);

  const loadChoferes = () => {
    fetch('/api/choferes')
      .then(res => res.json())
      .then(data => setChoferes(data))
      .catch(console.error);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    fetch('/api/choferes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    }).then(() => {
      setShowModal(false);
      loadChoferes();
    });
  };

  return (
    <div>
      <div className="page-header">
        <h1>Gestión de Choferes</h1>
        <button className="btn btn-primary" onClick={() => {
          setFormData({ nombre: '', documento: '', licencia: '', telefono: '', vencimiento_licencia: '', username: '', password: '' });
          setShowModal(true);
        }}>
          <Plus size={20} /> Nuevo Chofer
        </button>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Nombre</th>
              <th>Documento</th>
              <th>Licencia</th>
              <th>Venc. Licencia</th>
              <th>Teléfono</th>
              <th>Usuario App</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {choferes.map(c => (
              <tr key={c.id}>
                <td>{c.id}</td>
                <td>{c.nombre}</td>
                <td>{c.documento}</td>
                <td>{c.licencia}</td>
                <td>{c.vencimiento_licencia}</td>
                <td>{c.telefono}</td>
                <td>{c.username || '-'}</td>
                <td><span className={`status-badge ${c.estado === 'activo' ? 'entregado' : 'pendiente'}`}>{c.estado}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Nuevo Chofer</h2>
              <button onClick={() => setShowModal(false)} style={{background:'none',border:'none',cursor:'pointer'}}><X/></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Nombre Completo</label>
                <input name="nombre" required value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Documento</label>
                <input name="documento" required value={formData.documento} onChange={e => setFormData({...formData, documento: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Categoría Licencia</label>
                <input name="licencia" required value={formData.licencia} onChange={e => setFormData({...formData, licencia: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Vencimiento de Licencia</label>
                <input name="vencimiento_licencia" type="date" value={formData.vencimiento_licencia} onChange={e => setFormData({...formData, vencimiento_licencia: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Teléfono</label>
                <input name="telefono" required value={formData.telefono} onChange={e => setFormData({...formData, telefono: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Usuario para App Chofer</label>
                <input name="username" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} placeholder="Ej: pedro.chofer" />
              </div>
              <div className="form-group">
                <label>ContraseÃ±a para App Chofer</label>
                <input name="password" type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} placeholder="Opcional al crear" />
                <small style={{ color: '#6b7280' }}>Si completÃ¡s estos campos, el chofer podrÃ¡ entrar a la app con usuario y contraseÃ±a.</small>
              </div>
              <button type="submit" className="btn btn-primary">Guardar</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
