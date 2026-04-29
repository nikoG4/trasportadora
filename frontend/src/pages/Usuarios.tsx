import { useEffect, useState, type FormEvent } from 'react';
import { Plus, X, Trash2 } from 'lucide-react';

function authHeaders() {
  const token = localStorage.getItem('adminToken');
  return token ? { Authorization: `Bearer ${token}` } as Record<string, string> : {};
}

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [choferes, setChoferes] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ username: '', password: '', role: 'operador', chofer_id: '' });

  useEffect(() => {
    loadUsuarios();
    fetch('/api/choferes').then(res => res.json()).then(setChoferes).catch(console.error);
  }, []);

  const loadUsuarios = () => {
    fetch('/api/usuarios', { headers: authHeaders() })
      .then(res => res.json())
      .then(setUsuarios);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    fetch('/api/usuarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(formData)
    }).then(res => {
      if (res.ok) {
        setShowModal(false);
        loadUsuarios();
      } else {
        alert('Error al crear usuario. Podría ya existir.');
      }
    });
  };

  const handleDelete = (id: number) => {
    if (confirm('¿Eliminar usuario?')) {
      fetch(`/api/usuarios/${id}`, { method: 'DELETE', headers: authHeaders() })
        .then(loadUsuarios);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>Gestión de Usuarios y Roles</h1>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={20} /> Nuevo Usuario
        </button>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Usuario</th>
              <th>Rol (Permisos)</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map(u => (
              <tr key={u.id}>
                <td>{u.id}</td>
                <td>{u.username}</td>
                <td>
                  <span className={`status-badge ${['admin', 'admin_empresa', 'superadmin_saas'].includes(u.role) ? 'en_curso' : 'asignado'}`}>
                    {u.role}
                  </span>
                  {u.role === 'chofer' && u.chofer_id ? <small style={{ marginLeft: '0.5rem', color: '#6b7280' }}>Chofer #{u.chofer_id}</small> : null}
                </td>
                <td>
                  {u.username !== 'admin' && (
                    <button className="btn btn-outline" style={{ padding: '0.25rem', borderColor: 'red', color: 'red' }} onClick={() => handleDelete(u.id)}>
                      <Trash2 size={16} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Crear Nuevo Usuario</h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Nombre de Usuario</label>
                <input required value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Contraseña</label>
                <input type="password" required value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Rol</label>
                <select required value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })}>
                  <option value="operador">Operador (Gestión de viajes y despachos)</option>
                  <option value="chofer">Chofer (App mÃ³vil)</option>
                  <option value="admin">Administrador (Acceso total al sistema y SaaS)</option>
                </select>
                <small style={{ color: '#6b7280', display: 'block', marginTop: '0.25rem' }}>
                  El rol Administrador tiene acceso a la Configuración SaaS, Reportes financieros y ABM de Usuarios.
                </small>
              </div>
              {formData.role === 'chofer' && (
                <div className="form-group">
                  <label>Perfil de Chofer</label>
                  <select required value={formData.chofer_id} onChange={e => setFormData({ ...formData, chofer_id: e.target.value })}>
                    <option value="">Seleccione un chofer</option>
                    {choferes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                </div>
              )}
              <button type="submit" className="btn btn-primary" style={{ marginTop: '1rem' }}>Guardar Usuario</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
