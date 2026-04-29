import { useState } from 'react';
import { Home, AlertTriangle, Truck, DollarSign, Wallet, Activity } from 'lucide-react';

export default function Dashboard() {
  const [widgets] = useState({
    cajaDia: 2700000,
    viajesActivos: 12,
    deudaTotal: 10700000,
    rentabilidad: 32
  });

  const [alertas] = useState([
    { id: 1, prioridad: 'alta', mensaje: 'Luis Díaz tiene una rendición pendiente del viaje V-1025 de hace 48hs.', tipo: 'Rendiciones Vencidas' },
    { id: 2, prioridad: 'alta', mensaje: 'Habilitación del vehículo AAA-111 vence hoy.', tipo: 'Documentos Vencidos' },
    { id: 3, prioridad: 'media', mensaje: 'Cliente Farmacenter SA ha superado su límite de crédito.', tipo: 'Morosidad Crítica' },
    { id: 4, prioridad: 'baja', mensaje: 'Vehículo BBB-222 próximo a cambio de aceite (faltan 500km).', tipo: 'Mantenimiento Preventivo' },
  ]);

  return (
    <div>
      <div className="header-actions">
        <h1 className="page-title"><Home className="inline-block mr-2" /> Control Tower (Dashboard)</h1>
      </div>

      {/* Alertas Automáticas */}
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '1rem', display: 'flex', alignItems: 'center' }}>
          <AlertTriangle size={20} className="mr-2 text-yellow-600" /> Alertas Automáticas
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
              {alerta.prioridad === 'alta' && <span style={{ background: '#fef2f2', color: '#dc2626', padding: '0.25rem 0.5rem', borderRadius: '0.25rem', fontSize: '0.75rem', fontWeight: 'bold' }}>URGENTE</span>}
              {alerta.prioridad === 'media' && <span style={{ background: '#fef9c3', color: '#a16207', padding: '0.25rem 0.5rem', borderRadius: '0.25rem', fontSize: '0.75rem', fontWeight: 'bold' }}>ATENCIÓN</span>}
              {alerta.prioridad === 'baja' && <span style={{ background: '#eff6ff', color: '#1d4ed8', padding: '0.25rem 0.5rem', borderRadius: '0.25rem', fontSize: '0.75rem', fontWeight: 'bold' }}>INFO</span>}
              
              <div>
                <p style={{ fontWeight: 'bold', fontSize: '0.875rem', color: '#374151', margin: 0 }}>{alerta.tipo}</p>
                <p style={{ color: '#4b5563', margin: 0 }}>{alerta.mensaje}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* KPIs Principales */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="stat-card">
          <h3><DollarSign size={16} className="inline-block text-green-600 mr-1" /> Caja del Día (Abierta)</h3>
          <p className="value text-green-600">Gs. {widgets.cajaDia.toLocaleString()}</p>
          <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>Saldo actual estimado.</p>
        </div>
        <div className="stat-card">
          <h3><Truck size={16} className="inline-block text-blue-600 mr-1" /> Viajes Activos</h3>
          <p className="value text-blue-600">{widgets.viajesActivos}</p>
          <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>Vehículos en tránsito.</p>
        </div>
        <div className="stat-card">
          <h3><Wallet size={16} className="inline-block text-red-600 mr-1" /> Deuda Total (Cobrar)</h3>
          <p className="value text-red-600">Gs. {widgets.deudaTotal.toLocaleString()}</p>
          <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>Cuentas corrientes de clientes.</p>
        </div>
        <div className="stat-card">
          <h3><Activity size={16} className="inline-block text-purple-600 mr-1" /> Rentabilidad Mes</h3>
          <p className="value text-purple-600">{widgets.rentabilidad}%</p>
          <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>Margen bruto YTD.</p>
        </div>
      </div>
    </div>
  );
}
