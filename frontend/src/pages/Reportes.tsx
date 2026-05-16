import { useEffect, useMemo, useState } from 'react';
import { BarChart2, Download, Filter } from 'lucide-react';

function money(value: number) {
  return `Gs. ${Number(value || 0).toLocaleString()}`;
}

function amount(row: any, keys: string[]) {
  for (const key of keys) {
    const value = Number(row?.[key] || 0);
    if (value) return value;
  }
  return 0;
}

function margin(ingresos: number, gastos: number) {
  return ingresos ? `${(((ingresos - gastos) / ingresos) * 100).toFixed(1)}%` : '0.0%';
}

export default function Reportes() {
  const [activeTab, setActiveTab] = useState('chofer');
  const [periodo, setPeriodo] = useState('mes');
  const [sucursalId, setSucursalId] = useState('todas');
  const [viajes, setViajes] = useState<any[]>([]);
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [gastos, setGastos] = useState<any[]>([]);
  const [mantenimientos, setMantenimientos] = useState<any[]>([]);
  const [cuentas, setCuentas] = useState<any[]>([]);
  const [sucursales, setSucursales] = useState<any[]>([]);
  const [resumen, setResumen] = useState({ total_ingresos: 0, total_egresos: 0, rentabilidad: 0 });

  useEffect(() => {
    Promise.all([
      fetch('/api/viajes').then(res => res.json()).catch(() => []),
      fetch('/api/pedidos').then(res => res.json()).catch(() => []),
      fetch('/api/caja/gastos').then(res => res.json()).catch(() => []),
      fetch('/api/gestion/mantenimientos').then(res => res.json()).catch(() => []),
      fetch('/api/cuentas-corrientes').then(res => res.json()).catch(() => []),
      fetch('/api/sucursales').then(res => res.json()).catch(() => []),
      fetch('/api/reportes/rentabilidad').then(res => res.json()).catch(() => ({}))
    ]).then(([viajesData, pedidosData, gastosData, mantenimientosData, cuentasData, sucursalesData, resumenData]) => {
      setViajes(Array.isArray(viajesData) ? viajesData : []);
      setPedidos(Array.isArray(pedidosData) ? pedidosData : []);
      setGastos(Array.isArray(gastosData) ? gastosData : []);
      setMantenimientos(Array.isArray(mantenimientosData) ? mantenimientosData : []);
      setCuentas(Array.isArray(cuentasData) ? cuentasData : []);
      setSucursales(Array.isArray(sucursalesData) ? sucursalesData : []);
      setResumen({
        total_ingresos: Number(resumenData.total_ingresos || 0),
        total_egresos: Number(resumenData.total_egresos || 0),
        rentabilidad: Number(resumenData.rentabilidad || 0)
      });
    });
  }, []);

  const filteredViajes = useMemo(() => {
    if (sucursalId === 'todas') return viajes;
    return viajes.filter(viaje => String(viaje.sucursal_origen_id) === sucursalId || String(viaje.sucursal_destino_id) === sucursalId);
  }, [viajes, sucursalId]);

  const filteredPedidos = useMemo(() => {
    if (sucursalId === 'todas') return pedidos;
    return pedidos.filter(pedido => String(pedido.sucursal_origen_id) === sucursalId || String(pedido.sucursal_destino_id) === sucursalId);
  }, [pedidos, sucursalId]);

  const rentabilidadChofer = useMemo(() => {
    const rows = new Map<string, any>();
    for (const viaje of filteredViajes) {
      const key = String(viaje.chofer_id || 'sin-chofer');
      const current = rows.get(key) || {
        nombre: viaje.chofer_nombre || 'Sin chofer asignado',
        viajes: 0,
        ingresos: 0,
        gastos: 0
      };
      current.viajes += String(viaje.estado || '').toLowerCase() === 'finalizado' ? 1 : 0;
      current.gastos += Number(viaje.costo_estimado || 0);
      rows.set(key, current);
    }

    for (const pedido of filteredPedidos) {
      const viaje = filteredViajes.find(item => Number(item.id) === Number(pedido.viaje_id));
      if (!viaje) continue;
      const key = String(viaje.chofer_id || 'sin-chofer');
      const current = rows.get(key);
      if (current) current.ingresos += amount(pedido, ['precio', 'total', 'monto']);
    }

    for (const gasto of gastos) {
      const key = String(gasto.chofer_id || 'sin-chofer');
      const current = rows.get(key);
      if (current) current.gastos += Number(gasto.monto || 0);
    }

    return [...rows.values()].map(row => ({ ...row, margen: margin(row.ingresos, row.gastos) }));
  }, [filteredViajes, filteredPedidos, gastos]);

  const rentabilidadVehiculo = useMemo(() => {
    const rows = new Map<string, any>();
    for (const viaje of filteredViajes) {
      const key = String(viaje.vehiculo_id || 'sin-vehiculo');
      const current = rows.get(key) || {
        vehiculo: viaje.vehiculo_chapa || 'Sin vehiculo asignado',
        marca: viaje.vehiculo_marca || '',
        km: Number(viaje.km_recorridos || viaje.distancia_km || 0),
        ingresos: 0,
        gastos: 0
      };
      current.gastos += Number(viaje.costo_estimado || 0);
      rows.set(key, current);
    }

    for (const pedido of filteredPedidos) {
      const viaje = filteredViajes.find(item => Number(item.id) === Number(pedido.viaje_id));
      if (!viaje) continue;
      const current = rows.get(String(viaje.vehiculo_id || 'sin-vehiculo'));
      if (current) current.ingresos += amount(pedido, ['precio', 'total', 'monto']);
    }

    for (const mantenimiento of mantenimientos) {
      const current = rows.get(String(mantenimiento.vehiculo_id || 'sin-vehiculo'));
      if (current) current.gastos += amount(mantenimiento, ['costo', 'monto']);
    }

    return [...rows.values()].map(row => ({
      ...row,
      costoKm: row.km ? Math.round(row.gastos / row.km) : 0,
      margen: margin(row.ingresos, row.gastos)
    }));
  }, [filteredViajes, filteredPedidos, mantenimientos]);

  const agingReport = useMemo(() => {
    return cuentas
      .filter(cuenta => Number(cuenta.saldo_deudor || 0) > 0)
      .map(cuenta => ({
        cliente: cuenta.nombre,
        total: Number(cuenta.saldo_deudor || 0),
        alDia: Number(cuenta.saldo_deudor || 0),
        v30: 0,
        v60: 0,
        v90: 0
      }));
  }, [cuentas]);

  const ingresos = resumen.total_ingresos;
  const egresos = resumen.total_egresos;
  const flujo = resumen.rentabilidad;

  return (
    <div>
      <div className="header-actions">
        <h1 className="page-title"><BarChart2 className="inline-block mr-2" /> Reportes Financieros</h1>
        <button className="btn btn-outline">
          <Download size={20} className="mr-2" /> Exportar Excel
        </button>
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '1rem', flexWrap: 'wrap' }}>
        <button className={`btn ${activeTab === 'chofer' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('chofer')}>
          Rentabilidad x Chofer
        </button>
        <button className={`btn ${activeTab === 'vehiculo' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('vehiculo')}>
          Rentabilidad x Vehiculo
        </button>
        <button className={`btn ${activeTab === 'general' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('general')}>
          Reporte General P&L
        </button>
        <button className={`btn ${activeTab === 'morosidad' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('morosidad')}>
          Morosidad Aging
        </button>
      </div>

      <div style={{ background: 'white', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1.5rem', display: 'flex', gap: '1rem', border: '1px solid #e5e7eb', alignItems: 'center', flexWrap: 'wrap' }}>
        <Filter size={20} className="text-gray-500" />
        <select className="form-control" style={{ width: 'auto' }} value={periodo} onChange={e => setPeriodo(e.target.value)}>
          <option value="mes">Mes actual</option>
          <option value="anterior">Mes anterior</option>
          <option value="ytd">YTD</option>
        </select>
        <select className="form-control" style={{ width: 'auto' }} value={sucursalId} onChange={e => setSucursalId(e.target.value)}>
          <option value="todas">Todas las sucursales</option>
          {sucursales.map(sucursal => (
            <option key={sucursal.id} value={sucursal.id}>{sucursal.nombre}</option>
          ))}
        </select>
        <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>Periodo: {periodo.toUpperCase()}</span>
      </div>

      {activeTab === 'chofer' && (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Chofer</th>
                <th>Viajes Completados</th>
                <th>Fletes Generados</th>
                <th>Gastos Operativos</th>
                <th>Margen Bruto</th>
              </tr>
            </thead>
            <tbody>
              {rentabilidadChofer.map((row, index) => (
                <tr key={index}>
                  <td style={{ fontWeight: 'bold' }}>{row.nombre}</td>
                  <td>{row.viajes}</td>
                  <td style={{ color: '#16a34a' }}>{money(row.ingresos)}</td>
                  <td style={{ color: '#dc2626' }}>{money(row.gastos)}</td>
                  <td style={{ fontWeight: 'bold' }}>{row.margen}</td>
                </tr>
              ))}
              {rentabilidadChofer.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: 'center', color: '#6b7280' }}>No hay viajes para reportar en esta empresa.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'vehiculo' && (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Vehiculo</th>
                <th>KM Recorridos</th>
                <th>Fletes Generados</th>
                <th>Gastos</th>
                <th>Costo x KM</th>
                <th>Margen Bruto</th>
              </tr>
            </thead>
            <tbody>
              {rentabilidadVehiculo.map((row, index) => (
                <tr key={index}>
                  <td style={{ fontWeight: 'bold' }}>{row.vehiculo}{row.marca ? ` - ${row.marca}` : ''}</td>
                  <td>{Number(row.km || 0).toLocaleString()} km</td>
                  <td style={{ color: '#16a34a' }}>{money(row.ingresos)}</td>
                  <td style={{ color: '#dc2626' }}>{money(row.gastos)}</td>
                  <td>{money(row.costoKm)}</td>
                  <td style={{ fontWeight: 'bold' }}>{row.margen}</td>
                </tr>
              ))}
              {rentabilidadVehiculo.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: '#6b7280' }}>No hay vehiculos con actividad para reportar.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'general' && (
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          <div className="stat-card" style={{ marginBottom: '1rem', textAlign: 'center' }}>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Ingresos Totales</h3>
            <p className="value text-green-600">{money(ingresos)}</p>
          </div>
          <div className="stat-card" style={{ marginBottom: '1rem', textAlign: 'center' }}>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Gastos Totales</h3>
            <p className="value text-red-600">{money(egresos)}</p>
          </div>
          <div className="stat-card" style={{ background: '#eff6ff', borderColor: '#bfdbfe', textAlign: 'center' }}>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Flujo de Caja Neto</h3>
            <p className="value text-blue-600">{money(flujo)}</p>
          </div>
        </div>
      )}

      {activeTab === 'morosidad' && (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Saldo Total a Cobrar</th>
                <th>Al Dia</th>
                <th>Vencido a 30 dias</th>
                <th>Vencido a 60 dias</th>
                <th>Vencido a 90+ dias</th>
              </tr>
            </thead>
            <tbody>
              {agingReport.map((row, index) => (
                <tr key={index}>
                  <td style={{ fontWeight: 'bold' }}>{row.cliente}</td>
                  <td style={{ fontWeight: 'bold' }}>{money(row.total)}</td>
                  <td style={{ color: '#16a34a' }}>{money(row.alDia)}</td>
                  <td style={{ color: row.v30 > 0 ? '#ca8a04' : '#6b7280' }}>{money(row.v30)}</td>
                  <td style={{ color: row.v60 > 0 ? '#ea580c' : '#6b7280' }}>{money(row.v60)}</td>
                  <td style={{ color: row.v90 > 0 ? '#dc2626' : '#6b7280', fontWeight: row.v90 > 0 ? 'bold' : 'normal' }}>{money(row.v90)}</td>
                </tr>
              ))}
              {agingReport.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: '#6b7280' }}>No hay saldos pendientes para esta empresa.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
