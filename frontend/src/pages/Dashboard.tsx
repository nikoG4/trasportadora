import { useEffect, useState } from 'react';
import { Home, AlertTriangle, Truck, DollarSign, Wallet, Activity, Download, Smartphone } from 'lucide-react';

function money(value: number) {
  return `Gs. ${Number(value || 0).toLocaleString()}`;
}

export default function Dashboard() {
  const [widgets, setWidgets] = useState({
    cajaDia: 0,
    viajesActivos: 0,
    deudaTotal: 0,
    rentabilidad: 0
  });
  const [alertas, setAlertas] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([
      fetch('/api/dashboard').then(res => res.json()).catch(() => ({})),
      fetch('/api/caja/movimientos').then(res => res.json()).catch(() => []),
      fetch('/api/cuentas-corrientes').then(res => res.json()).catch(() => []),
      fetch('/api/reportes/rentabilidad').then(res => res.json()).catch(() => ({})),
      fetch('/api/alertas').then(res => res.ok ? res.json() : []).catch(() => []),
      fetch('/api/alertas/vencimientos').then(res => res.json()).catch(() => ({ vehiculos: [], choferes: [] }))
    ]).then(([dashboard, movimientos, cuentas, rentabilidad, alertasData, vencimientos]) => {
      const cajaDia = Array.isArray(movimientos)
        ? movimientos.reduce((total: number, item: any) => {
            const amount = Number(item.monto || 0);
            return String(item.tipo || '').toLowerCase() === 'egreso' ? total - amount : total + amount;
          }, 0)
        : 0;
      const deudaTotal = Array.isArray(cuentas)
        ? cuentas.reduce((total: number, item: any) => total + Number(item.saldo_deudor || 0), 0)
        : 0;
      const ingresos = Number(rentabilidad.total_ingresos || 0);
      const margen = ingresos ? Math.round((Number(rentabilidad.rentabilidad || 0) / ingresos) * 100) : 0;

      setWidgets({
        cajaDia,
        viajesActivos: Number(dashboard.viajesActivos || 0),
        deudaTotal,
        rentabilidad: margen
      });

      const vencimientoAlertas = [
        ...(Array.isArray(vencimientos.vehiculos) ? vencimientos.vehiculos : []).map((item: any) => ({
          id: `vehiculo-${item.id}`,
          prioridad: 'media',
          tipo: 'Documentos de vehiculo',
          mensaje: `Vehiculo ${item.chapa || item.id} tiene documentos por vencer.`
        })),
        ...(Array.isArray(vencimientos.choferes) ? vencimientos.choferes : []).map((item: any) => ({
          id: `chofer-${item.id}`,
          prioridad: 'media',
          tipo: 'Licencia de chofer',
          mensaje: `Chofer ${item.nombre || item.id} tiene licencia por vencer.`
        }))
      ];

      setAlertas([
        ...(Array.isArray(alertasData) ? alertasData.map((item: any) => ({
          id: item.id,
          prioridad: item.severidad || 'media',
          tipo: item.tipo || item.titulo || 'Alerta',
          mensaje: item.descripcion || item.titulo || ''
        })) : []),
        ...vencimientoAlertas
      ]);
    });
  }, []);

  return (
    <div>
      <div className="header-actions">
        <h1 className="page-title"><Home className="inline-block mr-2" /> Control Tower (Dashboard)</h1>
        <a className="btn btn-primary" href="/downloads/app-chofer-debug-transportadora.apk" download title="Descargar APK debug de la app chofer">
          <Download size={18} /> Descargar APK chofer
        </a>
      </div>

      <div className="stat-card" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
            <Smartphone size={18} className="text-blue-600" /> App chofer Android
          </h3>
          <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
            APK debug para instalar en celulares de choferes y probar reparto local, impresion y GPS.
          </p>
        </div>
        <a className="btn btn-outline" href="/downloads/app-chofer-debug-transportadora.apk" download>
          <Download size={18} /> Descargar APK
        </a>
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '1rem', display: 'flex', alignItems: 'center' }}>
          <AlertTriangle size={20} className="mr-2 text-yellow-600" /> Alertas Automaticas
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {alertas.map(alerta => (
            <div key={alerta.id} style={{
              padding: '1rem',
              borderRadius: '0.5rem',
              borderLeft: `4px solid ${alerta.prioridad === 'alta' ? '#dc2626' : alerta.prioridad === 'media' ? '#eab308' : '#3b82f6'}`,
              background: '#fff',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem'
            }}>
              <span style={{ background: '#eff6ff', color: '#1d4ed8', padding: '0.25rem 0.5rem', borderRadius: '0.25rem', fontSize: '0.75rem', fontWeight: 'bold' }}>
                {String(alerta.prioridad || 'info').toUpperCase()}
              </span>
              <div>
                <p style={{ fontWeight: 'bold', fontSize: '0.875rem', color: '#374151', margin: 0 }}>{alerta.tipo}</p>
                <p style={{ color: '#4b5563', margin: 0 }}>{alerta.mensaje}</p>
              </div>
            </div>
          ))}
          {alertas.length === 0 && (
            <div className="stat-card" style={{ color: '#6b7280' }}>No hay alertas para esta empresa.</div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="stat-card">
          <h3><DollarSign size={16} className="inline-block text-green-600 mr-1" /> Caja del Dia</h3>
          <p className="value text-green-600">{money(widgets.cajaDia)}</p>
          <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>Saldo actual estimado.</p>
        </div>
        <div className="stat-card">
          <h3><Truck size={16} className="inline-block text-blue-600 mr-1" /> Viajes Activos</h3>
          <p className="value text-blue-600">{widgets.viajesActivos}</p>
          <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>Vehiculos en transito.</p>
        </div>
        <div className="stat-card">
          <h3><Wallet size={16} className="inline-block text-red-600 mr-1" /> Deuda Total</h3>
          <p className="value text-red-600">{money(widgets.deudaTotal)}</p>
          <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>Cuentas corrientes de clientes.</p>
        </div>
        <div className="stat-card">
          <h3><Activity size={16} className="inline-block text-purple-600 mr-1" /> Rentabilidad Mes</h3>
          <p className="value text-purple-600">{widgets.rentabilidad}%</p>
          <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>Margen bruto estimado.</p>
        </div>
      </div>
    </div>
  );
}
