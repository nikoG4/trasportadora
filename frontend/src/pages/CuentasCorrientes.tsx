import { useState } from 'react';
import { CreditCard, Eye, DollarSign, Search, AlertCircle } from 'lucide-react';

export default function CuentasCorrientes() {
  const [showLedgerModal, setShowLedgerModal] = useState(false);
  const [showPagoModal, setShowPagoModal] = useState(false);
  const [selectedCliente, setSelectedCliente] = useState<any>(null);

  const [clientes] = useState([
    { id: 1, nombre: 'Supermercados Stock', ruc: '80012345-6', limite: 10000000, deudaTotal: 4500000, deudaVencida: 0, antiguedad: '15 días', estado: 'Al Día' },
    { id: 2, nombre: 'Farmacenter SA', ruc: '80098765-4', limite: 5000000, deudaTotal: 6200000, deudaVencida: 3000000, antiguedad: '45 días', estado: 'Moroso' },
  ]);

  const [ledger] = useState([
    { fecha: '01/04/2026', ref: 'FAC-001', tipo: 'Factura', concepto: 'Flete ASU-CDE', debito: 1500000, credito: 0, saldo: 1500000 },
    { fecha: '05/04/2026', ref: 'FAC-002', tipo: 'Factura', concepto: 'Flete ASU-ENC', debito: 2000000, credito: 0, saldo: 3500000 },
    { fecha: '10/04/2026', ref: 'RC-088', tipo: 'Recibo', concepto: 'Pago Transferencia', debito: 0, credito: 1500000, saldo: 2000000 },
  ]);

  return (
    <div>
      <div className="header-actions">
        <h1 className="page-title"><CreditCard className="inline-block mr-2" /> Cuentas Corrientes (Clientes)</h1>
        <div style={{ position: 'relative' }}>
          <Search size={20} style={{ position: 'absolute', left: '0.75rem', top: '0.6rem', color: '#9ca3af' }} />
          <input type="text" placeholder="Buscar cliente o RUC..." className="form-control" style={{ paddingLeft: '2.5rem', width: '300px' }} />
        </div>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Cliente / RUC</th>
              <th>Límite Crédito</th>
              <th>Deuda Total</th>
              <th>Deuda Vencida</th>
              <th>Antigüedad</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {clientes.map(c => (
              <tr key={c.id}>
                <td>
                  <div style={{ fontWeight: 'bold' }}>{c.nombre}</div>
                  <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>RUC: {c.ruc}</div>
                </td>
                <td>Gs. {c.limite.toLocaleString()}</td>
                <td style={{ fontWeight: 'bold', color: c.estado === 'Moroso' ? '#dc2626' : '#374151' }}>Gs. {c.deudaTotal.toLocaleString()}</td>
                <td style={{ color: c.deudaVencida > 0 ? '#dc2626' : '#6b7280' }}>Gs. {c.deudaVencida.toLocaleString()}</td>
                <td>{c.antiguedad}</td>
                <td>
                  <span className={`status-badge status-${c.estado === 'Al Día' ? 'entregado' : 'cancelado'}`}>
                    {c.estado}
                  </span>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn btn-outline" style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem' }} onClick={() => { setSelectedCliente(c); setShowLedgerModal(true); }}>
                      <Eye size={16} className="mr-1" /> Ledger
                    </button>
                    <button className="btn btn-primary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem' }} onClick={() => { setSelectedCliente(c); setShowPagoModal(true); }}>
                      <DollarSign size={16} className="mr-1" /> Cobrar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal Ledger */}
      {showLedgerModal && selectedCliente && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '800px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>Estado de Cuenta: {selectedCliente.nombre}</h2>
              <button className="btn btn-outline" onClick={() => setShowLedgerModal(false)}>Cerrar</button>
            </div>
            
            <div style={{ display: 'flex', gap: '2rem', marginBottom: '1rem', padding: '1rem', background: '#f9fafb', borderRadius: '0.5rem' }}>
              <div>
                <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>Límite de Crédito</p>
                <p style={{ fontWeight: 'bold' }}>Gs. {selectedCliente.limite.toLocaleString()}</p>
              </div>
              <div>
                <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>Deuda Total</p>
                <p style={{ fontWeight: 'bold', color: '#dc2626' }}>Gs. {selectedCliente.deudaTotal.toLocaleString()}</p>
              </div>
              <div>
                <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>Deuda Vencida</p>
                <p style={{ fontWeight: 'bold', color: '#dc2626' }}>Gs. {selectedCliente.deudaVencida.toLocaleString()}</p>
              </div>
            </div>

            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              <table className="data-table" style={{ fontSize: '0.875rem' }}>
                <thead style={{ position: 'sticky', top: 0, background: '#f3f4f6' }}>
                  <tr>
                    <th>Fecha</th>
                    <th>Ref</th>
                    <th>Tipo</th>
                    <th>Concepto</th>
                    <th>Débito (Facturado)</th>
                    <th>Crédito (Pagos)</th>
                    <th>Saldo General</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.map((l, i) => (
                    <tr key={i}>
                      <td>{l.fecha}</td>
                      <td style={{ fontWeight: 'bold' }}>{l.ref}</td>
                      <td>{l.tipo}</td>
                      <td>{l.concepto}</td>
                      <td style={{ color: '#dc2626' }}>{l.debito > 0 ? `Gs. ${l.debito.toLocaleString()}` : ''}</td>
                      <td style={{ color: '#16a34a' }}>{l.credito > 0 ? `Gs. ${l.credito.toLocaleString()}` : ''}</td>
                      <td style={{ fontWeight: 'bold' }}>Gs. {l.saldo.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal Registrar Pago */}
      {showPagoModal && selectedCliente && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>Registrar Pago - {selectedCliente.nombre}</h2>
            
            {selectedCliente.estado === 'Moroso' && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem', display: 'flex', gap: '0.5rem' }}>
                <AlertCircle style={{ color: '#ef4444' }} size={20} />
                <span style={{ color: '#991b1b', fontSize: '0.875rem' }}>El cliente se encuentra bloqueado por morosidad.</span>
              </div>
            )}

            <form onSubmit={(e) => { e.preventDefault(); setShowPagoModal(false); }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label>Monto a Pagar (Gs.)</label>
                  <input required type="number" defaultValue={selectedCliente.deudaTotal} />
                </div>
                <div className="form-group">
                  <label>Método de Pago</label>
                  <select required>
                    <option>Transferencia Bancaria</option>
                    <option>Efectivo (Ingresa a Caja)</option>
                    <option>Cheque a la vista</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Referencia Bancaria / Nro Cheque</label>
                <input type="text" placeholder="Ej: 0045889" />
              </div>
              
              <div className="form-group" style={{ marginTop: '1rem' }}>
                <label>Aplicar a Documentos (Amortización)</label>
                <div style={{ border: '1px solid #e5e7eb', borderRadius: '0.375rem', padding: '0.5rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem', borderBottom: '1px solid #f3f4f6' }}>
                    <input type="checkbox" defaultChecked />
                    <span>FAC-001 - Gs. 1,500,000 (Vencida)</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem' }}>
                    <input type="checkbox" />
                    <span>FAC-002 - Gs. 2,000,000</span>
                  </label>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '2rem' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowPagoModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Confirmar Cobro</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
