import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  AlertTriangle,
  BadgeCheck,
  Boxes,
  FileSignature,
  PackageCheck,
  Plus,
  ReceiptText,
  Store,
  Trash2,
  Wrench
} from 'lucide-react';

type Tab = 'mantenimiento' | 'proveedores' | 'compras' | 'incidencias' | 'inventario' | 'tarifarios' | 'contratos';

type ResumenGestion = {
  mantenimientosPendientes: number;
  costoMantenimientoPendiente: number;
  incidenciasAbiertas: number;
  incidenciasCriticas: number;
  comprasPendientes: number;
  totalComprasPendientes: number;
  bajoStock: number;
  contratosVigentes: number;
  limiteCreditoContratado: number;
  tarifariosActivos: number;
  proximosMantenimientos: Array<{ id: number; tipo: string; descripcion: string; fecha_programada: string; prioridad: string; chapa: string }>;
  incidenciasRecientes: Array<{ id: number; tipo: string; titulo: string; prioridad: string; estado: string; fecha_reporte: string; cliente_nombre: string }>;
};

type Proveedor = {
  id: number;
  nombre: string;
  ruc: string;
  telefono: string;
  email: string;
  direccion: string;
  categoria: string;
  contacto: string;
  estado: string;
  observaciones: string;
};

type Compra = {
  id: number;
  proveedor_id?: number;
  proveedor_nombre: string;
  fecha: string;
  concepto: string;
  categoria: string;
  monto: number;
  estado: string;
  metodo_pago: string;
  comprobante: string;
  observaciones: string;
};

type Mantenimiento = {
  id: number;
  vehiculo_id: number;
  vehiculo_chapa: string;
  vehiculo_marca: string;
  proveedor_nombre: string;
  tipo: string;
  descripcion: string;
  fecha_programada: string;
  fecha_realizada: string;
  kilometraje_programado: number;
  costo_estimado: number;
  costo_real: number;
  prioridad: string;
  estado: string;
  observaciones: string;
};

type Incidencia = {
  id: number;
  tipo: string;
  referencia_tipo: string;
  referencia_id?: number;
  cliente_id?: number;
  cliente_nombre: string;
  pedido_id?: number;
  numero_guia: string;
  viaje_id?: number;
  prioridad: string;
  estado: string;
  titulo: string;
  descripcion: string;
  fecha_reporte: string;
  fecha_cierre: string;
  responsable: string;
  resolucion: string;
};

type Inventario = {
  id: number;
  sucursal_id?: number;
  sucursal_nombre: string;
  codigo: string;
  descripcion: string;
  categoria: string;
  cantidad: number;
  unidad: string;
  ubicacion: string;
  estado: string;
  fecha_actualizacion: string;
  observaciones: string;
};

type Tarifario = {
  id: number;
  nombre: string;
  origen_sucursal_id?: number;
  destino_sucursal_id?: number;
  origen_nombre: string;
  destino_nombre: string;
  tipo_carga: string;
  modalidad: string;
  precio_base: number;
  precio_kg: number;
  precio_m3: number;
  seguro_porcentaje: number;
  vigencia_desde: string;
  vigencia_hasta: string;
  estado: string;
};

type Contrato = {
  id: number;
  cliente_id: number;
  cliente_nombre: string;
  tarifario_nombre: string;
  nombre: string;
  fecha_inicio: string;
  fecha_fin: string;
  condicion_pago: string;
  limite_credito: number;
  tarifario_id?: number;
  estado: string;
  observaciones: string;
};

type Vehiculo = {
  id: number;
  chapa: string;
  marca: string;
  modelo: string;
};

type Sucursal = {
  id: number;
  nombre: string;
};

type Cliente = {
  id: number;
  nombre: string;
};

const today = new Date().toISOString().slice(0, 10);

const defaultResumen: ResumenGestion = {
  mantenimientosPendientes: 0,
  costoMantenimientoPendiente: 0,
  incidenciasAbiertas: 0,
  incidenciasCriticas: 0,
  comprasPendientes: 0,
  totalComprasPendientes: 0,
  bajoStock: 0,
  contratosVigentes: 0,
  limiteCreditoContratado: 0,
  tarifariosActivos: 0,
  proximosMantenimientos: [],
  incidenciasRecientes: []
};

const emptyProveedor = {
  nombre: '',
  ruc: '',
  telefono: '',
  email: '',
  direccion: '',
  categoria: 'Mantenimiento',
  contacto: '',
  estado: 'activo',
  observaciones: ''
};

const emptyCompra = {
  proveedor_id: '',
  fecha: today,
  concepto: '',
  categoria: 'Insumos',
  monto: '',
  estado: 'pendiente',
  metodo_pago: 'Transferencia',
  comprobante: '',
  observaciones: ''
};

const emptyMantenimiento = {
  vehiculo_id: '',
  proveedor_id: '',
  tipo: 'Preventivo',
  descripcion: '',
  fecha_programada: today,
  fecha_realizada: '',
  kilometraje_programado: '',
  costo_estimado: '',
  costo_real: '',
  prioridad: 'media',
  estado: 'programado',
  observaciones: ''
};

