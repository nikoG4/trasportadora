import { useEffect, useMemo, useState } from 'react';
import { Wallet, Plus, FileText, CheckCircle } from 'lucide-react';

function money(value: number) {
  return `Gs. ${Number(value || 0).toLocaleString()}`;
}

export default function Viaticos() {
  const [showAsignarModal, setShowAsignarModal] = useState(false);
  const [showCerrarModal, setShowCerrarModal] = useState(false);
  const [selectedRendicion, setSelectedRendicion] = useState<any>(null);
  const [rendiciones, setRendiciones] = useState<any[]>([]);
  const [gastos, setGastos] = useState<any[]>([]);
  const [choferes, setChoferes] = useState<any[]>([]);
  const [viajes, setViajes] = useState<any[]>([]);

  const loadData = () => {
    Promise.all([
      fetch('/api/caja/rendiciones').then(res => res.json()).catch(() => []),
      fetch('/api/caja/gastos').then(res => res.json()).catch(() => []),
      fetch('/api/choferes').then(res => res.json()).catch(() => []),
      fetch('/api/viajes').then(res => res.json()).catch(() => [])
    ]).then(([rendicionesData, gastosData, choferesData, viajesData]) => {
      setRendiciones(Array.isArray(rendicionesData) ? rendicionesData : []);
      setGastos(Array.isArray(gastosData) ? gastosData : []);
      setChoferes(Array.isArray(choferesData) ? choferesData : []);
      setViajes(Array.isArray(viajesData) ? viajesData : []);
    });
  };

  useEffect(() => {
    loadData();
  }, []);

  const rows = useMemo(() => {
    return rendiciones.map((rendicion: any) => {
      const chofer = choferes.find((item: any) => Number(item.id) === Number(rendicion.chofer_id));
      const viaje = viajes.find((item: any) => Number(item.id) === Number(rendicion.viaje_id));
      const gastosRendicion = gastos.filter((item: any) => Number(item.chofer_id) === Number(rendicion.chofer_id) && (!rendicion.viaje_id || Number(item.viaje_id) === Number(rendicion.viaje_id)));
      const gastado = gastosRendicion.reduce((total: number, item: any) => total + Number(item.monto || 0), Number(rendicion.monto_gastado || 0));
      const asignado = Number(rendicion.monto_recibido || 0);
      const cobrado = Number(rendicion.monto_cobrado || 0);
      const saldo = Number(rendicion.saldo_entregado || (asignado + cobrado - gastado));
      return {
        ...rendicion,
        chofer_nombre: chofer?.nombre || `Chofer #${rendicion.chofer_id || '-'}`,
        viaje_label: viaje ? `Viaje #${viaje.id}` : (rendicion.viaje_id ? `Viaje #${rendicion.viaje_id}` : 'Sin viaje'),
        asignado,
        gastado,
        pendiente: saldo,
        gastos: gastosRendicion
      };
    });
  }, [rendiciones, gastos, choferes, viajes]);

  const totalDineroEnCalle = rows
    .filter(row => !['cerrada', 'liquidada'].includes(String(row.estado || '').toLowerCase()))
    .reduce((total, row) => total + Number(row.pendiente || 0), 0);

  const handleCerrarRendicion = (rendicion: any) => {
    setSelectedRendicion(rendicion);
    setShowCerrarModal(true);
  };

  const asignarViatico = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const choferId = form.get('chofer_id');
    const viajeId = form.get('viaje_id') || null;
    const monto = Number(form.get('monto') || 0);
    const metodo = String(form.get('metodo_pago') || 'Efectivo');
    await fetch('/api/caja/rendiciones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chofer_id: choferId,
        viaje_id: viajeId || null,
        fecha: new Date().toISOString().slice(0, 10),
        monto_recibido: monto,
        monto_gastado: 0,
        monto_cobrado: 0,
        saldo_entregado: monto,
        estado: 'abierta'
      })
    });
    await fetch('/api/caja/movimientos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tipo: 'egreso',
        concepto: `Viatico chofer #${choferId}`,
        monto,
        fecha: new Date().toISOString().slice(0, 10),
        metodo_pago: metodo,
        observaciones: String(form.get('observaciones') || '')
      })
    });
    setShowAsignarModal(false);
    loadData();
  };

  const cerrarRendicion = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedRendicion) return;
    const form = new FormData(event.currentTarget);
    const monto = Number(form.get('monto_devuelto') || 0);
    await fetch(`/api/caja/rendiciones/${selectedRendicion.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: 'cerrada' })
    });
    if (monto > 0) {
      await fetch('/api/caja/movimientos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'ingreso',
          concepto: `Cierre rendicion #${selectedRendicion.id}`,
          monto,
          fecha: new Date().toISOString().slice(0, 10),
          metodo_pago: 'Efectivo',
          referencia_id: selectedRendicion.id
        })
      });
    }
    setShowCerrarModal(false);
    loadData();
  };

  return (
    <div>
      <div className="header-actions">
        <h1 className="page-title"><Wallet className="inline-block mr-2" /> Viaticos y Rendiciones</h1>
        <button className="btn btn-primary" onClick={() => setShowAsignarModal(true)}>
          <Plus size={20} className="mr-2" /> Asignar Viatico
        </button>
      </div>

      <div className="stat-card" style={{ marginBottom: '2rem', borderLeft: '4px solid #3b82f6' }}>
        <h3>Total Dinero en Calle</h3>
        <p className="value" style={{ color: '#1d4ed8' }}>{money(totalDineroEnCalle)}</p>
        <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>Dinero entregado a choferes pendiente de rendicion.</p>
      </div>

      <div className="table-container">
        <h2 style={{ fontSize: '1.1rem', fontWeight: 'bold', padding: '1rem', borderBottom: '1px solid #e5e7eb' }}>Rendiciones de la empresa actual</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>Chofer</th>
              <th>Viaje</th>
              <th>Monto Asignado</th>
              <th>Gastos Reportados</th>
              <th>Saldo Pendiente</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.id}>
                <td style={{ fontWeight: 'bold' }}>{row.chofer_nombre}</td>
                <td>{row.viaje_label}</td>
                <td>{money(row.asignado)}</td>
                <td style={{ color: '#dc2626' }}>{money(row.gastado)}</td>
                <td style={{ color: '#1d4ed8', fontWeight: 'bold' }}>{money(row.pendiente)}</td>
                <td><span className="status-badge pendiente">{row.estado || 'abierta'}</span></td>
                <td>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn btn-outline" style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem' }} onClick={() => handleCerrarRendicion(row)}>
                      <FileText size={16} /> Detalle
                    </button>
                    {!['cerrada', 'liquidada'].includes(String(row.estado || '').toLowerCase()) && (
                      <button className="btn btn-primary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem' }} onClick={() => handleCerrarRendicion(row)}>
                        <CheckCircle size={16} className="mr-1" /> Cerrar
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>No hay rendiciones ni viaticos para esta empresa.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showAsignarModal && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>Asignar Viatico</h2>
            <form onSubmit={asignarViatico}>
              <div className="form-group">
                <label>Chofer</label>
                <select required name="chofer_id">
                  <option value="">Seleccionar Chofer...</option>
                  {choferes.map(chofer => <option key={chofer.id} value={chofer.id}>{chofer.nombre}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Viaje Asociado</label>
                <select name="viaje_id">
                  <option value="">Sin Viaje</option>
                  {viajes.map(viaje => <option key={viaje.id} value={viaje.id}>Viaje #{viaje.id}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Monto (Gs.)</label>
                <input required name="monto" type="number" placeholder="Ej: 500000" />
              </div>
              <div className="form-group">
                <label>Metodo de Pago</label>
                <select required name="metodo_pago">
                  <option>Efectivo</option>
                  <option>Transferencia</option>
                </select>
              </div>
              <div className="form-group">
                <label>Concepto / Observacion</label>
                <input name="observaciones" type="text" placeholder="Combustible y vianda..." />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowAsignarModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Confirmar Asignacion</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCerrarModal && selectedRendicion && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>Rendicion: {selectedRendicion.chofer_nombre}</h2>
            <div style={{ marginBottom: '1.5rem' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '0.5rem 0' }}>Viatico Asignado</td>
                    <td style={{ padding: '0.5rem 0', textAlign: 'right', color: '#16a34a', fontWeight: 'bold' }}>(+) {money(selectedRendicion.asignado)}</td>
                  </tr>
                  {selectedRendicion.gastos.map((gasto: any) => (
                    <tr key={gasto.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '0.5rem 0', color: '#4b5563' }}>Gasto: {gasto.tipo_gasto}</td>
                      <td style={{ padding: '0.5rem 0', textAlign: 'right', color: '#dc2626' }}>(-) {money(gasto.monto)}</td>
                    </tr>
                  ))}
                  <tr style={{ background: '#f3f4f6', fontWeight: 'bold' }}>
                    <td style={{ padding: '0.75rem 0.5rem' }}>DIFERENCIA A RENDIR</td>
                    <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right', color: '#1d4ed8' }}>{money(selectedRendicion.pendiente)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <form onSubmit={cerrarRendicion}>
              <div className="form-group">
                <label>Monto Fisico Devuelto (Gs.)</label>
                <input required name="monto_devuelto" type="number" defaultValue={selectedRendicion.pendiente} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '2rem' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowCerrarModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" style={{ background: '#16a34a', borderColor: '#16a34a' }}>Liquidar Rendicion</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
