import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Package, Truck } from 'lucide-react';

// Fix for default marker icons in react-leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom icons for orders
const pickupIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const deliveryIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

export default function Mapa() {
  const [tracking, setTracking] = useState<any[]>([]);
  const [pedidosDomicilio, setPedidosDomicilio] = useState<any[]>([]);
  const [viajesActivos, setViajesActivos] = useState<any[]>([]);

  useEffect(() => {
    // In a real app this would use WebSockets or polling
    const fetchTracking = () => {
      fetch('/api/tracking/latest')
        .then(res => res.json())
        .then(data => setTracking(data))
        .catch(console.error);
    };

    const fetchPedidos = () => {
      fetch('/api/pedidos')
        .then(res => res.json())
        .then(data => {
          // Filter pedidos a domicilio (or 'puerta')
          const aDomicilio = data.filter((p: any) => p.modalidad_retiro === 'domicilio' || p.modalidad_entrega === 'domicilio' || p.modalidad_retiro === 'puerta' || p.modalidad_entrega === 'puerta');
          setPedidosDomicilio(aDomicilio);
        })
        .catch(console.error);
    };

    const fetchViajes = () => {
      fetch('/api/viajes')
        .then(res => res.json())
        .then(data => {
          // Filter 'en_ruta' and 'reparto_local'
          const activos = data.filter((v: any) => v.estado === 'en_ruta' && v.tipo_viaje === 'reparto_local');
          setViajesActivos(activos);
        })
        .catch(console.error);
    };

    fetchTracking();
    fetchPedidos();
    fetchViajes();
    
    const interval = setInterval(() => {
      fetchTracking();
      fetchViajes(); // Keep deliveries list updated too
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  // Helper to generate deterministic lat/lng based on ID for demo purposes (Since we don't have real coordinates in DB)
  const generateLat = (id: number, type: string) => -25.2865 + (id * 0.005) * (type === 'retiro' ? 1 : -1);
  const generateLng = (id: number, type: string) => -57.6363 + ((id % 3) * 0.005) * (type === 'retiro' ? -1 : 1);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="page-header" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
        <h1 style={{margin: 0}}>Monitoreo GPS de Flota y Pedidos</h1>
        <div style={{display: 'flex', gap: '1rem', fontSize: '0.85rem'}}>
          <span style={{display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'white', padding: '0.25rem 0.5rem', borderRadius: '0.375rem', border: '1px solid #e5e7eb'}}>
            <img src="https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-orange.png" alt="retiro" style={{width: 12}}/>
            Retiro a Domicilio
          </span>
          <span style={{display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'white', padding: '0.25rem 0.5rem', borderRadius: '0.375rem', border: '1px solid #e5e7eb'}}>
            <img src="https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png" alt="entrega" style={{width: 12}}/>
            Entrega a Domicilio
          </span>
          <span style={{display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'white', padding: '0.25rem 0.5rem', borderRadius: '0.375rem', border: '1px solid #e5e7eb'}}>
            <img src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png" alt="vehiculo" style={{width: 12}}/>
            Vehículos en Ruta
          </span>
        </div>
      </div>
      
      <div style={{ display: 'flex', gap: '1rem', flex: 1, marginTop: '1rem', minHeight: 0 }}>
        {/* Panel Lateral: Entregas Locales Activas */}
        <div style={{ width: '300px', background: 'white', borderRadius: '0.5rem', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '1rem', background: '#f8fafc', borderBottom: '1px solid var(--border-color)' }}>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem' }}>
              <Package size={20} /> Entregas Locales
            </h3>
            <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.875rem', color: '#64748b' }}>
              Viajes de reparto en ruta
            </p>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
            {viajesActivos.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#94a3b8', marginTop: '2rem' }}>No hay repartos locales en curso.</p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {viajesActivos.map(viaje => (
                  <li key={viaje.id} style={{ border: '1px solid #e2e8f0', borderRadius: '0.5rem', padding: '0.75rem', backgroundColor: '#fdf8f6' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                      <strong style={{ fontSize: '0.9rem', color: '#0f172a' }}>Viaje #{viaje.id}</strong>
                      <span style={{ background: '#dcfce7', color: '#166534', padding: '0.125rem 0.375rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 600 }}>
                        EN RUTA
                      </span>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#475569', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Truck size={14} /> {viaje.vehiculo_chapa}</span>
                      <span>👨‍✈️ {viaje.chofer_nombre}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Mapa */}
        <div style={{ flex: 1, borderRadius: '0.5rem', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
          <MapContainer center={[-25.2865, -57.6363]} zoom={13} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            
            {/* Vehículos */}
            {tracking.map(t => (
              <Marker key={`tracking-${t.vehiculo_id || 'chofer'}-${t.chofer_id || t.id}`} position={[t.latitud, t.longitud]}>
                <Popup>
                  <strong>🚚 Vehículo:</strong> {t.chapa}<br/>
                  <strong>Última actualización:</strong> {new Date(t.timestamp).toLocaleString()}
                </Popup>
              </Marker>
            ))}

            {/* Pedidos - Retiros a Domicilio */}
            {pedidosDomicilio.filter(p => p.modalidad_retiro === 'domicilio' || p.modalidad_retiro === 'puerta').map(p => (
               <Marker key={'retiro-'+p.id} position={[generateLat(p.id, 'retiro'), generateLng(p.id, 'retiro')]} icon={pickupIcon}>
                 <Popup>
                   <strong>📦 Retiro a Domicilio</strong><br/>
                   <strong>Guía:</strong> {p.numero_guia || p.id}<br/>
                   <strong>Remitente:</strong> {p.remitente_nombre || 'N/A'}<br/>
                   <strong>Dirección:</strong> {p.remitente_direccion || 'N/A'}<br/>
                   <strong>Teléfono:</strong> {p.remitente_tel || 'N/A'}<br/>
                   <strong>Estado:</strong> {p.estado.toUpperCase()}
                 </Popup>
               </Marker>
            ))}

            {/* Pedidos - Entregas a Domicilio */}
            {pedidosDomicilio.filter(p => p.modalidad_entrega === 'domicilio' || p.modalidad_entrega === 'puerta').map(p => (
               <Marker key={'entrega-'+p.id} position={[generateLat(p.id, 'entrega'), generateLng(p.id, 'entrega')]} icon={deliveryIcon}>
                 <Popup>
                   <strong>📍 Entrega a Domicilio</strong><br/>
                   <strong>Guía:</strong> {p.numero_guia || p.id}<br/>
                   <strong>Destinatario:</strong> {p.destinatario_nombre || 'N/A'}<br/>
                   <strong>Dirección:</strong> {p.destinatario_direccion || 'N/A'}<br/>
                   <strong>Teléfono:</strong> {p.destinatario_tel || 'N/A'}<br/>
                   <strong>Estado:</strong> {p.estado.toUpperCase()}
                 </Popup>
               </Marker>
            ))}

          </MapContainer>
        </div>
      </div>
    </div>
  );
}
