import { useEffect, useState } from 'react';
import { Search, ShieldCheck } from 'lucide-react';

type AuditRow = {
  id: number;
  accion: string;
  entidad: string;
  entidad_id: string;
  username: string;
  ip: string;
  fecha: string;
  antes_json: string | null;
  despues_json: string | null;
};

function authHeaders() {
  const token = localStorage.getItem('adminToken');
  return token ? { Authorization: `Bearer ${token}` } as Record<string, string> : {};
}

export default function Auditoria() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [accion, setAccion] = useState('');
  const [entidad, setEntidad] = useState('');

  const loadRows = () => {
    const params = new URLSearchParams();
    if (accion) params.set('accion', accion);
    if (entidad) params.set('entidad', entidad);
    fetch(`/api/auditoria?${params.toString()}`, { headers: authHeaders() })
      .then(res => res.json())
      .then(data => setRows(Array.isArray(data) ? data : []));
  };

  useEffect(() => {
    loadRows();
  }, []);

  return (
    <div>
      <div className="page-header">
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ShieldCheck size={28} /> Auditoria
        </h1>
      </div>

      <div className="stat-card">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '1rem', alignItems: 'end' }}>
          <div className="form-group">
            <label>Accion</label>
            <input value={accion} onChange={e => setAccion(e.target.value)} placeholder="pedido, login, factura..." />
          </div>
          <div className="form-group">
            <label>Entidad</label>
            <input value={entidad} onChange={e => setEntidad(e.target.value)} placeholder="pedidos, users, facturas..." />
          </div>
          <button className="btn btn-primary" onClick={loadRows}>
            <Search size={16} /> Filtrar
          </button>
        </div>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Usuario</th>
              <th>Accion</th>
              <th>Entidad</th>
              <th>ID</th>
              <th>IP</th>
              <th>Detalle</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.id}>
                <td>{new Date(row.fecha).toLocaleString()}</td>
                <td>{row.username || '-'}</td>
                <td>{row.accion}</td>
                <td>{row.entidad}</td>
                <td>{row.entidad_id || '-'}</td>
                <td>{row.ip || '-'}</td>
                <td style={{ maxWidth: 320, fontSize: '0.8rem', color: '#4b5563' }}>
                  {row.despues_json ? row.despues_json.slice(0, 180) : '-'}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', color: '#6b7280' }}>Sin registros de auditoria</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