const emptyIncidencia = {
  tipo: 'Reclamo cliente',
  referencia_tipo: 'pedido',
  referencia_id: '',
  cliente_id: '',
  pedido_id: '',
  viaje_id: '',
  prioridad: 'media',
  estado: 'abierta',
  titulo: '',
  descripcion: '',
  fecha_reporte: today,
  fecha_cierre: '',
  responsable: '',
  resolucion: ''
};

const emptyInventario = {
  sucursal_id: '',
  codigo: '',
  descripcion: '',
  categoria: 'Embalaje',
  cantidad: '',
  unidad: 'unidad',
  ubicacion: '',
  estado: 'disponible',
  fecha_actualizacion: today,
  observaciones: ''
};

const emptyTarifario = {
  nombre: '',
  origen_sucursal_id: '',
  destino_sucursal_id: '',
  tipo_carga: 'General',
  modalidad: 'puerta-puerta',
  precio_base: '',
  precio_kg: '',
  precio_m3: '',
  seguro_porcentaje: '1',
  vigencia_desde: today,
  vigencia_hasta: '2026-12-31',
  estado: 'activo'
};

const emptyContrato = {
  cliente_id: '',
  nombre: '',
  fecha_inicio: today,
  fecha_fin: '2026-12-31',
  condicion_pago: 'Credito 30 dias',
  limite_credito: '',
  tarifario_id: '',
  estado: 'activo',
  observaciones: ''
};

function money(value: number | string | null | undefined) {
  return `Gs. ${Number(value || 0).toLocaleString('es-PY')}`;
}

async function api(path: string, options?: RequestInit) {
  const response = await fetch(path, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'No se pudo completar la operacion');
  }
  return data;
}

function compactNumber(value: number) {
  return Number(value || 0).toLocaleString('es-PY');
}

