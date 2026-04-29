import { useState } from 'react';
import { TrendingUp, DollarSign, Search, CheckCircle } from 'lucide-react';

export default function Ingresos() {
  const [showIngresoModal, setShowIngresoModal] = useState(false);
  const [selectedServicio, setSelectedServicio] = useState<any>(null);

  const [servicios] = useState([
    { id: 1, fecha: '10/04/2026', guia: 'GUIA-900', cliente: 'Juan Perez', ruta: 'ASU - CDE', monto: 150000, condicion: 'Contado', estado: 'Pendiente' },
    { id: 2, fecha: '10/04/2026', guia: 'GUIA-901', cliente: 'Tech SRL', ruta: 'ASU - ENC', monto: 800000, condicion: 'Crédito 30d', estado: 'A Cuenta' },
  ]);

  const handleRegistrarIngreso = (servicio: any) => {
    setSelectedServicio(servicio);
    setShowIngresoModal(true);
  };

  return (
    <div>
      <div className="header-actions">
        <h1 className="page-title"><TrendingUp className="inline-block mr-2" /> Ingresos y Facturación</h1>
        <div style={{ position: 'relative' }}>
          <Search size={20} style={{ position: 'absolute', left: '0.75rem', top: '0.6rem', color: '#9ca3af' }} />
          <input type="text" placeholder="Buscar guía o cliente..." className="form-control" style={{ paddingLeft: '2.5rem', width: '300px' }} />
        </div>
      </div>

      <div className="table-container">
        <h2 style={{ fontSize: '1.1rem', fontWeight: 'bold', padding: '1rem', borderBottom: '1px solid #e5e7eb' }}>Servicios Pendientes de Cobro / Facturación</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>Fecha Servicio</th>
              <th>Nro Guía</th>
              <th>Cliente</th>
              <th>Origen - Destino</th>
              <th>Monto Servicio</th>
              <th>Condición</th>
              <th>Estado Cobro</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {servicios.map(s => (
              <tr key={s.id}>
                <td>{s.fecha}</td>
                <td style={{ fontWeight: 'bold' }}>{s.guia}</td>
                <td>{s.cliente}</td>
                <td>{s.ruta}</td>
                <td style={{ fontWeight: 'bold' }}>Gs. {s.monto.toLocaleString()}</td>
                <td>{s.condicion}</td>
                <td>
                  <span className={`status-badge status-${s.estado === 'Pendiente' ? 'pendiente' : 'en_camino'}`}>
                    {s.estado}
                  </span>
                </td>
                <td>
                  {s.condicion === 'Contado' ? (
                    <button className="btn btn-primary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem' }} onClick={() => handleRegistrarIngreso(s)}>
                      <DollarSign size={16} className="mr-1" /> Registrar Ingreso
                    </button>
                  ) : (
                    <button className="btn btn-outline" style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem' }}>
                      Ver en Cta. Cte.
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal Registrar Ingreso (Contado) */}
      {showIngresoModal && selectedServicio && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>Registrar Ingreso en Mostrador</h2>
            
            <div style={{ background: '#f3f4f6', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ color: '#6b7280' }}>Guía Nro:</span>
                <span style={{ fontWeight: 'bold' }}>{selectedServicio.guia}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ color: '#6b7280' }}>Cliente:</span>
                <span>{selectedServicio.cliente}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem' }}>
                <span style={{ color: '#6b7280' }}>Monto Total:</span>
                <span style={{ fontWeight: 'bold', color: '#16a34a' }}>Gs. {selectedServicio.monto.toLocaleString()}</span>
              </div>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); setShowIngresoModal(false); }}>
              <div className="form-group">
                <label>Monto Recibido (Gs.)</label>
                <input required type="number" defaultValue={selectedServicio.monto} />
              </div>
              <div className="form-group">
                <label>Método de Pago</label>
                <select required>
                  <option>Efectivo (Caja Central)</option>
                  <option>Transferencia</option>
                  <option>POS / Tarjeta</option>
                </select>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '2rem' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowIngresoModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">
                  <CheckCircle size={20} className="mr-2" /> Confirmar Cobro
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
