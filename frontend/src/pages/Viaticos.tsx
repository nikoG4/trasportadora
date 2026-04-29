import { useState } from 'react';
import { Wallet, Plus, FileText, CheckCircle } from 'lucide-react';

export default function Viaticos() {
  const [showAsignarModal, setShowAsignarModal] = useState(false);
  const [showCerrarModal, setShowCerrarModal] = useState(false);
  const [selectedRendicion, setSelectedRendicion] = useState<any>(null);

  const [choferes] = useState([
    { id: 1, nombre: 'Luis Díaz', viaje: 'V-1025', asignado: 500000, gastado: 250000, pendiente: 250000, estado: 'En Tránsito' },
    { id: 2, nombre: 'Carlos R.', viaje: 'V-1026', asignado: 300000, gastado: 0, pendiente: 300000, estado: 'Pendiente' },
  ]);

  const [gastos] = useState([
    { id: 1, tipo: 'Combustible', monto: 200000, comprobante: 'Fac-001' },
    { id: 2, tipo: 'Peajes', monto: 50000, comprobante: 'Ticket-88' },
  ]);

  const handleCerrarRendicion = (chofer: any) => {
    setSelectedRendicion(chofer);
    setShowCerrarModal(true);
  };

  return (
    <div>
      <div className="header-actions">
        <h1 className="page-title"><Wallet className="inline-block mr-2" /> Viáticos y Rendiciones</h1>
        <button className="btn btn-primary" onClick={() => setShowAsignarModal(true)}>
          <Plus size={20} className="mr-2" /> Asignar Viático
        </button>
      </div>

      <div className="stat-card" style={{ marginBottom: '2rem', borderLeft: '4px solid #3b82f6' }}>
        <h3>Total Dinero en Calle (Activo)</h3>
        <p className="value" style={{ color: '#1d4ed8' }}>Gs. 550,000</p>
        <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>Dinero entregado a choferes pendiente de rendición.</p>
      </div>

      <div className="table-container">
        <h2 style={{ fontSize: '1.1rem', fontWeight: 'bold', padding: '1rem', borderBottom: '1px solid #e5e7eb' }}>Choferes con Dinero Activo</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>Chofer</th>
              <th>Viaje Activo</th>
              <th>Monto Asignado</th>
              <th>Gastos Reportados</th>
              <th>Saldo Pendiente</th>
              <th>Estado Rendición</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {choferes.map(c => (
              <tr key={c.id}>
                <td style={{ fontWeight: 'bold' }}>{c.nombre}</td>
                <td>{c.viaje}</td>
                <td>Gs. {c.asignado.toLocaleString()}</td>
                <td style={{ color: '#dc2626' }}>Gs. {c.gastado.toLocaleString()}</td>
                <td style={{ color: '#1d4ed8', fontWeight: 'bold' }}>Gs. {c.pendiente.toLocaleString()}</td>
                <td>
                  <span className={`status-badge status-${c.estado === 'En Tránsito' ? 'pendiente' : 'en_camino'}`}>
                    {c.estado}
                  </span>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn btn-outline" style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem' }}>
                      <FileText size={16} /> Detalle
                    </button>
                    <button className="btn btn-primary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem' }} onClick={() => handleCerrarRendicion(c)}>
                      <CheckCircle size={16} className="mr-1" /> Cerrar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal Asignar Viático */}
      {showAsignarModal && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>Asignar Viático</h2>
            <form onSubmit={(e) => { e.preventDefault(); setShowAsignarModal(false); }}>
              <div className="form-group">
                <label>Chofer</label>
                <select required>
                  <option>Seleccionar Chofer...</option>
                  <option>Luis Díaz</option>
                  <option>Carlos R.</option>
                </select>
              </div>
              <div className="form-group">
                <label>Viaje Asociado</label>
                <select required>
                  <option>Sin Viaje (Libre)</option>
                  <option>V-1027 (ASU - CDE)</option>
                </select>
              </div>
              <div className="form-group">
                <label>Monto (Gs.)</label>
                <input required type="number" placeholder="Ej: 500000" />
              </div>
              <div className="form-group">
                <label>Método de Pago</label>
                <select required>
                  <option>Efectivo (Extraer de Caja del Día)</option>
                  <option>Transferencia</option>
                </select>
              </div>
              <div className="form-group">
                <label>Concepto / Observación</label>
                <input type="text" placeholder="Combustible y vianda..." />
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowAsignarModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Confirmar Asignación</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Cerrar Rendición */}
      {showCerrarModal && selectedRendicion && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>Cerrar Rendición: {selectedRendicion.nombre}</h2>
            
            <div style={{ marginBottom: '1.5rem' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '0.5rem 0' }}>Viático Asignado</td>
                    <td style={{ padding: '0.5rem 0', textAlign: 'right', color: '#16a34a', fontWeight: 'bold' }}>(+) Gs. {selectedRendicion.asignado.toLocaleString()}</td>
                  </tr>
                  {gastos.map(g => (
                    <tr key={g.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '0.5rem 0', color: '#4b5563' }}>Gasto: {g.tipo} ({g.comprobante})</td>
                      <td style={{ padding: '0.5rem 0', textAlign: 'right', color: '#dc2626' }}>(-) Gs. {g.monto.toLocaleString()}</td>
                    </tr>
                  ))}
                  <tr style={{ background: '#f3f4f6', fontWeight: 'bold' }}>
                    <td style={{ padding: '0.75rem 0.5rem' }}>DIFERENCIA A RENDIR</td>
                    <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right', color: '#1d4ed8' }}>Gs. {selectedRendicion.pendiente.toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>
              <p style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.5rem', textAlign: 'right' }}>
                El chofer debe entregar este monto a Caja.
              </p>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); setShowCerrarModal(false); }}>
              <div className="form-group">
                <label>Acción de Cierre</label>
                <select required>
                  <option>El chofer devuelve Gs. {selectedRendicion.pendiente.toLocaleString()} (Ingreso a Caja)</option>
                  <option>Pasar saldo a Cuenta Corriente del Chofer (Descuento futuro)</option>
                </select>
              </div>
              <div className="form-group">
                <label>Monto Físico Devuelto (Gs.)</label>
                <input required type="number" defaultValue={selectedRendicion.pendiente} />
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '2rem' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowCerrarModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" style={{ background: '#16a34a', borderColor: '#16a34a' }}>Liquidar Rendición</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
