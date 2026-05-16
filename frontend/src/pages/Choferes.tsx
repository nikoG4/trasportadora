import { useEffect, useState, type FormEvent } from 'react';
import { Edit, Plus, X } from 'lucide-react';

const emptyForm = {
  nombre: '',
  documento: '',
  licencia: '',
  telefono: '',
  vencimiento_licencia: '',
  estado: 'activo',
  empleado_id: '',
  username: '',
  password: ''
};

function authHeaders(extra?: Record<string, string>) {
  const token = localStorage.getItem('adminToken');
  return {
    ...(extra || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

export default function Choferes() {
  const [choferes, setChoferes] = useState<any[]>([]);
  const [empleados, setEmpleados] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState(emptyForm);

  useEffect(() => {
    loadChoferes();
    loadEmpleados();
  }, []);

  const loadChoferes = () => {
    fetch('/api/choferes')
      .then(res => res.json())
      .then(data => setChoferes(data))
      .catch(console.error);
  };

  const loadEmpleados = () => {
    fetch('/api/rrhh/empleados', { headers: authHeaders() })
      .then(res => res.json())
      .then(data => setEmpleados(Array.isArray(data) ? data : []))
      .catch(console.error);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
  };

  const openNew = () => {
    setEditingId(null);
    setFormData(emptyForm);
    setShowModal(true);
  };

  const openEdit = (chofer: any) => {
    setEditingId(chofer.id);
    setFormData({
      nombre: chofer.nombre || '',
      documento: chofer.documento || '',
      licencia: chofer.licencia || '',
      telefono: chofer.telefono || '',
      vencimiento_licencia: chofer.vencimiento_licencia || '',
      estado: chofer.estado || 'activo',
      empleado_id: chofer.empleado_id ? String(chofer.empleado_id) : '',
      username: chofer.username || '',
      password: ''
    });
    setShowModal(true);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    fetch(editingId ? `/api/choferes/${editingId}` : '/api/choferes', {
      method: editingId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    }).then(() => {
      closeModal();
      loadChoferes();
      loadEmpleados();
    });
  };

  return (
    <div>
      <div className="page-header">
        <h1>Gestion de Choferes</h1>
        <button className="btn btn-primary" onClick={openNew}>
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
              <th>Telefono</th>
              <th>Empleado RRHH</th>
              <th>Usuario App</th>
              <th>Estado</th>
              <th>Acciones</th>
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
                <td>{c.empleado_nombre || '-'}</td>
                <td>{c.username || '-'}</td>
                <td><span className={`status-badge ${c.estado === 'activo' ? 'entregado' : 'pendiente'}`}>{c.estado}</span></td>
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
              <h2>{editingId ? 'Editar Chofer' : 'Nuevo Chofer'}</h2>
              <button onClick={closeModal} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Empleado RRHH</label>
                <select value={formData.empleado_id} onChange={e => {
                  const empleado = empleados.find(item => String(item.id) === e.target.value);
                  setFormData({
                    ...formData,
                    empleado_id: e.target.value,
                    nombre: empleado?.nombre || formData.nombre,
                    documento: empleado?.documento || formData.documento,
                    telefono: empleado?.telefono || formData.telefono
                  });
                }}>
                  <option value="">Crear/actualizar empleado automaticamente</option>
                  {empleados.map(empleado => <option key={empleado.id} value={empleado.id}>{empleado.nombre} - {empleado.documento || 'sin doc.'}</option>)}
                </select>
                <small style={{ color: '#6b7280' }}>Un chofer tambien es empleado. Si no seleccionas uno, el sistema crea el empleado vinculado.</small>
              </div>
              <div className="form-group">
                <label>Nombre Completo</label>
                <input name="nombre" required value={formData.nombre} onChange={e => setFormData({ ...formData, nombre: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Documento</label>
                <input name="documento" required value={formData.documento} onChange={e => setFormData({ ...formData, documento: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Categoria Licencia</label>
                <input name="licencia" required value={formData.licencia} onChange={e => setFormData({ ...formData, licencia: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Vencimiento de Licencia</label>
                <input name="vencimiento_licencia" type="date" value={formData.vencimiento_licencia} onChange={e => setFormData({ ...formData, vencimiento_licencia: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Telefono</label>
                <input name="telefono" required value={formData.telefono} onChange={e => setFormData({ ...formData, telefono: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Estado</label>
                <select value={formData.estado} onChange={e => setFormData({ ...formData, estado: e.target.value })}>
                  <option value="activo">Activo</option>
                  <option value="inactivo">Inactivo</option>
                </select>
              </div>
              <div className="form-group">
                <label>Usuario para App Chofer</label>
                <input name="username" value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })} placeholder="Ej: pedro.chofer" />
              </div>
              <div className="form-group">
                <label>{editingId ? 'Nueva contrasena para App Chofer' : 'Contrasena para App Chofer'}</label>
                <input name="password" type="password" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} placeholder={editingId ? 'Dejar vacio para mantener' : 'Opcional al crear'} />
                <small style={{ color: '#6b7280' }}>Si completas usuario y contrasena, el chofer podra entrar a la app.</small>
              </div>
              <button type="submit" className="btn btn-primary">Guardar</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
