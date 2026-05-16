import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { DollarSign, Plus, Lock, Unlock, AlertCircle, TrendingDown, TrendingUp } from 'lucide-react';

function money(value: number) {
  return `Gs. ${Number(value || 0).toLocaleString()}`;
}

function todayInput() {
  return new Date().toISOString().slice(0, 10);
}

export default function Caja() {
  const [estadoCaja, setEstadoCaja] = useState<'cerrada' | 'abierta'>('cerrada');
  const [showAbrirModal, setShowAbrirModal] = useState(false);
  const [showCerrarModal, setShowCerrarModal] = useState(false);
  const [showMovimientoModal, setShowMovimientoModal] = useState(false);
  const [movimientos, setMovimientos] = useState<any[]>([]);
  const [rendiciones, setRendiciones] = useState<any[]>([]);
  const [sucursales, setSucursales] = useState<any[]>([]);

  const reload = () => {
    Promise.all([
      fetch('/api/caja/movimientos').then(res => res.json()).catch(() => []),
      fetch('/api/caja/rendiciones').then(res => res.json()).catch(() => []),
      fetch('/api/sucursales').then(res => res.json()).catch(() => [])
    ]).then(([movimientosData, rendicionesData, sucursalesData]) => {
      const nextMovimientos = Array.isArray(movimientosData) ? movimientosData : [];
      setMovimientos(nextMovimientos);
      setRendiciones(Array.isArray(rendicionesData) ? rendicionesData : []);
      setSucursales(Array.isArray(sucursalesData) ? sucursalesData : []);
      if (nextMovimientos.length > 0) setEstadoCaja('abierta');
    });
  };

  useEffect(() => {
    reload();
  }, []);

  const totals = useMemo(() => {
    return movimientos.reduce((acc, item) => {
      const monto = Number(item.monto || 0);
      if (String(item.tipo || '').toLowerCase() === 'egreso') acc.egresos += monto;
      else acc.ingresos += monto;
      return acc;
    }, { saldoInicial: 0, ingresos: 0, egresos: 0 });
  }, [movimientos]);

  const saldoActual = totals.saldoInicial + totals.ingresos - totals.egresos;
  const rendicionesPendientes = rendiciones.filter(item => !['cerrada', 'aprobada', 'rendida'].includes(String(item.estado || '').toLowerCase()));

  const saveMovimiento = async (payload: any) => {
    await fetch('/api/caja/movimientos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    reload();
  };

  const abrirCaja = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const monto = Number(form.get('monto') || 0);
    if (monto > 0) {
      await saveMovimiento({
        tipo: 'ingreso',
        concepto: 'Apertura de Caja',
        monto,
        fecha: todayInput(),
        metodo_pago: 'Efectivo',
        observaciones: form.get('observaciones') || ''
      });
    }
    setEstadoCaja('abierta');
    setShowAbrirModal(false);
  };

  const registrarMovimiento = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await saveMovimiento({
      tipo: form.get('tipo'),
      concepto: form.get('concepto') || form.get('categoria'),
      monto: Number(form.get('monto') || 0),
      fecha: todayInput(),
      metodo_pago: form.get('metodo_pago'),
      observaciones: form.get('observaciones') || '',
      referencia_id: form.get('referencia_id') || null
    });
    setShowMovimientoModal(false);
  };

  return (
    <div>
      <div className="header-actions">
        <h1 className="page-title"><DollarSign className="inline-block mr-2" /> Caja del Dia</h1>
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
              <p className="value">{money(totals.saldoInicial)}</p>
            </div>
            <div className="stat-card">
              <h3><TrendingUp size={16} className="inline-block mr-1 text-green-600" /> Ingresos</h3>
              <p className="value" style={{ color: '#16a34a' }}>{money(totals.ingresos)}</p>
            </div>
            <div className="stat-card">
              <h3><TrendingDown size={16} className="inline-block mr-1 text-red-600" /> Egresos</h3>
              <p className="value" style={{ color: '#dc2626' }}>{money(totals.egresos)}</p>
            </div>
            <div className="stat-card" style={{ background: '#eff6ff', borderColor: '#bfdbfe' }}>
              <h3>Saldo Actual Estimado</h3>
              <p className="value" style={{ color: '#1d4ed8' }}>{money(saldoActual)}</p>
            </div>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Ref</th>
                  <th>Concepto</th>
                  <th>Metodo</th>
                  <th>Ingreso</th>
                  <th>Egreso</th>
                  <th>Observaciones</th>
                </tr>
              </thead>
              <tbody>
                {movimientos.map(item => {
                  const isEgreso = String(item.tipo || '').toLowerCase() === 'egreso';
                  const monto = Number(item.monto || 0);
                  return (
                    <tr key={item.id}>
                      <td>{item.fecha || '-'}</td>
                      <td>{item.referencia_id || '-'}</td>
                      <td>{item.concepto || '-'}</td>
                      <td>{item.metodo_pago || '-'}</td>
                      <td style={{ color: '#16a34a', fontWeight: !isEgreso && monto > 0 ? 'bold' : 'normal' }}>{!isEgreso && monto > 0 ? money(monto) : '-'}</td>
                      <td style={{ color: '#dc2626', fontWeight: isEgreso && monto > 0 ? 'bold' : 'normal' }}>{isEgreso && monto > 0 ? money(monto) : '-'}</td>
                      <td>{item.observaciones || '-'}</td>
                    </tr>
                  );
                })}
                {movimientos.length === 0 && (
                  <tr><td colSpan={7} style={{ textAlign: 'center', color: '#6b7280' }}>No hay movimientos de caja para esta empresa.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div style={{ textAlign: 'center', padding: '4rem 2rem', background: 'white', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}>
          <Lock size={64} style={{ color: '#9ca3af', margin: '0 auto 1rem' }} />
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>La caja esta cerrada</h2>
          <p style={{ color: '#6b7280', marginBottom: '2rem' }}>Abre la caja para comenzar a registrar operaciones del dia.</p>
          <button className="btn btn-primary" style={{ margin: '0 auto' }} onClick={() => setShowAbrirModal(true)}>Abrir Caja Ahora</button>
        </div>
      )}

      {showAbrirModal && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>Abrir Caja</h2>
            <form onSubmit={abrirCaja}>
              <div className="form-group">
                <label>Sucursal</label>
                <select name="sucursal_id">
                  <option value="">Sin sucursal asignada</option>
                  {sucursales.map(sucursal => <option key={sucursal.id} value={sucursal.id}>{sucursal.nombre}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Monto Inicial Efectivo (Gs.)</label>
                <input name="monto" required type="number" min="0" defaultValue="0" />
              </div>
              <div className="form-group">
                <label>Observaciones (Opcional)</label>
                <input name="observaciones" type="text" placeholder="Detalle de apertura" />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowAbrirModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Confirmar Apertura</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showMovimientoModal && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>Registrar Movimiento Manual</h2>
            <form onSubmit={registrarMovimiento}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label>Tipo de Movimiento</label>
                  <select name="tipo" required>
                    <option value="ingreso">Ingreso</option>
                    <option value="egreso">Egreso</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Categoria</label>
                  <select name="categoria" required>
                    <option>Pago Proveedor</option>
                    <option>Gasto Operativo</option>
                    <option>Cobro Cliente</option>
                    <option>Viatico</option>
                    <option>Otros</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label>Metodo de Pago</label>
                  <select name="metodo_pago" required>
                    <option>Efectivo</option>
                    <option>Transferencia</option>
                    <option>Cheque</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Monto (Gs.)</label>
                  <input name="monto" required type="number" min="1" placeholder="0" />
                </div>
              </div>
              <div className="form-group">
                <label>Concepto</label>
                <input name="concepto" type="text" placeholder="Detalle del movimiento" />
              </div>
              <div className="form-group">
                <label>Referencia / Nro Comprobante</label>
                <input name="referencia_id" type="text" placeholder="Numero de referencia" />
              </div>
              <div className="form-group">
                <label>Descripcion</label>
                <textarea name="observaciones" rows={2} placeholder="Motivo del movimiento..." className="form-control" style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '0.375rem' }}></textarea>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowMovimientoModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Guardar Movimiento</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCerrarModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>Cierre de Caja y Arqueo</h2>
            {rendicionesPendientes.length > 0 && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1.5rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                <AlertCircle style={{ color: '#ef4444', flexShrink: 0 }} />
                <div>
                  <h4 style={{ color: '#991b1b', fontWeight: 'bold', margin: 0 }}>Validacion de Rendiciones</h4>
                  <p style={{ color: '#b91c1c', fontSize: '0.875rem', margin: 0 }}>Hay {rendicionesPendientes.length} rendicion(es) pendiente(s) para esta empresa.</p>
                </div>
              </div>
            )}

            <form onSubmit={(e) => { e.preventDefault(); setEstadoCaja('cerrada'); setShowCerrarModal(false); }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                <div>
                  <h3 style={{ fontWeight: 'bold', marginBottom: '1rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.5rem' }}>Sistema</h3>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}><span>Saldo Inicial:</span> <span>{money(totals.saldoInicial)}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', color: '#16a34a' }}><span>Ingresos:</span> <span>{money(totals.ingresos)}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', color: '#dc2626' }}><span>Egresos:</span> <span>{money(totals.egresos)}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '1.1rem' }}><span>Total Esperado:</span> <span>{money(saldoActual)}</span></div>
                </div>
                <div>
                  <h3 style={{ fontWeight: 'bold', marginBottom: '1rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.5rem' }}>Arqueo Fisico</h3>
                  <div className="form-group">
                    <label>Efectivo en Caja (Gs.)</label>
                    <input required type="number" defaultValue={saldoActual} />
                  </div>
                  <div className="form-group">
                    <label>Total Transferencias/Otros</label>
                    <input required type="number" defaultValue="0" />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', marginTop: '1rem', color: '#1d4ed8' }}>
                    <span>Diferencia:</span> <span>{money(0)}</span>
                  </div>
                </div>
              </div>
              <div className="form-group" style={{ marginTop: '1rem' }}>
                <label>Justificacion de Diferencia</label>
                <input type="text" placeholder="Detalle si hay faltante o sobrante" />
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
