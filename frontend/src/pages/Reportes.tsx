import { useState } from 'react';
import { BarChart2, Download, Filter } from 'lucide-react';

export default function Reportes() {
  const [activeTab, setActiveTab] = useState('chofer');

  // Datos simulados
  const rentabilidadChofer = [
    { nombre: 'Luis Díaz', viajes: 15, ingresos: 12500000, gastos: 4200000, margen: '66.4%' },
    { nombre: 'Carlos R.', viajes: 10, ingresos: 8300000, gastos: 3100000, margen: '62.6%' }
  ];

  const rentabilidadVehiculo = [
    { chapa: 'AAA 111', marca: 'Toyota', km: 2450, ingresos: 15000000, gastos: 5500000, costoKm: 2244, margen: '63.3%' },
    { chapa: 'BBB 222', marca: 'Mercedes', km: 3100, ingresos: 22000000, gastos: 8800000, costoKm: 2838, margen: '60.0%' }
  ];

  const agingReport = [
    { cliente: 'Supermercados Stock', total: 4500000, alDia: 4500000, v30: 0, v60: 0, v90: 0 },
    { cliente: 'Farmacenter SA', total: 6200000, alDia: 3200000, v30: 2000000, v60: 1000000, v90: 0 }
  ];

  return (
    <div>
      <div className="header-actions">
        <h1 className="page-title"><BarChart2 className="inline-block mr-2" /> Reportes Financieros</h1>
        <button className="btn btn-outline">
          <Download size={20} className="mr-2" /> Exportar Excel
        </button>
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '1rem' }}>
        <button className={`btn ${activeTab === 'chofer' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('chofer')}>
          Rentabilidad x Chofer
        </button>
        <button className={`btn ${activeTab === 'vehiculo' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('vehiculo')}>
          Rentabilidad x Vehículo
        </button>
        <button className={`btn ${activeTab === 'general' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('general')}>
          Reporte General (P&L)
        </button>
        <button className={`btn ${activeTab === 'morosidad' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('morosidad')}>
          Morosidad (Aging)
        </button>
      </div>

      <div style={{ background: 'white', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1.5rem', display: 'flex', gap: '1rem', border: '1px solid #e5e7eb', alignItems: 'center' }}>
        <Filter size={20} className="text-gray-500" />
        <select className="form-control" style={{ width: 'auto' }}>
          <option>Mes Actual (Abril 2026)</option>
          <option>Mes Anterior</option>
          <option>YTD (Año a la fecha)</option>
          <option>Rango Personalizado...</option>
        </select>
        <select className="form-control" style={{ width: 'auto' }}>
          <option>Todas las Sucursales</option>
          <option>Asunción Central</option>
          <option>Ciudad del Este</option>
        </select>
      </div>

      {activeTab === 'chofer' && (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Chofer</th>
                <th>Viajes Completados</th>
                <th>Fletes Generados (Ingresos)</th>
                <th>Gastos Operativos (Viáticos)</th>
                <th>Margen Bruto</th>
              </tr>
            </thead>
            <tbody>
              {rentabilidadChofer.map((r, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 'bold' }}>{r.nombre}</td>
                  <td>{r.viajes}</td>
                  <td style={{ color: '#16a34a' }}>Gs. {r.ingresos.toLocaleString()}</td>
                  <td style={{ color: '#dc2626' }}>Gs. {r.gastos.toLocaleString()}</td>
                  <td style={{ fontWeight: 'bold' }}>{r.margen}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'vehiculo' && (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Vehículo</th>
                <th>KM Recorridos</th>
                <th>Fletes Generados (Ingresos)</th>
                <th>Gastos (Comb. + Mantenimiento)</th>
                <th>Costo x KM</th>
                <th>Margen Bruto</th>
              </tr>
            </thead>
            <tbody>
              {rentabilidadVehiculo.map((r, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 'bold' }}>{r.chapa} - {r.marca}</td>
                  <td>{r.km.toLocaleString()} km</td>
                  <td style={{ color: '#16a34a' }}>Gs. {r.ingresos.toLocaleString()}</td>
                  <td style={{ color: '#dc2626' }}>Gs. {r.gastos.toLocaleString()}</td>
                  <td>Gs. {r.costoKm}</td>
                  <td style={{ fontWeight: 'bold' }}>{r.margen}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'general' && (
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          <div className="stat-card" style={{ marginBottom: '1rem', textAlign: 'center' }}>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Ingresos Totales (Facturación)</h3>
            <p className="value text-green-600">Gs. 45,000,000</p>
          </div>
          <div className="stat-card" style={{ marginBottom: '1rem', textAlign: 'center' }}>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Gastos Totales (Operativos + Fijos)</h3>
            <p className="value text-red-600">Gs. 18,500,000</p>
          </div>
          <div className="stat-card" style={{ background: '#eff6ff', borderColor: '#bfdbfe', textAlign: 'center' }}>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Flujo de Caja Neto</h3>
            <p className="value text-blue-600">Gs. 26,500,000</p>
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
                <th>Al Día</th>
                <th>Vencido a 30 días</th>
                <th>Vencido a 60 días</th>
                <th>Vencido a 90+ días</th>
              </tr>
            </thead>
            <tbody>
              {agingReport.map((a, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 'bold' }}>{a.cliente}</td>
                  <td style={{ fontWeight: 'bold' }}>Gs. {a.total.toLocaleString()}</td>
                  <td style={{ color: '#16a34a' }}>Gs. {a.alDia.toLocaleString()}</td>
                  <td style={{ color: a.v30 > 0 ? '#ca8a04' : '#6b7280' }}>Gs. {a.v30.toLocaleString()}</td>
                  <td style={{ color: a.v60 > 0 ? '#ea580c' : '#6b7280' }}>Gs. {a.v60.toLocaleString()}</td>
                  <td style={{ color: a.v90 > 0 ? '#dc2626' : '#6b7280', fontWeight: a.v90 > 0 ? 'bold' : 'normal' }}>Gs. {a.v90.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
