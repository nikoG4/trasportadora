import { useEffect, useMemo, useState } from 'react';
import { TrendingUp, DollarSign, Search, CheckCircle } from 'lucide-react';

function money(value: number) {
  return `Gs. ${Number(value || 0).toLocaleString()}`;
}

export default function Ingresos() {
  const [showIngresoModal, setShowIngresoModal] = useState(false);
  const [selectedServicio, setSelectedServicio] = useState<any>(null);
  const [servicios, setServicios] = useState<any[]>([]);
  const [search, setSearch] = useState('');

  const loadServicios = () => {
    fetch('/api/pedidos')
      .then(res => res.json())
      .then(data => {
        const rows = Array.isArray(data) ? data : [];
        setServicios(rows
          .filter((pedido: any) => !['cancelado'].includes(String(pedido.estado || '').toLowerCase()))
          .map((pedido: any) => ({
            id: pedido.id,
            fecha: pedido.fecha_prevista || '',
            guia: pedido.numero_guia || `Pedido #${pedido.id}`,
            cliente_id: pedido.cliente_pagador_id,
            cliente: pedido.cliente_pagador_nombre || pedido.remitente_nombre || 'Sin cliente',
            ruta: `${pedido.sucursal_origen_nombre || pedido.remitente_direccion || 'Origen'} - ${pedido.sucursal_destino_nombre || pedido.destinatario_direccion || 'Destino'}`,
            monto: Number(pedido.precio || 0),
            condicion: String(pedido.tipo_pago || '').toLowerCase() === 'credito' ? 'Credito' : 'Contado',
            estado: pedido.estado || 'pendiente'
          })));
      })
      .catch(() => setServicios([]));
  };

  useEffect(() => {
    loadServicios();
  }, []);

  const filteredServicios = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return servicios;
    return servicios.filter(item => `${item.guia} ${item.cliente}`.toLowerCase().includes(term));
  }, [servicios, search]);

  const handleRegistrarIngreso = (servicio: any) => {
    setSelectedServicio(servicio);
    setShowIngresoModal(true);
  };

  const confirmIngreso = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedServicio) return;
    const form = new FormData(event.currentTarget);
    const monto = Number(form.get('monto') || selectedServicio.monto || 0);
    const metodo = String(form.get('metodo_pago') || 'Efectivo');
    await fetch('/api/pagos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cliente_id: selectedServicio.cliente_id,
        pedido_id: selectedServicio.id,
        monto,
        fecha: new Date().toISOString().slice(0, 10),
        metodo_pago: metodo,
        referencia_comprobante: selectedServicio.guia
      })
    });
    await fetch('/api/caja/movimientos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tipo: 'ingreso',
        concepto: `Cobro ${selectedServicio.guia}`,
        monto,
        fecha: new Date().toISOString().slice(0, 10),
        metodo_pago: metodo,
        referencia_id: selectedServicio.id,
        observaciones: selectedServicio.cliente
      })
    });
    setShowIngresoModal(false);
    loadServicios();
  };

  return (
    <div>
      <div className="header-actions">
        <h1 className="page-title"><TrendingUp className="inline-block mr-2" /> Ingresos y Facturacion</h1>
        <div style={{ position: 'relative' }}>
          <Search size={20} style={{ position: 'absolute', left: '0.75rem', top: '0.6rem', color: '#9ca3af' }} />
          <input type="text" placeholder="Buscar guia o cliente..." className="form-control" style={{ paddingLeft: '2.5rem', width: '300px' }} value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="table-container">
        <h2 style={{ fontSize: '1.1rem', fontWeight: 'bold', padding: '1rem', borderBottom: '1px solid #e5e7eb' }}>Servicios de la empresa actual</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>Fecha Servicio</th>
              <th>Nro Guia</th>
              <th>Cliente</th>
              <th>Origen - Destino</th>
              <th>Monto Servicio</th>
              <th>Condicion</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredServicios.map(s => (
              <tr key={s.id}>
                <td>{s.fecha || '-'}</td>
                <td style={{ fontWeight: 'bold' }}>{s.guia}</td>
                <td>{s.cliente}</td>
                <td>{s.ruta}</td>
                <td style={{ fontWeight: 'bold' }}>{money(s.monto)}</td>
                <td>{s.condicion}</td>
                <td><span className="status-badge pendiente">{s.estado}</span></td>
                <td>
                  {s.condicion === 'Contado' ? (
                    <button className="btn btn-primary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem' }} onClick={() => handleRegistrarIngreso(s)}>
                      <DollarSign size={16} className="mr-1" /> Registrar Ingreso
                    </button>
                  ) : (
                    <span style={{ color: '#6b7280' }}>Cuenta corriente</span>
                  )}
                </td>
              </tr>
            ))}
            {filteredServicios.length === 0 && (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>No hay servicios para facturar o cobrar en esta empresa.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showIngresoModal && selectedServicio && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>Registrar Ingreso</h2>
            <div style={{ background: '#f3f4f6', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ color: '#6b7280' }}>Guia:</span>
                <span style={{ fontWeight: 'bold' }}>{selectedServicio.guia}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ color: '#6b7280' }}>Cliente:</span>
                <span>{selectedServicio.cliente}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem' }}>
                <span style={{ color: '#6b7280' }}>Monto Total:</span>
                <span style={{ fontWeight: 'bold', color: '#16a34a' }}>{money(selectedServicio.monto)}</span>
              </div>
            </div>

            <form onSubmit={confirmIngreso}>
              <div className="form-group">
                <label>Monto Recibido (Gs.)</label>
                <input required name="monto" type="number" defaultValue={selectedServicio.monto} />
              </div>
              <div className="form-group">
                <label>Metodo de Pago</label>
                <select required name="metodo_pago">
                  <option>Efectivo</option>
                  <option>Transferencia</option>
                  <option>POS / Tarjeta</option>
                </select>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '2rem' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowIngresoModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary"><CheckCircle size={20} className="mr-2" /> Confirmar Cobro</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