export default function GestionIntegral() {
  const [activeTab, setActiveTab] = useState<Tab>('mantenimiento');
  const [resumen, setResumen] = useState<ResumenGestion>(defaultResumen);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [compras, setCompras] = useState<Compra[]>([]);
  const [mantenimientos, setMantenimientos] = useState<Mantenimiento[]>([]);
  const [incidencias, setIncidencias] = useState<Incidencia[]>([]);
  const [inventario, setInventario] = useState<Inventario[]>([]);
  const [tarifarios, setTarifarios] = useState<Tarifario[]>([]);
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [proveedorForm, setProveedorForm] = useState(emptyProveedor);
  const [compraForm, setCompraForm] = useState(emptyCompra);
  const [mantenimientoForm, setMantenimientoForm] = useState(emptyMantenimiento);
  const [incidenciaForm, setIncidenciaForm] = useState(emptyIncidencia);
  const [inventarioForm, setInventarioForm] = useState(emptyInventario);
  const [tarifarioForm, setTarifarioForm] = useState(emptyTarifario);
  const [contratoForm, setContratoForm] = useState(emptyContrato);
  const [feedback, setFeedback] = useState('');

  const proveedoresActivos = useMemo(() => proveedores.filter(proveedor => proveedor.estado === 'activo'), [proveedores]);
  const tarifariosActivos = useMemo(() => tarifarios.filter(tarifario => tarifario.estado === 'activo'), [tarifarios]);

  const loadData = () => {
    Promise.all([
      api('/api/gestion/resumen'),
      api('/api/gestion/proveedores'),
      api('/api/gestion/compras'),
      api('/api/gestion/mantenimientos'),
      api('/api/gestion/incidencias'),
      api('/api/gestion/inventario'),
      api('/api/gestion/tarifarios'),
      api('/api/gestion/contratos'),
      api('/api/vehiculos'),
      api('/api/sucursales'),
      api('/api/clientes')
    ])
      .then(([
        resumenData,
        proveedoresData,
        comprasData,
        mantenimientosData,
        incidenciasData,
        inventarioData,
        tarifariosData,
        contratosData,
        vehiculosData,
        sucursalesData,
        clientesData
      ]) => {
        setResumen(resumenData);
        setProveedores(proveedoresData);
        setCompras(comprasData);
        setMantenimientos(mantenimientosData);
        setIncidencias(incidenciasData);
        setInventario(inventarioData);
        setTarifarios(tarifariosData);
        setContratos(contratosData);
        setVehiculos(vehiculosData);
        setSucursales(sucursalesData);
        setClientes(clientesData);
      })
      .catch(error => setFeedback(error.message));
  };

  useEffect(() => {
    loadData();
  }, []);

  const save = async (path: string, payload: Record<string, string | number | null>, success: string) => {
    await api(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    setFeedback(success);
    loadData();
  };

  const update = async (path: string, payload: Record<string, string | number | null>) => {
    await api(path, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    setFeedback('Registro actualizado');
    loadData();
  };

  const remove = async (path: string) => {
    await api(path, { method: 'DELETE' });
    setFeedback('Registro eliminado');
    loadData();
  };

  const submitProveedor = async (event: FormEvent) => {
    event.preventDefault();
    await save('/api/gestion/proveedores', proveedorForm, 'Proveedor guardado');
    setProveedorForm(emptyProveedor);
  };

  const submitCompra = async (event: FormEvent) => {
    event.preventDefault();
    await save('/api/gestion/compras', {
      ...compraForm,
      proveedor_id: compraForm.proveedor_id || null,
      monto: Number(compraForm.monto || 0)
    }, 'Compra registrada');
    setCompraForm(emptyCompra);
  };

  const submitMantenimiento = async (event: FormEvent) => {
    event.preventDefault();
    await save('/api/gestion/mantenimientos', {
      ...mantenimientoForm,
      proveedor_id: mantenimientoForm.proveedor_id || null,
      kilometraje_programado: Number(mantenimientoForm.kilometraje_programado || 0),
      costo_estimado: Number(mantenimientoForm.costo_estimado || 0),
      costo_real: Number(mantenimientoForm.costo_real || 0)
    }, 'Mantenimiento programado');
    setMantenimientoForm(emptyMantenimiento);
  };

  const submitIncidencia = async (event: FormEvent) => {
    event.preventDefault();
    await save('/api/gestion/incidencias', {
      ...incidenciaForm,
      referencia_id: incidenciaForm.referencia_id || null,
      cliente_id: incidenciaForm.cliente_id || null,
      pedido_id: incidenciaForm.pedido_id || null,
      viaje_id: incidenciaForm.viaje_id || null
    }, 'Incidencia registrada');
    setIncidenciaForm(emptyIncidencia);
  };

  const submitInventario = async (event: FormEvent) => {
    event.preventDefault();
    await save('/api/gestion/inventario', {
      ...inventarioForm,
      sucursal_id: inventarioForm.sucursal_id || null,
      cantidad: Number(inventarioForm.cantidad || 0)
    }, 'Item de deposito guardado');
    setInventarioForm(emptyInventario);
  };

  const submitTarifario = async (event: FormEvent) => {
    event.preventDefault();
    await save('/api/gestion/tarifarios', {
      ...tarifarioForm,
      origen_sucursal_id: tarifarioForm.origen_sucursal_id || null,
      destino_sucursal_id: tarifarioForm.destino_sucursal_id || null,
      precio_base: Number(tarifarioForm.precio_base || 0),
      precio_kg: Number(tarifarioForm.precio_kg || 0),
      precio_m3: Number(tarifarioForm.precio_m3 || 0),
      seguro_porcentaje: Number(tarifarioForm.seguro_porcentaje || 0)
    }, 'Tarifario guardado');
    setTarifarioForm(emptyTarifario);
  };

  const submitContrato = async (event: FormEvent) => {
    event.preventDefault();
    await save('/api/gestion/contratos', {
      ...contratoForm,
      tarifario_id: contratoForm.tarifario_id || null,
      limite_credito: Number(contratoForm.limite_credito || 0)
    }, 'Contrato guardado');
    setContratoForm(emptyContrato);
  };

  const proveedorSelect = (value: string, onChange: (nextValue: string) => void) => (
    <select value={value} onChange={event => onChange(event.target.value)}>
      <option value="">Sin proveedor</option>
      {proveedoresActivos.map(proveedor => <option key={proveedor.id} value={proveedor.id}>{proveedor.nombre}</option>)}
    </select>
  );

  const sucursalSelect = (value: string, onChange: (nextValue: string) => void, emptyLabel = 'Sin sucursal') => (
    <select value={value} onChange={event => onChange(event.target.value)}>
      <option value="">{emptyLabel}</option>
      {sucursales.map(sucursal => <option key={sucursal.id} value={sucursal.id}>{sucursal.nombre}</option>)}
    </select>
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Gestion Integral</h1>
          <p style={{ color: '#6b7280', marginTop: '0.25rem' }}>
            Mantenimiento, proveedores, compras, incidencias, inventario, tarifarios y contratos comerciales.
          </p>
        </div>
        {feedback && <span className="status-badge entregado">{feedback}</span>}
      </div>

      <div className="dashboard-grid">
        <div className="stat-card">
          <div className="stat-title"><Wrench size={16} /> Mantenimiento pendiente</div>
          <div className="stat-value">{resumen.mantenimientosPendientes}</div>
          <p style={{ color: '#6b7280' }}>{money(resumen.costoMantenimientoPendiente)} estimados</p>
        </div>
        <div className="stat-card">
          <div className="stat-title"><AlertTriangle size={16} /> Incidencias abiertas</div>
          <div className="stat-value">{resumen.incidenciasAbiertas}</div>
          <p style={{ color: '#6b7280' }}>{resumen.incidenciasCriticas} criticas o altas</p>
        </div>
        <div className="stat-card">
          <div className="stat-title"><ReceiptText size={16} /> Compras pendientes</div>
          <div className="stat-value">{resumen.comprasPendientes}</div>
          <p style={{ color: '#6b7280' }}>{money(resumen.totalComprasPendientes)}</p>
        </div>
        <div className="stat-card">
          <div className="stat-title"><FileSignature size={16} /> Contratos vigentes</div>
          <div className="stat-value">{resumen.contratosVigentes}</div>
          <p style={{ color: '#6b7280' }}>{money(resumen.limiteCreditoContratado)} credito contratado</p>
        </div>
        <div className="stat-card">
          <div className="stat-title"><Boxes size={16} /> Stock sensible</div>
          <div className="stat-value">{resumen.bajoStock}</div>
          <p style={{ color: '#6b7280' }}>Items bajo stock o retenidos</p>
        </div>
        <div className="stat-card">
          <div className="stat-title"><PackageCheck size={16} /> Tarifarios activos</div>
          <div className="stat-value">{resumen.tarifariosActivos}</div>
          <p style={{ color: '#6b7280' }}>Rutas y modalidades comerciales</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="stat-card">
          <h3 style={{ marginBottom: '0.75rem' }}>Proximos mantenimientos</h3>
          {resumen.proximosMantenimientos.length === 0 ? (
            <p style={{ color: '#6b7280' }}>Sin mantenimientos pendientes.</p>
          ) : resumen.proximosMantenimientos.map(item => (
            <p key={item.id} style={{ marginBottom: '0.5rem' }}>
              <strong>{item.chapa}</strong> - {item.tipo}: {item.fecha_programada} ({item.prioridad})
            </p>
          ))}
        </div>
        <div className="stat-card">
          <h3 style={{ marginBottom: '0.75rem' }}>Incidencias recientes</h3>
          {resumen.incidenciasRecientes.length === 0 ? (
            <p style={{ color: '#6b7280' }}>Sin incidencias recientes.</p>
          ) : resumen.incidenciasRecientes.map(item => (
            <p key={item.id} style={{ marginBottom: '0.5rem' }}>
              <strong>{item.titulo}</strong> - {item.estado} ({item.prioridad})
            </p>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', borderBottom: '1px solid #e5e7eb', paddingBottom: '1rem' }}>
        <button className={`btn ${activeTab === 'mantenimiento' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('mantenimiento')}>Mantenimiento</button>
        <button className={`btn ${activeTab === 'proveedores' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('proveedores')}>Proveedores</button>
        <button className={`btn ${activeTab === 'compras' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('compras')}>Compras</button>
        <button className={`btn ${activeTab === 'incidencias' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('incidencias')}>Incidencias</button>
        <button className={`btn ${activeTab === 'inventario' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('inventario')}>Inventario</button>
        <button className={`btn ${activeTab === 'tarifarios' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('tarifarios')}>Tarifarios</button>
        <button className={`btn ${activeTab === 'contratos' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('contratos')}>Contratos</button>
      </div>

      {activeTab === 'mantenimiento' && (
        <>
          <div className="stat-card" style={{ marginTop: '1.5rem' }}>
            <h2 style={{ marginBottom: '1rem' }}><Wrench size={18} /> Programar mantenimiento</h2>
            <form onSubmit={submitMantenimiento}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                <div className="form-group">
                  <label>Vehiculo</label>
                  <select required value={mantenimientoForm.vehiculo_id} onChange={event => setMantenimientoForm({ ...mantenimientoForm, vehiculo_id: event.target.value })}>
                    <option value="">Seleccionar</option>
                    {vehiculos.map(vehiculo => <option key={vehiculo.id} value={vehiculo.id}>{vehiculo.chapa} - {vehiculo.marca} {vehiculo.modelo}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Proveedor</label>
                  {proveedorSelect(mantenimientoForm.proveedor_id, value => setMantenimientoForm({ ...mantenimientoForm, proveedor_id: value }))}
                </div>
                <div className="form-group">
                  <label>Tipo</label>
                  <select value={mantenimientoForm.tipo} onChange={event => setMantenimientoForm({ ...mantenimientoForm, tipo: event.target.value })}>
                    <option>Preventivo</option>
                    <option>Correctivo</option>
                    <option>Neumaticos</option>
                    <option>Documental</option>
                    <option>Inspeccion</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Fecha programada</label>
                  <input type="date" value={mantenimientoForm.fecha_programada} onChange={event => setMantenimientoForm({ ...mantenimientoForm, fecha_programada: event.target.value })} />
                </div>
                <div className="form-group">
                  <label>Kilometraje objetivo</label>
                  <input type="number" value={mantenimientoForm.kilometraje_programado} onChange={event => setMantenimientoForm({ ...mantenimientoForm, kilometraje_programado: event.target.value })} />
                </div>
                <div className="form-group">
                  <label>Costo estimado</label>
                  <input type="number" value={mantenimientoForm.costo_estimado} onChange={event => setMantenimientoForm({ ...mantenimientoForm, costo_estimado: event.target.value })} />
                </div>
                <div className="form-group">
                  <label>Prioridad</label>
                  <select value={mantenimientoForm.prioridad} onChange={event => setMantenimientoForm({ ...mantenimientoForm, prioridad: event.target.value })}>
                    <option>baja</option>
                    <option>media</option>
                    <option>alta</option>
                    <option>critica</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Descripcion</label>
                  <input required value={mantenimientoForm.descripcion} onChange={event => setMantenimientoForm({ ...mantenimientoForm, descripcion: event.target.value })} />
                </div>
              </div>
              <button className="btn btn-primary" type="submit"><Plus size={18} /> Programar</button>
            </form>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Vehiculo</th>
                  <th>Tipo</th>
                  <th>Descripcion</th>
                  <th>Fecha</th>
                  <th>Costo</th>
                  <th>Prioridad</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {mantenimientos.map(item => (
                  <tr key={item.id}>
                    <td><strong>{item.vehiculo_chapa}</strong><br /><span style={{ color: '#6b7280' }}>{item.proveedor_nombre || '-'}</span></td>
                    <td>{item.tipo}</td>
                    <td>{item.descripcion}</td>
                    <td>{item.fecha_programada || '-'}</td>
                    <td>{money(item.costo_real || item.costo_estimado)}</td>
                    <td>{item.prioridad}</td>
                    <td><span className={`status-badge ${item.estado === 'finalizado' ? 'entregado' : 'asignado'}`}>{item.estado}</span></td>
                    <td style={{ display: 'flex', gap: '0.5rem' }}>
                      {item.estado !== 'finalizado' && (
                        <button className="btn btn-outline" onClick={() => update(`/api/gestion/mantenimientos/${item.id}`, { estado: 'finalizado', fecha_realizada: today, costo_real: item.costo_estimado })}><BadgeCheck size={16} /> Finalizar</button>
                      )}
                      <button className="btn btn-outline" onClick={() => remove(`/api/gestion/mantenimientos/${item.id}`)}><Trash2 size={16} /> Eliminar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {activeTab === 'proveedores' && (
        <>
          <div className="stat-card" style={{ marginTop: '1.5rem' }}>
            <h2 style={{ marginBottom: '1rem' }}><Store size={18} /> Nuevo proveedor</h2>
            <form onSubmit={submitProveedor}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                <div className="form-group"><label>Nombre</label><input required value={proveedorForm.nombre} onChange={event => setProveedorForm({ ...proveedorForm, nombre: event.target.value })} /></div>
                <div className="form-group"><label>RUC</label><input value={proveedorForm.ruc} onChange={event => setProveedorForm({ ...proveedorForm, ruc: event.target.value })} /></div>
                <div className="form-group"><label>Categoria</label><select value={proveedorForm.categoria} onChange={event => setProveedorForm({ ...proveedorForm, categoria: event.target.value })}><option>Mantenimiento</option><option>Combustible</option><option>Insumos deposito</option><option>Seguros</option><option>Tecnologia</option><option>Otros</option></select></div>
                <div className="form-group"><label>Contacto</label><input value={proveedorForm.contacto} onChange={event => setProveedorForm({ ...proveedorForm, contacto: event.target.value })} /></div>
                <div className="form-group"><label>Telefono</label><input value={proveedorForm.telefono} onChange={event => setProveedorForm({ ...proveedorForm, telefono: event.target.value })} /></div>
                <div className="form-group"><label>Email</label><input type="email" value={proveedorForm.email} onChange={event => setProveedorForm({ ...proveedorForm, email: event.target.value })} /></div>
                <div className="form-group"><label>Direccion</label><input value={proveedorForm.direccion} onChange={event => setProveedorForm({ ...proveedorForm, direccion: event.target.value })} /></div>
                <div className="form-group"><label>Observaciones</label><input value={proveedorForm.observaciones} onChange={event => setProveedorForm({ ...proveedorForm, observaciones: event.target.value })} /></div>
              </div>
              <button className="btn btn-primary" type="submit"><Plus size={18} /> Guardar proveedor</button>
            </form>
          </div>

          <div className="table-container">
            <table>
              <thead><tr><th>Proveedor</th><th>Categoria</th><th>Contacto</th><th>Telefono</th><th>Estado</th><th>Acciones</th></tr></thead>
              <tbody>
                {proveedores.map(proveedor => (
                  <tr key={proveedor.id}>
                    <td><strong>{proveedor.nombre}</strong><br /><span style={{ color: '#6b7280' }}>{proveedor.ruc || proveedor.email}</span></td>
                    <td>{proveedor.categoria}</td>
                    <td>{proveedor.contacto}</td>
                    <td>{proveedor.telefono}</td>
                    <td><span className={`status-badge ${proveedor.estado === 'activo' ? 'entregado' : 'pendiente'}`}>{proveedor.estado}</span></td>
                    <td><button className="btn btn-outline" onClick={() => remove(`/api/gestion/proveedores/${proveedor.id}`)}><Trash2 size={16} /> Inactivar</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {activeTab === 'compras' && (
        <>
          <div className="stat-card" style={{ marginTop: '1.5rem' }}>
            <h2 style={{ marginBottom: '1rem' }}><ReceiptText size={18} /> Registrar compra o gasto</h2>
            <form onSubmit={submitCompra}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                <div className="form-group"><label>Proveedor</label>{proveedorSelect(compraForm.proveedor_id, value => setCompraForm({ ...compraForm, proveedor_id: value }))}</div>
                <div className="form-group"><label>Fecha</label><input type="date" value={compraForm.fecha} onChange={event => setCompraForm({ ...compraForm, fecha: event.target.value })} /></div>
                <div className="form-group"><label>Concepto</label><input required value={compraForm.concepto} onChange={event => setCompraForm({ ...compraForm, concepto: event.target.value })} /></div>
                <div className="form-group"><label>Categoria</label><select value={compraForm.categoria} onChange={event => setCompraForm({ ...compraForm, categoria: event.target.value })}><option>Combustible</option><option>Insumos</option><option>Mantenimiento</option><option>Servicios</option><option>Administrativo</option></select></div>
                <div className="form-group"><label>Monto</label><input type="number" value={compraForm.monto} onChange={event => setCompraForm({ ...compraForm, monto: event.target.value })} /></div>
                <div className="form-group"><label>Metodo</label><select value={compraForm.metodo_pago} onChange={event => setCompraForm({ ...compraForm, metodo_pago: event.target.value })}><option>Transferencia</option><option>Efectivo</option><option>Credito</option><option>Cheque</option></select></div>
                <div className="form-group"><label>Comprobante</label><input value={compraForm.comprobante} onChange={event => setCompraForm({ ...compraForm, comprobante: event.target.value })} /></div>
                <div className="form-group"><label>Observaciones</label><input value={compraForm.observaciones} onChange={event => setCompraForm({ ...compraForm, observaciones: event.target.value })} /></div>
              </div>
              <button className="btn btn-primary" type="submit"><Plus size={18} /> Guardar compra</button>
            </form>
          </div>

          <div className="table-container">
            <table>
              <thead><tr><th>Fecha</th><th>Proveedor</th><th>Concepto</th><th>Categoria</th><th>Monto</th><th>Estado</th><th>Acciones</th></tr></thead>
              <tbody>
                {compras.map(compra => (
                  <tr key={compra.id}>
                    <td>{compra.fecha}</td>
                    <td>{compra.proveedor_nombre || '-'}</td>
                    <td>{compra.concepto}<br /><span style={{ color: '#6b7280' }}>{compra.comprobante}</span></td>
                    <td>{compra.categoria}</td>
                    <td>{money(compra.monto)}</td>
                    <td><span className={`status-badge ${compra.estado === 'aprobada' ? 'entregado' : 'pendiente'}`}>{compra.estado}</span></td>
                    <td style={{ display: 'flex', gap: '0.5rem' }}>
                      {compra.estado === 'pendiente' && <button className="btn btn-outline" onClick={() => update(`/api/gestion/compras/${compra.id}`, { estado: 'aprobada' })}><BadgeCheck size={16} /> Aprobar</button>}
                      <button className="btn btn-outline" onClick={() => remove(`/api/gestion/compras/${compra.id}`)}><Trash2 size={16} /> Eliminar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {activeTab === 'incidencias' && (
        <>
          <div className="stat-card" style={{ marginTop: '1.5rem' }}>
            <h2 style={{ marginBottom: '1rem' }}><AlertTriangle size={18} /> Registrar incidencia</h2>
            <form onSubmit={submitIncidencia}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                <div className="form-group"><label>Tipo</label><select value={incidenciaForm.tipo} onChange={event => setIncidenciaForm({ ...incidenciaForm, tipo: event.target.value })}><option>Reclamo cliente</option><option>Siniestro</option><option>Demora</option><option>Dano mercaderia</option><option>Faltante</option><option>Seguridad</option></select></div>
                <div className="form-group"><label>Prioridad</label><select value={incidenciaForm.prioridad} onChange={event => setIncidenciaForm({ ...incidenciaForm, prioridad: event.target.value })}><option>baja</option><option>media</option><option>alta</option><option>critica</option></select></div>
                <div className="form-group"><label>Fecha</label><input type="date" value={incidenciaForm.fecha_reporte} onChange={event => setIncidenciaForm({ ...incidenciaForm, fecha_reporte: event.target.value })} /></div>
                <div className="form-group"><label>Cliente</label><select value={incidenciaForm.cliente_id} onChange={event => setIncidenciaForm({ ...incidenciaForm, cliente_id: event.target.value })}><option value="">Sin cliente</option>{clientes.map(cliente => <option key={cliente.id} value={cliente.id}>{cliente.nombre}</option>)}</select></div>
                <div className="form-group"><label>Responsable</label><input value={incidenciaForm.responsable} onChange={event => setIncidenciaForm({ ...incidenciaForm, responsable: event.target.value })} /></div>
                <div className="form-group"><label>Titulo</label><input required value={incidenciaForm.titulo} onChange={event => setIncidenciaForm({ ...incidenciaForm, titulo: event.target.value })} /></div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}><label>Descripcion</label><textarea rows={3} value={incidenciaForm.descripcion} onChange={event => setIncidenciaForm({ ...incidenciaForm, descripcion: event.target.value })} style={{ width: '100%', padding: '0.5rem', border: '1px solid #e5e7eb', borderRadius: '0.375rem' }} /></div>
              </div>
              <button className="btn btn-primary" type="submit"><Plus size={18} /> Registrar incidencia</button>
            </form>
          </div>

          <div className="table-container">
            <table>
              <thead><tr><th>Fecha</th><th>Tipo</th><th>Titulo</th><th>Cliente</th><th>Prioridad</th><th>Estado</th><th>Acciones</th></tr></thead>
              <tbody>
                {incidencias.map(incidencia => (
                  <tr key={incidencia.id}>
                    <td>{incidencia.fecha_reporte}</td>
                    <td>{incidencia.tipo}</td>
                    <td><strong>{incidencia.titulo}</strong><br /><span style={{ color: '#6b7280' }}>{incidencia.descripcion}</span></td>
                    <td>{incidencia.cliente_nombre || '-'}</td>
                    <td>{incidencia.prioridad}</td>
                    <td><span className={`status-badge ${incidencia.estado === 'cerrada' ? 'entregado' : 'pendiente'}`}>{incidencia.estado}</span></td>
                    <td style={{ display: 'flex', gap: '0.5rem' }}>
                      {incidencia.estado !== 'cerrada' && <button className="btn btn-outline" onClick={() => update(`/api/gestion/incidencias/${incidencia.id}`, { estado: 'cerrada', fecha_cierre: today, resolucion: 'Cerrado desde mesa de control' })}><BadgeCheck size={16} /> Cerrar</button>}
                      <button className="btn btn-outline" onClick={() => remove(`/api/gestion/incidencias/${incidencia.id}`)}><Trash2 size={16} /> Eliminar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {activeTab === 'inventario' && (
        <>
          <div className="stat-card" style={{ marginTop: '1.5rem' }}>
            <h2 style={{ marginBottom: '1rem' }}><Boxes size={18} /> Registrar item de deposito</h2>
            <form onSubmit={submitInventario}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                <div className="form-group"><label>Sucursal</label>{sucursalSelect(inventarioForm.sucursal_id, value => setInventarioForm({ ...inventarioForm, sucursal_id: value }))}</div>
                <div className="form-group"><label>Codigo</label><input value={inventarioForm.codigo} onChange={event => setInventarioForm({ ...inventarioForm, codigo: event.target.value })} /></div>
                <div className="form-group"><label>Descripcion</label><input required value={inventarioForm.descripcion} onChange={event => setInventarioForm({ ...inventarioForm, descripcion: event.target.value })} /></div>
                <div className="form-group"><label>Categoria</label><select value={inventarioForm.categoria} onChange={event => setInventarioForm({ ...inventarioForm, categoria: event.target.value })}><option>Embalaje</option><option>Seguridad</option><option>Identificacion</option><option>Herramientas</option><option>Repuestos</option></select></div>
                <div className="form-group"><label>Cantidad</label><input type="number" value={inventarioForm.cantidad} onChange={event => setInventarioForm({ ...inventarioForm, cantidad: event.target.value })} /></div>
                <div className="form-group"><label>Unidad</label><input value={inventarioForm.unidad} onChange={event => setInventarioForm({ ...inventarioForm, unidad: event.target.value })} /></div>
                <div className="form-group"><label>Ubicacion</label><input value={inventarioForm.ubicacion} onChange={event => setInventarioForm({ ...inventarioForm, ubicacion: event.target.value })} /></div>
                <div className="form-group"><label>Estado</label><select value={inventarioForm.estado} onChange={event => setInventarioForm({ ...inventarioForm, estado: event.target.value })}><option>disponible</option><option>bajo_stock</option><option>retenido</option><option>agotado</option></select></div>
              </div>
              <button className="btn btn-primary" type="submit"><Plus size={18} /> Guardar item</button>
            </form>
          </div>

          <div className="table-container">
            <table>
              <thead><tr><th>Codigo</th><th>Descripcion</th><th>Sucursal</th><th>Categoria</th><th>Cantidad</th><th>Ubicacion</th><th>Estado</th><th>Acciones</th></tr></thead>
              <tbody>
                {inventario.map(item => (
                  <tr key={item.id}>
                    <td>{item.codigo || '-'}</td>
                    <td><strong>{item.descripcion}</strong><br /><span style={{ color: '#6b7280' }}>{item.observaciones}</span></td>
                    <td>{item.sucursal_nombre || '-'}</td>
                    <td>{item.categoria}</td>
                    <td>{compactNumber(item.cantidad)} {item.unidad}</td>
                    <td>{item.ubicacion || '-'}</td>
                    <td><span className={`status-badge ${item.estado === 'disponible' ? 'entregado' : 'pendiente'}`}>{item.estado}</span></td>
                    <td><button className="btn btn-outline" onClick={() => remove(`/api/gestion/inventario/${item.id}`)}><Trash2 size={16} /> Eliminar</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {activeTab === 'tarifarios' && (
        <>
          <div className="stat-card" style={{ marginTop: '1.5rem' }}>
            <h2 style={{ marginBottom: '1rem' }}><PackageCheck size={18} /> Nuevo tarifario</h2>
            <form onSubmit={submitTarifario}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                <div className="form-group"><label>Nombre</label><input required value={tarifarioForm.nombre} onChange={event => setTarifarioForm({ ...tarifarioForm, nombre: event.target.value })} /></div>
                <div className="form-group"><label>Origen</label>{sucursalSelect(tarifarioForm.origen_sucursal_id, value => setTarifarioForm({ ...tarifarioForm, origen_sucursal_id: value }), 'Cualquier origen')}</div>
                <div className="form-group"><label>Destino</label>{sucursalSelect(tarifarioForm.destino_sucursal_id, value => setTarifarioForm({ ...tarifarioForm, destino_sucursal_id: value }), 'Cualquier destino')}</div>
                <div className="form-group"><label>Tipo carga</label><input value={tarifarioForm.tipo_carga} onChange={event => setTarifarioForm({ ...tarifarioForm, tipo_carga: event.target.value })} /></div>
                <div className="form-group"><label>Modalidad</label><select value={tarifarioForm.modalidad} onChange={event => setTarifarioForm({ ...tarifarioForm, modalidad: event.target.value })}><option>puerta-puerta</option><option>puerta-sucursal</option><option>sucursal-puerta</option><option>sucursal-sucursal</option></select></div>
                <div className="form-group"><label>Base</label><input type="number" value={tarifarioForm.precio_base} onChange={event => setTarifarioForm({ ...tarifarioForm, precio_base: event.target.value })} /></div>
                <div className="form-group"><label>Precio kg</label><input type="number" value={tarifarioForm.precio_kg} onChange={event => setTarifarioForm({ ...tarifarioForm, precio_kg: event.target.value })} /></div>
                <div className="form-group"><label>Precio m3</label><input type="number" value={tarifarioForm.precio_m3} onChange={event => setTarifarioForm({ ...tarifarioForm, precio_m3: event.target.value })} /></div>
                <div className="form-group"><label>Seguro %</label><input type="number" value={tarifarioForm.seguro_porcentaje} onChange={event => setTarifarioForm({ ...tarifarioForm, seguro_porcentaje: event.target.value })} /></div>
              </div>
              <button className="btn btn-primary" type="submit"><Plus size={18} /> Guardar tarifario</button>
            </form>
          </div>

          <div className="table-container">
            <table>
              <thead><tr><th>Nombre</th><th>Ruta</th><th>Carga</th><th>Modalidad</th><th>Base</th><th>Kg/M3</th><th>Seguro</th><th>Estado</th><th>Acciones</th></tr></thead>
              <tbody>
                {tarifarios.map(tarifa => (
                  <tr key={tarifa.id}>
                    <td><strong>{tarifa.nombre}</strong><br /><span style={{ color: '#6b7280' }}>{tarifa.vigencia_desde} a {tarifa.vigencia_hasta}</span></td>
                    <td>{tarifa.origen_nombre || 'Origen libre'} / {tarifa.destino_nombre || 'Destino libre'}</td>
                    <td>{tarifa.tipo_carga}</td>
                    <td>{tarifa.modalidad}</td>
                    <td>{money(tarifa.precio_base)}</td>
                    <td>{money(tarifa.precio_kg)} / {money(tarifa.precio_m3)}</td>
                    <td>{tarifa.seguro_porcentaje}%</td>
                    <td><span className={`status-badge ${tarifa.estado === 'activo' ? 'entregado' : 'pendiente'}`}>{tarifa.estado}</span></td>
                    <td><button className="btn btn-outline" onClick={() => remove(`/api/gestion/tarifarios/${tarifa.id}`)}><Trash2 size={16} /> Inactivar</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {activeTab === 'contratos' && (
        <>
          <div className="stat-card" style={{ marginTop: '1.5rem' }}>
            <h2 style={{ marginBottom: '1rem' }}><FileSignature size={18} /> Nuevo contrato comercial</h2>
            <form onSubmit={submitContrato}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                <div className="form-group"><label>Cliente</label><select required value={contratoForm.cliente_id} onChange={event => setContratoForm({ ...contratoForm, cliente_id: event.target.value })}><option value="">Seleccionar</option>{clientes.map(cliente => <option key={cliente.id} value={cliente.id}>{cliente.nombre}</option>)}</select></div>
                <div className="form-group"><label>Nombre contrato</label><input required value={contratoForm.nombre} onChange={event => setContratoForm({ ...contratoForm, nombre: event.target.value })} /></div>
                <div className="form-group"><label>Tarifario</label><select value={contratoForm.tarifario_id} onChange={event => setContratoForm({ ...contratoForm, tarifario_id: event.target.value })}><option value="">Sin tarifario</option>{tarifariosActivos.map(tarifa => <option key={tarifa.id} value={tarifa.id}>{tarifa.nombre}</option>)}</select></div>
                <div className="form-group"><label>Inicio</label><input type="date" value={contratoForm.fecha_inicio} onChange={event => setContratoForm({ ...contratoForm, fecha_inicio: event.target.value })} /></div>
                <div className="form-group"><label>Fin</label><input type="date" value={contratoForm.fecha_fin} onChange={event => setContratoForm({ ...contratoForm, fecha_fin: event.target.value })} /></div>
                <div className="form-group"><label>Condicion pago</label><input value={contratoForm.condicion_pago} onChange={event => setContratoForm({ ...contratoForm, condicion_pago: event.target.value })} /></div>
                <div className="form-group"><label>Limite credito</label><input type="number" value={contratoForm.limite_credito} onChange={event => setContratoForm({ ...contratoForm, limite_credito: event.target.value })} /></div>
                <div className="form-group"><label>Observaciones</label><input value={contratoForm.observaciones} onChange={event => setContratoForm({ ...contratoForm, observaciones: event.target.value })} /></div>
              </div>
              <button className="btn btn-primary" type="submit"><Plus size={18} /> Guardar contrato</button>
            </form>
          </div>

          <div className="table-container">
            <table>
              <thead><tr><th>Contrato</th><th>Cliente</th><th>Vigencia</th><th>Condicion</th><th>Limite credito</th><th>Tarifario</th><th>Estado</th><th>Acciones</th></tr></thead>
              <tbody>
                {contratos.map(contrato => (
                  <tr key={contrato.id}>
                    <td><strong>{contrato.nombre}</strong><br /><span style={{ color: '#6b7280' }}>{contrato.observaciones}</span></td>
                    <td>{contrato.cliente_nombre}</td>
                    <td>{contrato.fecha_inicio} a {contrato.fecha_fin}</td>
                    <td>{contrato.condicion_pago}</td>
                    <td>{money(contrato.limite_credito)}</td>
                    <td>{contrato.tarifario_nombre || '-'}</td>
                    <td><span className={`status-badge ${contrato.estado === 'activo' ? 'entregado' : 'pendiente'}`}>{contrato.estado}</span></td>
                    <td><button className="btn btn-outline" onClick={() => remove(`/api/gestion/contratos/${contrato.id}`)}><Trash2 size={16} /> Inactivar</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
