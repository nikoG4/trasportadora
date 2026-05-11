import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { AlertTriangle, Ban, CheckCircle, Clock, MapPin, Navigation, Plus, RefreshCw, Route, Save, Search, Send, Truck, X } from 'lucide-react';
import { connectBackofficeRealtime } from '../realtime';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

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

const failIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const branchIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const driverIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-violet.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const today = () => new Date().toISOString().slice(0, 10);

type RouteStop = {
  localId: string;
  pedido_id?: number | null;
  tipo_parada: string;
  nombre_contacto?: string;
  documento_contacto?: string;
  telefono_contacto?: string;
  direccion?: string;
  referencia_direccion?: string;
  latitud?: number | null;
  longitud?: number | null;
  observaciones?: string;
  pedido?: any;
};

function stopIcon(stop: any) {
  if (['FALLIDO', 'CANCELADO'].includes(String(stop.estado || '').toUpperCase())) return failIcon;
  const type = String(stop.tipo_parada || '').toUpperCase();
  return type.includes('RETIRO') && !type.includes('ENTREGA') ? pickupIcon : deliveryIcon;
}

function ManualStopMapPicker({ onPick }: { onPick: (latitud: number, longitud: number) => void }) {
  useMapEvents({
    click(event) {
      onPick(Number(event.latlng.lat.toFixed(6)), Number(event.latlng.lng.toFixed(6)));
    }
  });
  return null;
}

function toNumber(value: any) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function formatCoords(lat: any, lng: any) {
  const parsedLat = toNumber(lat);
  const parsedLng = toNumber(lng);
  if (parsedLat === null || parsedLng === null) return 'Sin coordenadas';
  return `${parsedLat.toFixed(6)}, ${parsedLng.toFixed(6)}`;
}

function formatSignalTime(value: any) {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleString('es-PY', { dateStyle: 'short', timeStyle: 'short' });
}

async function apiJson(path: string, options?: RequestInit) {
  const response = await fetch(path, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || (response.status === 401 ? 'Sesion expirada. Inicie sesion nuevamente.' : 'No se pudo completar la operacion.'));
  }
  return data;
}

async function apiArray(path: string, options?: RequestInit) {
  const data = await apiJson(path, options);
  return Array.isArray(data) ? data : [];
}

