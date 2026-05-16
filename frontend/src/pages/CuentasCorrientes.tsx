import { useEffect, useMemo, useState } from 'react';
import { CreditCard, Eye, DollarSign, Search, AlertCircle } from 'lucide-react';

function money(value: number) {
  return `Gs. ${Number(value || 0).toLocaleString()}`;
}

export default function CuentasCorrientes() {
  const [showLedgerModal, setShowLedgerModal] = useState(false);
  const [showPagoModal, setShowPagoModal] = useState(false);
  const [selectedCliente, setSelectedCliente] = useState<any>(null);
  const [clientes, setClientes] = useState<any[]>([]);
  const [ledger, setLedger] = useState<any[]>([]);
  const [search, setSearch] = useState('');

  const loadClientes = () => {
    fetch('/api/cuentas-corrientes')
      .then(res => res.json())
      .then(data => setClientes(Array.isArray(data) ? data : []))
      .catch(() => setClientes([]));
  };

  useEffect(() => {
    loadClientes();
  }, []);

  const filteredClientes = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return clientes;
    return clientes.filter(cliente => `${cliente.nombre} ${cliente.ruc || ''}`.toLowerCase().includes(term));
  }, [clientes, search]);

  const openLedger = (cliente: any) => {
    setSelectedCliente(cliente);
    fetch(`/api/clientes/${cliente.cliente_id}/ledger`)
      .then(res => res.json())
      .then(data => setLedger(Array.isArray(data) ? data : []))
      .catch(() => setLedger([]));
    setShowLedgerModal(true);
  };

  const confirmPago = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedCliente) return;
    const form = new FormData(event.currentTarget);
    const monto = Number(form.get('monto') || 0);
    const metodo = String(form.get('metodo_pago') || 'Transferencia');
    const referencia = String(form.get('referencia') || '');
    await fetch('/api/pagos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cliente_id: selectedCliente.cliente_id,
        monto,
        fecha: new Date().toISOString().slice(0, 10),
        metodo_pago: metodo,
        referencia_comprobante: referencia
      })
    });
    await fetch('/api/caja/movimientos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tipo: 'ingreso',
        concepto: `Cobro cuenta corriente ${selectedCliente.nombre}`,
        monto,
        fecha: new Date().toISOString().slice(0, 10),
        metodo_pago: metodo,
        observaciones: referencia
      })
    });
    setShowPagoModal(false);
    loadClientes();
  };

  return (
    <div>
      <div className="header-actions">
        <h1 className="page-title"><CreditCard className="inline-block mr-2" /> Cuentas Corrientes (Clientes)</h1>
        <div style={{ position: 'relative' }}>
          <Search size={20} style={{ position: 'absolute', left: '0.75rem', top: '0.6rem', color: '#9ca3af' }} />
          <input type="text" placeholder="Buscar cliente o RUC..." className="form-control" style={{ paddingLeft: '2.5rem', width: '300px' }} value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Cliente / RUC</th>
              <th>Limite Credito</th>
              <th>Deuda Total</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredClientes.map(c => {
              const deuda = Number(c.saldo_deudor || 0);
              return (
                <tr key={c.cliente_id}>
                  <td>
                    <div style={{ fontWeight: 'bold' }}>{c.nombre}</div>
                    <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>RUC: {c.ruc || 'S/N'}</div>
                  </td>
                  <td>{money(c.limite_credito)}</td>
                  <td style={{ fontWeight: 'bold', color: deuda > 0 ? '#dc2626' : '#374151' }}>{money(deuda)}</td>
                  <td>
                    <span className={`status-badge status-${deuda > 0 ? 'pendiente' : 'entregado'}`}>
                      {deuda > 0 ? 'Con saldo' : 'Al dia'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button className="btn btn-outline" style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem' }} onClick={() => openLedger(c)}>
                        <Eye size={16} className="mr-1" /> Ledger
                      </button>
                      <button className="btn btn-primary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem' }} onClick={() => { setSelectedCliente(c); setShowPagoModal(true); }}>
                        <DollarSign size={16} className="mr-1" /> Cobrar
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filteredClientes.length === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>No hay clientes con cuenta corriente en esta empresa.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showLedgerModal && selectedCliente && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '800px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>Estado de Cuenta: {selectedCliente.nombre}</h2>
              <button className="btn btn-outline" onClick={() => setShowLedgerModal(false)}>Cerrar</button>
            </div>
            <div style={{ display: 'flex', gap: '2rem', marginBottom: '1rem', padding: '1rem', background: '#f9fafb', borderRadius: '0.5rem' }}>
              <div>
                <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>Limite de Credito</p>
                <p style={{ fontWeight: 'bold' }}>{money(selectedCliente.limite_credito)}</p>
              </div>
              <div>
                <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>Deuda Total</p>
                <p style={{ fontWeight: 'bold', color: '#dc2626' }}>{money(selectedCliente.saldo_deudor)}</p>
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
                    <th>Debito</th>
                    <th>Credito</th>
                    <th>Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.map((row, index) => (
                    <tr key={index}>
                      <td>{row.fecha || '-'}</td>
                      <td style={{ fontWeight: 'bold' }}>{row.ref || '-'}</td>
                      <td>{row.tipo || '-'}</td>
                      <td>{row.concepto || '-'}</td>
                      <td style={{ color: '#dc2626' }}>{Number(row.debito || 0) > 0 ? money(row.debito) : ''}</td>
                      <td style={{ color: '#16a34a' }}>{Number(row.credito || 0) > 0 ? money(row.credito) : ''}</td>
                      <td style={{ fontWeight: 'bold' }}>{money(row.saldo)}</td>
                    </tr>
                  ))}
                  {ledger.length === 0 && (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: '1.5rem', color: '#6b7280' }}>Sin movimientos para este cliente.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {showPagoModal && selectedCliente && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>Registrar Pago - {selectedCliente.nombre}</h2>
            {Number(selectedCliente.saldo_deudor || 0) > Number(selectedCliente.limite_credito || 0) && Number(selectedCliente.limite_credito || 0) > 0 && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem', display: 'flex', gap: '0.5rem' }}>
                <AlertCircle style={{ color: '#ef4444' }} size={20} />
                <span style={{ color: '#991b1b', fontSize: '0.875rem' }}>El cliente supero su limite de credito.</span>
              </div>
            )}
            <form onSubmit={confirmPago}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label>Monto a Pagar (Gs.)</label>
                  <input required name="monto" type="number" defaultValue={selectedCliente.saldo_deudor || 0} />
                </div>
                <div className="form-group">
                  <label>Metodo de Pago</label>
                  <select required name="metodo_pago">
                    <option>Transferencia Bancaria</option>
                    <option>Efectivo</option>
                    <option>Cheque</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Referencia</label>
                <input name="referencia" type="text" placeholder="Numero de comprobante" />
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
