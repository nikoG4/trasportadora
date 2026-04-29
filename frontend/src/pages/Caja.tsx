import { useState } from 'react';
import { DollarSign, Plus, Lock, Unlock, AlertCircle, TrendingDown, TrendingUp } from 'lucide-react';

export default function Caja() {
  const [estadoCaja, setEstadoCaja] = useState<'cerrada' | 'abierta'>('cerrada');
  const [showAbrirModal, setShowAbrirModal] = useState(false);
  const [showCerrarModal, setShowCerrarModal] = useState(false);
  const [showMovimientoModal, setShowMovimientoModal] = useState(false);

  // Datos simulados
  const saldoInicial = 500000;
  const ingresos = 1500000;
  const egresos = 300000;
  const saldoActual = saldoInicial + ingresos - egresos;

  const [movimientos] = useState([
    { id: 1, hora: '08:15', ref: 'AP-001', concepto: 'Apertura de Caja', categoria: 'Operativo', metodo: 'Efectivo', entidad: '-', ingreso: 500000, egreso: 0, usuario: 'admin' },
    { id: 2, hora: '09:30', ref: 'VI-102', concepto: 'Viático Viaje #45', categoria: 'Viáticos', metodo: 'Efectivo', entidad: 'Chofer: Luis Díaz', ingreso: 0, egreso: 150000, usuario: 'admin' },
    { id: 3, hora: '11:00', ref: 'RC-889', concepto: 'Pago Fac #1010', categoria: 'Cobro', metodo: 'Transferencia', entidad: 'Cliente: Tech SRL', ingreso: 800000, egreso: 0, usuario: 'admin' },
  ]);

  return (
    <div>
      <div className="header-actions">
        <h1 className="page-title"><DollarSign className="inline-block mr-2" /> Caja del Día</h1>
        <div style={{ display: 'flex', gap: '1rem' }}>
          {estadoCaja === 'cerrada' ? (
            <button className="btn btn-primary" onClick={() => setShowAbrirModal(true)}>
              <Unlock size={20} className="mr-2" /> Abrir Caja
            </button>
          ) : (
            <>
              <button className="btn btn-outline" onClick={() => setShowMovimientoModal(true)}>
                <Plus size={20} className="mr-2" /> Registrar Movimiento
              </button>
              <button className="btn btn-primary" style={{ background: '#dc2626', borderColor: '#dc2626', color: 'white' }} onClick={() => setShowCerrarModal(true)}>
                <Lock size={20} className="mr-2" /> Cerrar Caja
              </button>
            </>
          )}
        </div>
      </div>

      {estadoCaja === 'abierta' ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
            <div className="stat-card">
              <h3>Saldo Inicial</h3>
              <p className="value">Gs. {saldoInicial.toLocaleString()}</p>
            </div>
            <div className="stat-card">
              <h3><TrendingUp size={16} className="inline-block mr-1 text-green-600" /> Ingresos</h3>
              <p className="value" style={{ color: '#16a34a' }}>Gs. {ingresos.toLocaleString()}</p>
            </div>
            <div className="stat-card">
              <h3><TrendingDown size={16} className="inline-block mr-1 text-red-600" /> Egresos</h3>
              <p className="value" style={{ color: '#dc2626' }}>Gs. {egresos.toLocaleString()}</p>
            </div>
            <div className="stat-card" style={{ background: '#eff6ff', borderColor: '#bfdbfe' }}>
              <h3>Saldo Actual Estimado</h3>
              <p className="value" style={{ color: '#1d4ed8' }}>Gs. {saldoActual.toLocaleString()}</p>
            </div>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Hora</th>
                  <th>Ref/Comprobante</th>
                  <th>Concepto</th>
                  <th>Categoría</th>
                  <th>Método</th>
                  <th>Entidad</th>
                  <th>Ingreso</th>
                  <th>Egreso</th>
                  <th>Usuario</th>
                </tr>
              </thead>
              <tbody>
                {movimientos.map(m => (
                  <tr key={m.id}>
                    <td>{m.hora}</td>
                    <td>{m.ref}</td>
                    <td>{m.concepto}</td>
                    <td><span className="status-badge" style={{ background: '#f3f4f6', color: '#374151' }}>{m.categoria}</span></td>
                    <td>{m.metodo}</td>
                    <td>{m.entidad}</td>
                    <td style={{ color: '#16a34a', fontWeight: m.ingreso > 0 ? 'bold' : 'normal' }}>{m.ingreso > 0 ? `Gs. ${m.ingreso.toLocaleString()}` : '-'}</td>
                    <td style={{ color: '#dc2626', fontWeight: m.egreso > 0 ? 'bold' : 'normal' }}>{m.egreso > 0 ? `Gs. ${m.egreso.toLocaleString()}` : '-'}</td>
                    <td>{m.usuario}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div style={{ textAlign: 'center', padding: '4rem 2rem', background: 'white', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}>
          <Lock size={64} style={{ color: '#9ca3af', margin: '0 auto 1rem' }} />
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>La caja está cerrada</h2>
          <p style={{ color: '#6b7280', marginBottom: '2rem' }}>Abre la caja para comenzar a registrar operaciones del día.</p>
          <button className="btn btn-primary" style={{ margin: '0 auto' }} onClick={() => setShowAbrirModal(true)}>Abrir Caja Ahora</button>
        </div>
      )}

      {/* Modal Abrir Caja */}
      {showAbrirModal && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>Abrir Caja</h2>
            <form onSubmit={(e) => { e.preventDefault(); setEstadoCaja('abierta'); setShowAbrirModal(false); }}>
              <div className="form-group">
                <label>Sucursal</label>
                <select disabled><option>Asunción Central (Asignada)</option></select>
              </div>
              <div className="form-group">
                <label>Monto Inicial Efectivo (Gs.)</label>
                <input required type="number" defaultValue="500000" />
              </div>
              <div className="form-group">
                <label>Observaciones (Opcional)</label>
                <input type="text" placeholder="Ej: Cambio en caja chica" />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowAbrirModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Confirmar Apertura</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Registrar Movimiento */}
      {showMovimientoModal && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>Registrar Movimiento Manual</h2>
            <form onSubmit={(e) => { e.preventDefault(); setShowMovimientoModal(false); }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label>Tipo de Movimiento</label>
                  <select required>
                    <option value="ingreso">Ingreso</option>
                    <option value="egreso">Egreso</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Categoría</label>
                  <select required>
                    <option>Pago Proveedor</option>
                    <option>Gasto Operativo</option>
                    <option>Cobro Cliente</option>
                    <option>Viático</option>
                    <option>Otros</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label>Método de Pago</label>
                  <select required>
                    <option>Efectivo</option>
                    <option>Transferencia</option>
                    <option>Cheque</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Monto (Gs.)</label>
                  <input required type="number" placeholder="0" />
                </div>
              </div>
              <div className="form-group">
                <label>Entidad Asociada / Proveedor / Cliente</label>
                <input type="text" placeholder="Buscar..." />
              </div>
              <div className="form-group">
                <label>Referencia / Nro Comprobante</label>
                <input type="text" placeholder="Ej: Ticket #1234" />
              </div>
              <div className="form-group">
                <label>Descripción</label>
                <textarea rows={2} placeholder="Motivo del movimiento..." className="form-control" style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '0.375rem' }}></textarea>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowMovimientoModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Guardar Movimiento</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Cerrar Caja */}
      {showCerrarModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>Cierre de Caja y Arqueo</h2>
            
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1.5rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
              <AlertCircle style={{ color: '#ef4444', flexShrink: 0 }} />
              <div>
                <h4 style={{ color: '#991b1b', fontWeight: 'bold', margin: 0 }}>Validación de Rendiciones</h4>
                <p style={{ color: '#b91c1c', fontSize: '0.875rem', margin: 0 }}>Existen choferes con saldo a favor pendiente de rendición. Se recomienda cerrar las rendiciones antes de arquear la caja.</p>
              </div>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); setEstadoCaja('cerrada'); setShowCerrarModal(false); }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                <div>
                  <h3 style={{ fontWeight: 'bold', marginBottom: '1rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.5rem' }}>Sistema</h3>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}><span>Saldo Inicial:</span> <span>Gs. {saldoInicial.toLocaleString()}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', color: '#16a34a' }}><span>Ingresos:</span> <span>Gs. {ingresos.toLocaleString()}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', color: '#dc2626' }}><span>Egresos:</span> <span>Gs. {egresos.toLocaleString()}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '1.1rem' }}><span>Total Esperado:</span> <span>Gs. {saldoActual.toLocaleString()}</span></div>
                </div>
                <div>
                  <h3 style={{ fontWeight: 'bold', marginBottom: '1rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.5rem' }}>Arqueo Físico</h3>
                  <div className="form-group">
                    <label>Efectivo en Caja (Gs.)</label>
                    <input required type="number" defaultValue={saldoActual} />
                  </div>
                  <div className="form-group">
                    <label>Total Transferencias/Otros</label>
                    <input required type="number" defaultValue="0" />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', marginTop: '1rem', color: '#1d4ed8' }}>
                    <span>Diferencia:</span> <span>Gs. 0</span>
                  </div>
                </div>
              </div>
              
              <div className="form-group" style={{ marginTop: '1rem' }}>
                <label>Justificación de Diferencia (Obligatorio si hay faltante/sobrante)</label>
                <input type="text" placeholder="Ej: Vuelto no entregado, etc." />
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '2rem' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowCerrarModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" style={{ background: '#dc2626', borderColor: '#dc2626' }}>Confirmar Cierre</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