function authHeaders(extra?: Record<string, string>) {
  const token = localStorage.getItem('adminToken');
  return {
    ...(extra || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

function makeStopsFromCandidate(pedido: any): RouteStop[] {
  const stops: RouteStop[] = [];
  const hasPickup = ['domicilio', 'puerta', 'retiro_en_puerta'].includes(String(pedido.modalidad_retiro || '').toLowerCase());
  const hasDelivery = ['domicilio', 'puerta', 'entrega_en_puerta'].includes(String(pedido.modalidad_entrega || '').toLowerCase());
  const sameCoords = toNumber(pedido.latitud_retiro) !== null
    && toNumber(pedido.longitud_retiro) !== null
    && Number(pedido.latitud_retiro) === Number(pedido.latitud_entrega)
    && Number(pedido.longitud_retiro) === Number(pedido.longitud_entrega);

  if (hasPickup && hasDelivery && sameCoords) {
    stops.push({
      localId: `p-${pedido.id}-ambas-${Date.now()}`,
      pedido_id: pedido.id,
      tipo_parada: 'RETIRO_Y_ENTREGA',
      nombre_contacto: pedido.remitente_nombre || pedido.destinatario_nombre,
      documento_contacto: pedido.remitente_doc || pedido.destinatario_doc,
      telefono_contacto: pedido.remitente_tel || pedido.destinatario_tel,
      direccion: pedido.remitente_direccion || pedido.destinatario_direccion,
      latitud: toNumber(pedido.latitud_retiro),
      longitud: toNumber(pedido.longitud_retiro),
      pedido
    });
    return stops;
  }

  if (hasPickup) {
    stops.push({
      localId: `p-${pedido.id}-retiro-${Date.now()}`,
      pedido_id: pedido.id,
      tipo_parada: 'RETIRO',
      nombre_contacto: pedido.remitente_nombre,
      documento_contacto: pedido.remitente_doc,
      telefono_contacto: pedido.remitente_tel,
      direccion: pedido.remitente_direccion,
      latitud: toNumber(pedido.latitud_retiro),
      longitud: toNumber(pedido.longitud_retiro),
      pedido
    });
  }

  if (hasDelivery || stops.length === 0) {
    stops.push({
      localId: `p-${pedido.id}-entrega-${Date.now()}`,
      pedido_id: pedido.id,
      tipo_parada: hasDelivery ? 'ENTREGA' : 'OTRO',
      nombre_contacto: pedido.destinatario_nombre || pedido.remitente_nombre,
      documento_contacto: pedido.destinatario_doc || pedido.remitente_doc,
      telefono_contacto: pedido.destinatario_tel || pedido.remitente_tel,
      direccion: pedido.destinatario_direccion || pedido.remitente_direccion,
      latitud: toNumber(pedido.latitud_entrega || pedido.latitud_retiro),
      longitud: toNumber(pedido.longitud_entrega || pedido.longitud_retiro),
      pedido
    });
  }
  return stops;
}

function normalizedText(value: any) {
  return String(value || '').trim().toLowerCase();
}

function isReturnStop(stop: any) {
  return String(stop?.tipo_parada || '').toUpperCase() === 'SUCURSAL_RETORNO';
}

function makeReturnStop(sucursal: any): RouteStop {
  return {
    localId: `return-sucursal-${sucursal.id}`,
    pedido_id: null,
    tipo_parada: 'SUCURSAL_RETORNO',
    nombre_contacto: sucursal.nombre || 'Sucursal base',
    telefono_contacto: sucursal.telefono || '',
    direccion: sucursal.direccion || sucursal.ciudad || '',
    latitud: toNumber(sucursal.latitud),
    longitud: toNumber(sucursal.longitud),
    observaciones: 'Retorno automatico a sucursal'
  };
}

export default function RepartoLocal() {
  const [candidatos, setCandidatos] = useState<any[]>([]);
  const [viajes, setViajes] = useState<any[]>([]);
  const [choferes, setChoferes] = useState<any[]>([]);
  const [vehiculos, setVehiculos] = useState<any[]>([]);
  const [sucursales, setSucursales] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedViaje, setSelectedViaje] = useState<any | null>(null);
  const [routeStops, setRouteStops] = useState<RouteStop[]>([]);
  const [showManualStop, setShowManualStop] = useState(false);
  const [manualStop, setManualStop] = useState<RouteStop>({ localId: '', tipo_parada: 'OTRO', direccion: '' });
  const [feedback, setFeedback] = useState('');
  const [manualMapsLink, setManualMapsLink] = useState('');
  const [manualFeedback, setManualFeedback] = useState('');
  const [mapDefault, setMapDefault] = useState({ center: [-25.5167, -54.6167] as [number, number], zoom: 13 });
  const [filters, setFilters] = useState({
    fecha: today(),
    ciudad: '',
    zona: '',
    cliente: '',
    estado: '',
    tipo_parada: '',
    solo_con_coordenadas: false
  });
  const [form, setForm] = useState({
    fecha_inicio: `${today()}T08:00`,
    sucursal_origen_id: '',
    ciudad: '',
    zona: '',
    chofer_id: '',
    vehiculo_id: '',
    observaciones: ''
  });

  const loadBaseData = () => {
    setFeedback('');
    Promise.all([
      apiArray('/api/choferes'),
      apiArray('/api/vehiculos'),
      apiArray('/api/sucursales'),
      apiArray('/api/configuracion')
    ])
      .then(([choferesData, vehiculosData, sucursalesData, configData]) => {
        setChoferes(choferesData.filter((c: any) => c.estado === 'activo'));
        setVehiculos(vehiculosData.filter((v: any) => ['disponible', 'en_viaje'].includes(v.estado)));
        setSucursales(sucursalesData);
        const byKey = Object.fromEntries(configData.map((item: any) => [item.clave, item.valor]));
        const lat = toNumber(byKey.map_default_lat);
        const lng = toNumber(byKey.map_default_lng);
        const zoom = toNumber(byKey.map_default_zoom);
        if (lat !== null && lng !== null) {
          setMapDefault({ center: [lat, lng], zoom: zoom !== null ? Math.min(19, Math.max(3, zoom)) : 13 });
        }
      })
      .catch(error => setFeedback(error.message));
  };

  const loadCandidatos = () => {
    setLoading(true);
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== '' && value !== false) params.set(key, String(value));
    });
    apiArray(`/api/reparto-local/pedidos-candidatos?${params.toString()}`)
      .then(data => {
        setCandidatos(data);
        setFeedback('');
      })
      .catch(error => {
        setCandidatos([]);
        setFeedback(error.message);
      })
      .finally(() => setLoading(false));
  };

  const loadViajes = () => {
    const params = new URLSearchParams();
    if (filters.fecha) params.set('fecha', filters.fecha);
    apiArray(`/api/reparto-local/viajes?${params.toString()}`)
      .then(data => {
        setViajes(data);
        setFeedback('');
      })
      .catch(error => {
        setViajes([]);
        setFeedback(error.message);
      });
  };

  useEffect(() => {
    loadBaseData();
  }, []);

  useEffect(() => {
    loadCandidatos();
    loadViajes();
  }, [filters.fecha]);

  useEffect(() => {
    return connectBackofficeRealtime(message => {
      const event = message.event || message.type || '';
      const payload = message.payload || {};
      if (!event.startsWith('monitor.reparto') && event !== 'monitor.driver.location.updated') return;
      loadViajes();
      const selectedId = selectedViaje?.viaje?.id;
      if (selectedId && Number(payload.viaje_id) === Number(selectedId)) {
        openViaje(Number(selectedId));
      }
    });
  }, [selectedViaje?.viaje?.id, filters.fecha]);

  const selectedSucursal = useMemo(() => {
    return sucursales.find(s => String(s.id) === String(form.sucursal_origen_id)) || null;
  }, [sucursales, form.sucursal_origen_id]);

  const sucursalCities = useMemo(() => {
    return Array.from(new Set(sucursales.map(s => String(s.ciudad || '').trim()).filter(Boolean))).sort();
  }, [sucursales]);

  const plannedStops = useMemo(() => {
    if (routeStops.length === 0) return routeStops;
    if (!selectedSucursal || routeStops.some(isReturnStop)) return routeStops;
    return [...routeStops, makeReturnStop(selectedSucursal)];
  }, [routeStops, selectedSucursal]);

  const handleCityChange = (ciudad: string) => {
    const match = sucursales.find(s => normalizedText(s.ciudad) === normalizedText(ciudad));
    setForm(prev => ({
      ...prev,
      ciudad,
      sucursal_origen_id: match ? String(match.id) : prev.sucursal_origen_id
    }));
  };

  const addCandidate = (pedido: any) => {
    if (routeStops.some(stop => stop.pedido_id === pedido.id)) {
      alert('Este pedido ya esta agregado a la ruta.');
      return;
    }
    setRouteStops(prev => [...prev, ...makeStopsFromCandidate(pedido)]);
  };

  const moveStop = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= routeStops.length) return;
    const next = [...routeStops];
    [next[index], next[target]] = [next[target], next[index]];
    setRouteStops(next);
  };

  const optimizeStops = () => {
    const withCoords = routeStops.filter(stop => toNumber(stop.latitud) !== null && toNumber(stop.longitud) !== null);
    const withoutCoords = routeStops.filter(stop => toNumber(stop.latitud) === null || toNumber(stop.longitud) === null);
    if (withCoords.length < 2) return alert('Se necesitan al menos dos paradas con coordenadas para optimizar.');
    const ordered: RouteStop[] = [withCoords[0]];
    const remaining = withCoords.slice(1);
    while (remaining.length) {
      const current = ordered[ordered.length - 1];
      let bestIndex = 0;
      let bestDistance = Infinity;
      remaining.forEach((candidate, index) => {
        const dx = Number(candidate.latitud) - Number(current.latitud);
        const dy = Number(candidate.longitud) - Number(current.longitud);
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestIndex = index;
        }
      });
      ordered.push(remaining.splice(bestIndex, 1)[0]);
    }
    setRouteStops([...ordered, ...withoutCoords]);
  };

  const saveViaje = async (e: FormEvent) => {
    e.preventDefault();
    if (routeStops.length === 0) return alert('Agregue al menos una parada a la ruta.');
    const body = {
      ...form,
      auto_optimizar: false,
      retornar_sucursal: true,
      paradas: plannedStops.map((stop, index) => ({ ...stop, orden: index + 1 }))
    };
    const data = await apiJson('/api/reparto-local/viajes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      .catch(error => {
        alert(error.message);
        return null;
      });
    if (!data) return;
    setRouteStops([]);
    loadCandidatos();
    loadViajes();
    setSelectedViaje(data);
    alert('Reparto local creado y asignado al chofer.');
  };

  const openViaje = async (id: number) => {
    const data = await apiJson(`/api/reparto-local/viajes/${id}`)
      .catch(error => {
        alert(error.message);
        return null;
      });
    if (!data) return;
    setSelectedViaje(data);
  };

  const cerrarReparto = async (estado: 'FINALIZADO' | 'CON_INCIDENCIAS' | 'CANCELADO') => {
    if (!selectedViaje?.viaje?.id) return;
    const pendientes = Number(selectedViaje.avance?.pendientes || 0);
    const label = estado === 'CANCELADO' ? 'cancelar' : estado === 'CON_INCIDENCIAS' ? 'cerrar con incidencias' : 'finalizar';
    if (estado === 'FINALIZADO' && pendientes > 0) {
      alert('No se puede finalizar limpio con paradas pendientes. Use cerrar con incidencias o resuelva las paradas.');
      return;
    }
    if (!confirm(`Confirma ${label} el reparto #${selectedViaje.viaje.id}?`)) return;
    const observaciones = estado !== 'FINALIZADO' ? prompt('Observaciones o motivo (opcional):') || '' : '';
    const data = await apiJson(`/api/reparto-local/viajes/${selectedViaje.viaje.id}/cerrar`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        estado,
        observaciones,
        resolver_pendientes: estado !== 'FINALIZADO'
      })
    }).catch(error => {
      alert(error.message);
      return null;
    });
    if (!data) return;
    setSelectedViaje(data);
    loadViajes();
    loadBaseData();
  };

  const addManualStop = () => {
    const stopType = String(manualStop.tipo_parada || '').toUpperCase();
    const selectedPedido = manualStop.pedido_id
      ? candidatos.find(pedido => Number(pedido.id) === Number(manualStop.pedido_id))
      : null;
    if (stopType === 'ENTREGA' && !selectedPedido) {
      return alert('Una parada de ENTREGA debe estar asociada a un pedido pendiente. Seleccione un pedido o agregue la parada como OTRO.');
    }
    if (!manualStop.direccion && !manualStop.nombre_contacto) return alert('Ingrese al menos contacto o direccion.');
    const stopToAdd = selectedPedido ? {
      ...manualStop,
      pedido_id: selectedPedido.id,
      nombre_contacto: manualStop.nombre_contacto || selectedPedido.destinatario_nombre || selectedPedido.cliente_nombre || '',
      documento_contacto: manualStop.documento_contacto || selectedPedido.destinatario_doc || '',
      telefono_contacto: manualStop.telefono_contacto || selectedPedido.destinatario_tel || '',
      direccion: manualStop.direccion || selectedPedido.destinatario_direccion || '',
      latitud: manualStop.latitud ?? selectedPedido.latitud_entrega ?? null,
      longitud: manualStop.longitud ?? selectedPedido.longitud_entrega ?? null,
      pedido: selectedPedido
    } : { ...manualStop, pedido_id: null };
    setRouteStops(prev => [...prev, { ...stopToAdd, localId: `manual-${Date.now()}` }]);
    setManualStop({ localId: '', tipo_parada: 'OTRO', direccion: '' });
    setManualMapsLink('');
    setManualFeedback('');
    setShowManualStop(false);
  };

  const openManualStop = () => {
    setManualStop({ localId: '', tipo_parada: 'OTRO', direccion: '' });
    setManualMapsLink('');
    setManualFeedback('');
    setShowManualStop(true);
  };

  const setManualCoordinates = (latitud: number, longitud: number) => {
    setManualStop(prev => ({ ...prev, latitud, longitud }));
    setManualFeedback(`Posicion marcada: ${latitud}, ${longitud}`);
  };

  const applyManualDeliveryPedido = (pedidoId: string) => {
    const selectedPedido = candidatos.find(pedido => Number(pedido.id) === Number(pedidoId));
    if (!selectedPedido) {
      setManualStop(prev => ({ ...prev, pedido_id: null }));
      return;
    }
    setManualStop(prev => ({
      ...prev,
      pedido_id: selectedPedido.id,
      nombre_contacto: selectedPedido.destinatario_nombre || selectedPedido.cliente_nombre || prev.nombre_contacto || '',
      documento_contacto: selectedPedido.destinatario_doc || prev.documento_contacto || '',
      telefono_contacto: selectedPedido.destinatario_tel || prev.telefono_contacto || '',
      direccion: selectedPedido.destinatario_direccion || prev.direccion || '',
      latitud: selectedPedido.latitud_entrega ?? prev.latitud ?? null,
      longitud: selectedPedido.longitud_entrega ?? prev.longitud ?? null,
      observaciones: prev.observaciones || `Entrega asociada a ${selectedPedido.numero_guia || `pedido #${selectedPedido.id}`}`
    }));
  };

  const handleParseManualMapsLink = async () => {
    if (!manualMapsLink.trim()) return;
    setManualFeedback('Extrayendo coordenadas...');
    const data = await apiJson('/api/utils/parse-maps-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ link: manualMapsLink.trim() })
      })
      .catch(error => {
        setManualFeedback(error.message);
        return null;
      });
    if (!data) return;
    setManualCoordinates(Number(data.latitud), Number(data.longitud));
  };

  const mapStops = useMemo(() => {
    const detailStops = Array.isArray(selectedViaje?.paradas) ? selectedViaje.paradas : [];
    return selectedViaje ? detailStops : plannedStops;
  }, [selectedViaje, plannedStops]);

  const monitoringPoints = useMemo(() => {
    const trip = selectedViaje?.viaje || null;
    if (!trip) return [];
    const points: any[] = [];
    if (toNumber(trip.sucursal_origen_latitud) !== null && toNumber(trip.sucursal_origen_longitud) !== null) {
      points.push({
        key: 'sucursal',
        tipo: 'Sucursal base',
        nombre: trip.sucursal_origen_nombre || 'Sucursal base',
        direccion: trip.sucursal_origen_direccion || '',
        latitud: trip.sucursal_origen_latitud,
        longitud: trip.sucursal_origen_longitud,
        icon: branchIcon
      });
    }
    if (toNumber(trip.chofer_latitud) !== null && toNumber(trip.chofer_longitud) !== null) {
      points.push({
        key: 'chofer',
        tipo: 'Ubicacion chofer',
        nombre: trip.chofer_nombre || 'Chofer',
        direccion: trip.chofer_tracking_timestamp ? `Ultima senal: ${trip.chofer_tracking_timestamp}` : 'Ultima senal GPS',
        latitud: trip.chofer_latitud,
        longitud: trip.chofer_longitud,
        icon: driverIcon
      });
    }
    return points;
  }, [selectedViaje]);

  const center = useMemo<[number, number]>(() => {
    const first = mapStops.find((stop: any) => toNumber(stop.latitud) !== null && toNumber(stop.longitud) !== null);
    if (first) return [Number(first.latitud), Number(first.longitud)];
    const monitoring = monitoringPoints.find((point: any) => toNumber(point.latitud) !== null && toNumber(point.longitud) !== null);
    return monitoring ? [Number(monitoring.latitud), Number(monitoring.longitud)] : mapDefault.center;
  }, [mapStops, monitoringPoints, mapDefault.center]);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="header-actions">
        <div>
          <h1 className="page-title"><Route size={28} /> Reparto local</h1>
          <p style={{ color: '#6b7280', marginTop: '0.25rem' }}>Planificacion, ruta, paradas y avance operativo dentro de ciudad o zona.</p>
        </div>
        <button className="btn btn-outline" onClick={() => { loadCandidatos(); loadViajes(); }}>
          <RefreshCw size={18} /> Actualizar
        </button>
      </div>
      {feedback && (
        <div style={{ border: '1px solid #fecaca', background: '#fef2f2', color: '#991b1b', borderRadius: '0.5rem', padding: '0.75rem 1rem' }}>
          {feedback}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '320px minmax(420px, 1fr) 360px', gap: '1rem', minHeight: '680px' }}>
        <section className="stat-card" style={{ padding: '1rem', overflow: 'auto' }}>
          <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Search size={18} /> Pedidos candidatos</h3>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            <input placeholder="Ciudad" value={filters.ciudad} onChange={e => setFilters({ ...filters, ciudad: e.target.value })} />
            <input placeholder="Zona / barrio" value={filters.zona} onChange={e => setFilters({ ...filters, zona: e.target.value })} />
            <input placeholder="Cliente, remitente o destinatario" value={filters.cliente} onChange={e => setFilters({ ...filters, cliente: e.target.value })} />
            <select value={filters.tipo_parada} onChange={e => setFilters({ ...filters, tipo_parada: e.target.value })}>
              <option value="">Retiro o entrega</option>
              <option value="RETIRO">Retiro</option>
              <option value="ENTREGA">Entrega</option>
            </select>
            <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', color: '#374151' }}>
              <input type="checkbox" checked={filters.solo_con_coordenadas} onChange={e => setFilters({ ...filters, solo_con_coordenadas: e.target.checked })} />
              Solo con coordenadas
            </label>
            <button className="btn btn-primary" onClick={loadCandidatos} disabled={loading}>
              <Search size={16} /> {loading ? 'Buscando...' : 'Buscar'}
            </button>
          </div>

          <div style={{ marginTop: '1rem', display: 'grid', gap: '0.75rem' }}>
            {candidatos.map(pedido => (
              <div key={pedido.id} style={{ border: '1px solid #e5e7eb', borderRadius: '0.5rem', padding: '0.75rem', background: '#fff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
                  <strong>{pedido.numero_guia || `Pedido #${pedido.id}`}</strong>
                  <span className="status-badge pendiente">{pedido.estado}</span>
                </div>
                <div style={{ fontSize: '0.85rem', color: '#4b5563', marginTop: '0.5rem', display: 'grid', gap: '0.25rem' }}>
                  <span><strong>Cliente:</strong> {pedido.cliente_nombre || 'S/N'}</span>
                  <span><strong>Retiro:</strong> {pedido.remitente_direccion || pedido.sucursal_origen_nombre || 'S/N'}</span>
                  <span><strong>Entrega:</strong> {pedido.destinatario_direccion || pedido.sucursal_destino_nombre || 'S/N'}</span>
                  {!pedido.has_coordinates && <span style={{ color: '#b45309' }}><AlertTriangle size={14} /> Sin coordenadas completas</span>}
                </div>
                <button className="btn btn-outline" style={{ width: '100%', justifyContent: 'center', marginTop: '0.75rem' }} onClick={() => addCandidate(pedido)}>
                  <Plus size={16} /> Agregar a ruta
                </button>
              </div>
            ))}
            {candidatos.length === 0 && <p style={{ color: '#6b7280', textAlign: 'center', padding: '1rem' }}>No hay candidatos con esos filtros.</p>}
          </div>
        </section>

        <section style={{ display: 'flex', flexDirection: 'column', gap: '1rem', minWidth: 0 }}>
          <form className="stat-card" style={{ padding: '1rem' }} onSubmit={saveViaje}>
            <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Truck size={18} /> Crear reparto local</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.75rem' }}>
              <input type="datetime-local" required value={form.fecha_inicio} onChange={e => setForm({ ...form, fecha_inicio: e.target.value })} />
              <select required value={form.sucursal_origen_id} onChange={e => setForm({ ...form, sucursal_origen_id: e.target.value })}>
                <option value="">Sucursal base</option>
                {sucursales.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
              <input list="ciudades-reparto-local" placeholder="Ciudad" value={form.ciudad} onChange={e => handleCityChange(e.target.value)} />
              <datalist id="ciudades-reparto-local">
                {sucursalCities.map(city => <option key={city} value={city} />)}
              </datalist>
              <input placeholder="Zona / barrio" value={form.zona} onChange={e => setForm({ ...form, zona: e.target.value })} />
              <select required value={form.chofer_id} onChange={e => setForm({ ...form, chofer_id: e.target.value })}>
                <option value="">Chofer</option>
                {choferes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
              <select required value={form.vehiculo_id} onChange={e => setForm({ ...form, vehiculo_id: e.target.value })}>
                <option value="">Vehiculo</option>
                {vehiculos.map(v => <option key={v.id} value={v.id}>{v.chapa} - {v.marca}</option>)}
              </select>
            </div>
            <textarea rows={2} placeholder="Observaciones de despacho" value={form.observaciones} onChange={e => setForm({ ...form, observaciones: e.target.value })} style={{ marginTop: '0.75rem' }} />
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-outline" onClick={optimizeStops}><Navigation size={16} /> Optimizar orden</button>
              <button type="button" className="btn btn-outline" onClick={openManualStop}><MapPin size={16} /> Parada manual</button>
              <button type="submit" className="btn btn-primary"><Save size={16} /> Guardar y asignar</button>
            </div>
          </form>

          <div style={{ flex: 1, minHeight: 420, border: '1px solid #e5e7eb', borderRadius: '0.5rem', overflow: 'hidden' }}>
            <MapContainer center={center} zoom={mapDefault.zoom} style={{ height: '100%', width: '100%' }} key={`${center[0]}-${center[1]}-${mapDefault.zoom}-${mapStops.length}-${monitoringPoints.length}`}>
              <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              {mapStops.map((stop: any, index: number) => toNumber(stop.latitud) !== null && toNumber(stop.longitud) !== null ? (
                <Marker key={stop.id || stop.localId || index} position={[Number(stop.latitud), Number(stop.longitud)]} icon={stopIcon(stop)}>
                  <Popup>
                    <strong>#{index + 1} {stop.tipo_parada}</strong><br />
                    {stop.nombre_contacto || 'Sin contacto'}<br />
                    {stop.direccion || 'Sin direccion'}<br />
                    Estado: {stop.estado || 'PENDIENTE'}
                  </Popup>
                </Marker>
              ) : null)}
              {monitoringPoints.map((point: any) => (
                <Marker key={point.key} position={[Number(point.latitud), Number(point.longitud)]} icon={point.icon}>
                  <Popup>
                    <strong>{point.tipo}</strong><br />
                    {point.nombre}<br />
                    {point.direccion || 'Sin direccion'}<br />
                    {formatCoords(point.latitud, point.longitud)}
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        </section>

        <section style={{ display: 'flex', flexDirection: 'column', gap: '1rem', minWidth: 0 }}>
          <div className="stat-card" style={{ padding: '1rem', maxHeight: '430px', overflow: 'auto' }}>
            <h3 style={{ marginBottom: '1rem' }}>Ruta armada ({plannedStops.length})</h3>
            {plannedStops.map((stop, index) => {
              const automaticReturn = isReturnStop(stop);
              return (
              <div key={stop.localId} style={{ border: '1px solid #e5e7eb', borderRadius: '0.5rem', padding: '0.75rem', marginBottom: '0.75rem', background: '#fff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
                  <strong>#{index + 1} {stop.tipo_parada}</strong>
                  {!automaticReturn && (
                    <button className="btn btn-outline" style={{ padding: '0.25rem 0.5rem' }} onClick={() => setRouteStops(prev => prev.filter(item => item.localId !== stop.localId))}><X size={14} /></button>
                  )}
                </div>
                <div style={{ color: '#4b5563', fontSize: '0.85rem', marginTop: '0.5rem' }}>
                  <div>{stop.nombre_contacto || 'Sin contacto'}</div>
                  <div>{stop.direccion || 'Sin direccion'}</div>
                  <div>{automaticReturn ? 'Retorno automatico a sucursal' : stop.pedido?.numero_guia ? `Guia ${stop.pedido.numero_guia}` : 'Parada manual'}</div>
                </div>
                {!automaticReturn && (
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <button className="btn btn-outline" style={{ padding: '0.25rem 0.5rem' }} onClick={() => moveStop(index, -1)}>Subir</button>
                    <button className="btn btn-outline" style={{ padding: '0.25rem 0.5rem' }} onClick={() => moveStop(index, 1)}>Bajar</button>
                  </div>
                )}
              </div>
              );
            })}
            {routeStops.length === 0 && <p style={{ color: '#6b7280' }}>Agregue pedidos o paradas manuales para armar la ruta.</p>}
            {routeStops.length > 0 && selectedSucursal && toNumber(selectedSucursal.latitud) === null && (
              <p style={{ color: '#b45309', fontSize: '0.85rem' }}>La sucursal de retorno no tiene coordenadas cargadas; se guardara igualmente como ultima parada.</p>
            )}
          </div>

          <div className="stat-card" style={{ padding: '1rem', flex: 1, overflow: 'auto' }}>
            <h3 style={{ marginBottom: '1rem' }}>Monitoreo del dia</h3>
            {viajes.map(viaje => (
              <button key={viaje.id} type="button" onClick={() => openViaje(viaje.id)} style={{ width: '100%', textAlign: 'left', border: '1px solid #e5e7eb', background: selectedViaje?.viaje?.id === viaje.id ? '#eff6ff' : '#fff', borderRadius: '0.5rem', padding: '0.75rem', marginBottom: '0.75rem', cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
                  <strong>Reparto #{viaje.id}</strong>
                  <span className="status-badge pendiente">{viaje.estado}</span>
                </div>
                <div style={{ color: '#4b5563', fontSize: '0.85rem', marginTop: '0.5rem' }}>
                  <div>{viaje.chofer_nombre || 'Sin chofer'} - {viaje.vehiculo_chapa || 'Sin vehiculo'}</div>
                  <div>{viaje.zona || viaje.ciudad || 'Zona sin definir'}</div>
                  <div>{viaje.total_paradas || 0} paradas | {viaje.completadas || 0} listas | {viaje.fallidas || 0} fallidas</div>
                  <div style={{ marginTop: '0.5rem', display: 'grid', gap: '0.25rem' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <MapPin size={14} color="#2563eb" />
                      Sucursal: {viaje.sucursal_origen_nombre || 'Sin sucursal'} - {formatCoords(viaje.sucursal_origen_latitud, viaje.sucursal_origen_longitud)}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Navigation size={14} color="#7c3aed" />
                      Chofer: {formatCoords(viaje.chofer_latitud, viaje.chofer_longitud)}
                      {viaje.chofer_tracking_timestamp ? ` | ${formatSignalTime(viaje.chofer_tracking_timestamp)}` : ''}
                    </span>
                  </div>
                </div>
              </button>
            ))}
            {viajes.length === 0 && <p style={{ color: '#6b7280' }}>No hay repartos locales para la fecha.</p>}
          </div>
        </section>
      </div>

      {selectedViaje && (
        <div className="stat-card" style={{ padding: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
            <h3>Detalle reparto #{selectedViaje.viaje?.id || selectedViaje.id}</h3>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {!['FINALIZADO', 'CON_INCIDENCIAS', 'CANCELADO'].includes(String(selectedViaje.viaje?.estado || '').toUpperCase()) && (
                <>
                  <button className="btn btn-outline" onClick={() => cerrarReparto('FINALIZADO')}><CheckCircle size={16} /> Finalizar</button>
                  <button className="btn btn-outline" onClick={() => cerrarReparto('CON_INCIDENCIAS')}><AlertTriangle size={16} /> Cerrar con incidencias</button>
                  <button className="btn btn-outline" style={{ color: '#b91c1c', borderColor: '#ef4444' }} onClick={() => cerrarReparto('CANCELADO')}><Ban size={16} /> Cancelar</button>
                </>
              )}
              <button className="btn btn-outline" onClick={() => setSelectedViaje(null)}><X size={16} /> Cerrar detalle</button>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', margin: '1rem 0' }}>
            <div><Clock size={16} /> Pendientes: {selectedViaje.avance?.pendientes ?? 0}</div>
            <div><CheckCircle size={16} /> Completadas: {selectedViaje.avance?.completadas ?? 0}</div>
            <div><AlertTriangle size={16} /> Fallidas: {selectedViaje.avance?.fallidas ?? 0}</div>
            <div><Send size={16} /> Avance: {selectedViaje.avance?.porcentaje ?? 0}%</div>
          </div>
          <div className="table-container" style={{ marginTop: 0, overflowX: 'auto' }}>
            <table>
              <thead>
                <tr><th>#</th><th>Tipo</th><th>Contacto</th><th>Direccion</th><th>Estado</th><th>Hora</th></tr>
              </thead>
              <tbody>
                {(selectedViaje.paradas || []).map((stop: any) => (
                  <tr key={stop.id}>
                    <td>{stop.orden}</td>
                    <td>{stop.tipo_parada}</td>
                    <td>{stop.nombre_contacto}<br /><span style={{ color: '#6b7280' }}>{stop.telefono_contacto}</span></td>
                    <td>{stop.direccion}</td>
                    <td>{stop.estado}</td>
                    <td>{stop.llegada_real || '-'} / {stop.salida_real || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showManualStop && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 720 }}>
            <div className="modal-header">
              <h2>Parada manual</h2>
              <button onClick={() => setShowManualStop(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X /></button>
            </div>
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              <select value={manualStop.tipo_parada} onChange={e => setManualStop({ ...manualStop, tipo_parada: e.target.value, pedido_id: e.target.value === 'ENTREGA' ? manualStop.pedido_id : null })}>
                <option value="SUCURSAL">Sucursal</option>
                <option value="OTRO">Otro</option>
                <option value="RETIRO">Retiro</option>
                <option value="ENTREGA">Entrega</option>
              </select>
              {String(manualStop.tipo_parada || '').toUpperCase() === 'ENTREGA' && (
                <div style={{ display: 'grid', gap: '0.35rem' }}>
                  <select required value={manualStop.pedido_id || ''} onChange={e => applyManualDeliveryPedido(e.target.value)}>
                    <option value="">Pedido pendiente de entrega</option>
                    {candidatos.map(pedido => (
                      <option key={pedido.id} value={pedido.id}>
                        {pedido.numero_guia || `Pedido #${pedido.id}`} - {pedido.destinatario_nombre || pedido.cliente_nombre || 'Sin destinatario'}
                      </option>
                    ))}
                  </select>
                  <span style={{ color: '#6b7280', fontSize: '0.85rem' }}>
                    Las entregas operativas no pueden quedar sueltas: deben actualizar un pedido real.
                  </span>
                </div>
              )}
              <input placeholder="Contacto / lugar" value={manualStop.nombre_contacto || ''} onChange={e => setManualStop({ ...manualStop, nombre_contacto: e.target.value })} />
              <input placeholder="Telefono" value={manualStop.telefono_contacto || ''} onChange={e => setManualStop({ ...manualStop, telefono_contacto: e.target.value })} />
              <input placeholder="Direccion" value={manualStop.direccion || ''} onChange={e => setManualStop({ ...manualStop, direccion: e.target.value })} />
              <input placeholder="Referencia" value={manualStop.referencia_direccion || ''} onChange={e => setManualStop({ ...manualStop, referencia_direccion: e.target.value })} />
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input value={manualMapsLink} onChange={e => setManualMapsLink(e.target.value)} placeholder="Enlace de Google Maps" style={{ flex: 1 }} />
                <button type="button" className="btn btn-outline" onClick={handleParseManualMapsLink}>Extraer</button>
              </div>
              <div style={{ height: 260, border: '1px solid #e5e7eb', borderRadius: '0.5rem', overflow: 'hidden' }}>
                <MapContainer
                  center={toNumber(manualStop.latitud) !== null && toNumber(manualStop.longitud) !== null ? [Number(manualStop.latitud), Number(manualStop.longitud)] : center}
                  zoom={toNumber(manualStop.latitud) !== null && toNumber(manualStop.longitud) !== null ? 16 : mapDefault.zoom}
                  style={{ height: '100%', width: '100%' }}
                  key={`manual-${manualStop.latitud || center[0]}-${manualStop.longitud || center[1]}`}
                >
                  <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <ManualStopMapPicker onPick={setManualCoordinates} />
                  {toNumber(manualStop.latitud) !== null && toNumber(manualStop.longitud) !== null ? (
                    <Marker position={[Number(manualStop.latitud), Number(manualStop.longitud)]}>
                      <Popup>Parada manual</Popup>
                    </Marker>
                  ) : null}
                </MapContainer>
              </div>
              {manualFeedback && <div style={{ color: manualFeedback.includes('No se') ? '#991b1b' : '#4b5563', fontSize: '0.85rem' }}>{manualFeedback}</div>}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <input type="number" step="any" placeholder="Latitud" value={manualStop.latitud ?? ''} onChange={e => setManualStop({ ...manualStop, latitud: e.target.value ? Number(e.target.value) : null })} />
                <input type="number" step="any" placeholder="Longitud" value={manualStop.longitud ?? ''} onChange={e => setManualStop({ ...manualStop, longitud: e.target.value ? Number(e.target.value) : null })} />
              </div>
              <textarea rows={3} placeholder="Observaciones" value={manualStop.observaciones || ''} onChange={e => setManualStop({ ...manualStop, observaciones: e.target.value })} />
              <button className="btn btn-primary" onClick={addManualStop}><Plus size={16} /> Agregar parada</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
