import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  BadgeCheck,
  BriefcaseBusiness,
  CalendarCheck,
  GraduationCap,
  Plus,
  ReceiptText,
  Trash2,
  UserCheck,
  UserX
} from 'lucide-react';

type Tab = 'empleados' | 'asistencia' | 'licencias' | 'nomina' | 'capacitaciones';

type Empleado = {
  id: number;
  nombre: string;
  documento: string;
  telefono: string;
  email: string;
  cargo: string;
  area: string;
  sucursal_id?: number;
  sucursal_nombre?: string;
  fecha_ingreso: string;
  salario_base: number;
  estado: string;
  vencimiento_contrato: string;
  contacto_emergencia: string;
  observaciones: string;
};

type Sucursal = {
  id: number;
  nombre: string;
};

type ResumenRRHH = {
  empleadosActivos: number;
  empleadosInactivos: number;
  presentesHoy: number;
  permisosHoy: number;
  licenciasPendientes: number;
  nominaPendiente: number;
  totalNominaPendiente: number;
  masaSalarial: number;
  contratosPorVencer: Array<{ id: number; nombre: string; cargo: string; vencimiento_contrato: string }>;
  capacitacionesPorVencer: Array<{ id: number; tema: string; vencimiento: string; empleado_nombre: string }>;
};

type Asistencia = {
  id: number;
  empleado_id: number;
  empleado_nombre: string;
  area: string;
  fecha: string;
  entrada: string;
  salida: string;
  tipo: string;
  estado: string;
  observaciones: string;
};

type Licencia = {
  id: number;
  empleado_id: number;
  empleado_nombre: string;
  area: string;
  tipo: string;
  fecha_inicio: string;
  fecha_fin: string;
  estado: string;
  motivo: string;
};

type Nomina = {
  id: number;
  empleado_id: number;
  empleado_nombre: string;
  cargo: string;
  area: string;
  periodo: string;
  salario_base: number;
  horas_extra: number;
  bonificaciones: number;
  descuentos: number;
  total_neto: number;
  estado: string;
  fecha_pago: string;
};

type Capacitacion = {
  id: number;
  empleado_id?: number;
  empleado_nombre: string;
  area: string;
  tema: string;
  fecha: string;
  vencimiento: string;
  resultado: string;
  certificado_url: string;
  observaciones: string;
};

const today = new Date().toISOString().slice(0, 10);
const currentPeriod = today.slice(0, 7);

const emptyEmpleado = {
  nombre: '',
  documento: '',
  telefono: '',
  email: '',
  cargo: '',
  area: 'Operaciones',
  sucursal_id: '',
  fecha_ingreso: today,
  salario_base: '',
  estado: 'activo',
  vencimiento_contrato: '',
  contacto_emergencia: '',
  observaciones: ''
};

const emptyAsistencia = {
  empleado_id: '',
  fecha: today,
  entrada: '08:00',
  salida: '',
  tipo: 'normal',
  estado: 'presente',
  observaciones: ''
};

const emptyLicencia = {
  empleado_id: '',
  tipo: 'Vacaciones',
  fecha_inicio: today,
  fecha_fin: today,
  estado: 'pendiente',
  motivo: ''
};

const emptyNomina = {
  empleado_id: '',
  periodo: currentPeriod,
  salario_base: '',
  horas_extra: '0',
  bonificaciones: '0',
  descuentos: '0',
  estado: 'pendiente',
  fecha_pago: ''
};

const emptyCapacitacion = {
  empleado_id: '',
  tema: '',
  fecha: today,
  vencimiento: '',
  resultado: 'programada',
  certificado_url: '',
  observaciones: ''
};

const defaultResumen: ResumenRRHH = {
  empleadosActivos: 0,
  empleadosInactivos: 0,
  presentesHoy: 0,
  permisosHoy: 0,
  licenciasPendientes: 0,
  nominaPendiente: 0,
  totalNominaPendiente: 0,
  masaSalarial: 0,
  contratosPorVencer: [],
  capacitacionesPorVencer: []
};

function money(value: number | string | null | undefined) {
  return `Gs. ${Number(value || 0).toLocaleString('es-PY')}`;
}

async function api(path: string, options?: RequestInit) {
  const token = localStorage.getItem('adminToken');
  const response = await fetch(path, {
    ...(options || {}),
    headers: {
      ...(options?.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'No se pudo completar la operacion');
  }
  return data;
}

export default function RRHH() {
  const [activeTab, setActiveTab] = useState<Tab>('empleados');
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [resumen, setResumen] = useState<ResumenRRHH>(defaultResumen);
  const [asistencias, setAsistencias] = useState<Asistencia[]>([]);
  const [licencias, setLicencias] = useState<Licencia[]>([]);
  const [nomina, setNomina] = useState<Nomina[]>([]);
  const [capacitaciones, setCapacitaciones] = useState<Capacitacion[]>([]);
  const [empleadoForm, setEmpleadoForm] = useState(emptyEmpleado);
  const [asistenciaForm, setAsistenciaForm] = useState(emptyAsistencia);
  const [licenciaForm, setLicenciaForm] = useState(emptyLicencia);
  const [nominaForm, setNominaForm] = useState(emptyNomina);
  const [capacitacionForm, setCapacitacionForm] = useState(emptyCapacitacion);
  const [feedback, setFeedback] = useState('');

  const empleadosActivos = useMemo(() => empleados.filter(empleado => empleado.estado === 'activo'), [empleados]);

  const loadData = () => {
    Promise.all([
      api('/api/rrhh/resumen'),
      api('/api/rrhh/empleados'),
      api('/api/sucursales'),
      api('/api/rrhh/asistencias'),
      api('/api/rrhh/licencias'),
      api('/api/rrhh/nomina'),
      api('/api/rrhh/capacitaciones')
    ])
      .then(([resumenData, empleadosData, sucursalesData, asistenciasData, licenciasData, nominaData, capacitacionesData]) => {
        setResumen(resumenData);
        setEmpleados(Array.isArray(empleadosData) ? empleadosData : []);
        setSucursales(Array.isArray(sucursalesData) ? sucursalesData : []);
        setAsistencias(Array.isArray(asistenciasData) ? asistenciasData : []);
        setLicencias(Array.isArray(licenciasData) ? licenciasData : []);
        setNomina(Array.isArray(nominaData) ? nominaData : []);
        setCapacitaciones(Array.isArray(capacitacionesData) ? capacitacionesData : []);
      })
      .catch(error => setFeedback(error.message));
  };

  useEffect(() => {
    loadData();
  }, []);

  const submitEmpleado = async (event: FormEvent) => {
    event.preventDefault();
    await api('/api/rrhh/empleados', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...empleadoForm,
        sucursal_id: empleadoForm.sucursal_id || null,
        salario_base: Number(empleadoForm.salario_base || 0)
      })
    });
    setEmpleadoForm(emptyEmpleado);
    setFeedback('Empleado guardado');
    loadData();
  };

  const submitAsistencia = async (event: FormEvent) => {
    event.preventDefault();
    await api('/api/rrhh/asistencias', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(asistenciaForm)
    });
    setAsistenciaForm(emptyAsistencia);
    setFeedback('Asistencia registrada');
    loadData();
  };

  const submitLicencia = async (event: FormEvent) => {
    event.preventDefault();
    await api('/api/rrhh/licencias', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(licenciaForm)
    });
    setLicenciaForm(emptyLicencia);
    setFeedback('Licencia registrada');
    loadData();
  };

  const submitNomina = async (event: FormEvent) => {
    event.preventDefault();
    const salario = Number(nominaForm.salario_base || 0);
    const horasExtra = Number(nominaForm.horas_extra || 0);
    const bonificaciones = Number(nominaForm.bonificaciones || 0);
    const descuentos = Number(nominaForm.descuentos || 0);
    await api('/api/rrhh/nomina', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...nominaForm,
        salario_base: salario,
        horas_extra: horasExtra,
        bonificaciones,
        descuentos,
        total_neto: salario + horasExtra + bonificaciones - descuentos
      })
    });
    setNominaForm(emptyNomina);
    setFeedback('Liquidacion generada');
    loadData();
  };

  const submitCapacitacion = async (event: FormEvent) => {
    event.preventDefault();
    await api('/api/rrhh/capacitaciones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...capacitacionForm,
        empleado_id: capacitacionForm.empleado_id || null
      })
    });
    setCapacitacionForm(emptyCapacitacion);
    setFeedback('Capacitacion registrada');
    loadData();
  };

  const updateRecord = async (path: string, payload: Record<string, string | number | null>) => {
    await api(path, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    setFeedback('Registro actualizado');
    loadData();
  };

  const deleteRecord = async (path: string) => {
    await api(path, { method: 'DELETE' });
    setFeedback('Registro eliminado');
    loadData();
  };

  const selectEmpleado = (
    value: string,
    onChange: (nextValue: string) => void,
    required = true
  ) => (
    <select required={required} value={value} onChange={event => onChange(event.target.value)}>
      <option value="">Seleccionar empleado</option>
      {empleadosActivos.map(empleado => (
        <option key={empleado.id} value={empleado.id}>
          {empleado.nombre} - {empleado.area}
        </option>
      ))}
    </select>
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Recursos Humanos</h1>
          <p style={{ color: '#6b7280', marginTop: '0.25rem' }}>
            Personal, asistencia, licencias, nomina y capacitaciones operativas.
          </p>
        </div>
        {feedback && (
          <span className="status-badge entregado" style={{ alignSelf: 'center' }}>
            {feedback}
          </span>
        )}
      </div>

      <div className="dashboard-grid">
        <div className="stat-card">
          <div className="stat-title"><BriefcaseBusiness size={16} /> Dotacion activa</div>
          <div className="stat-value">{resumen.empleadosActivos}</div>
          <p style={{ color: '#6b7280' }}>{resumen.empleadosInactivos} inactivos historicos</p>
        </div>
        <div className="stat-card">
          <div className="stat-title"><CalendarCheck size={16} /> Presentes hoy</div>
          <div className="stat-value">{resumen.presentesHoy}</div>
          <p style={{ color: '#6b7280' }}>{resumen.permisosHoy} permisos o ausencias</p>
        </div>
        <div className="stat-card">
          <div className="stat-title"><ReceiptText size={16} /> Nomina pendiente</div>
          <div className="stat-value">{resumen.nominaPendiente}</div>
          <p style={{ color: '#6b7280' }}>{money(resumen.totalNominaPendiente)}</p>
        </div>
        <div className="stat-card">
          <div className="stat-title"><BadgeCheck size={16} /> Masa salarial</div>
          <div className="stat-value" style={{ fontSize: '1.45rem' }}>{money(resumen.masaSalarial)}</div>
          <p style={{ color: '#6b7280' }}>{resumen.licenciasPendientes} licencias pendientes</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="stat-card">
          <h3 style={{ marginBottom: '0.75rem' }}>Contratos por vencer</h3>
          {resumen.contratosPorVencer.length === 0 ? (
            <p style={{ color: '#6b7280' }}>Sin vencimientos en 45 dias.</p>
          ) : resumen.contratosPorVencer.map(alerta => (
            <p key={alerta.id} style={{ marginBottom: '0.5rem' }}>
              <strong>{alerta.nombre}</strong> - {alerta.cargo}: {alerta.vencimiento_contrato}
            </p>
          ))}
        </div>
        <div className="stat-card">
          <h3 style={{ marginBottom: '0.75rem' }}>Capacitaciones a renovar</h3>
          {resumen.capacitacionesPorVencer.length === 0 ? (
            <p style={{ color: '#6b7280' }}>Sin vencimientos en 60 dias.</p>
          ) : resumen.capacitacionesPorVencer.map(alerta => (
            <p key={alerta.id} style={{ marginBottom: '0.5rem' }}>
              <strong>{alerta.tema}</strong> - {alerta.empleado_nombre || 'Equipo'}: {alerta.vencimiento}
            </p>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', borderBottom: '1px solid #e5e7eb', paddingBottom: '1rem' }}>
        <button className={`btn ${activeTab === 'empleados' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('empleados')}>Empleados</button>
        <button className={`btn ${activeTab === 'asistencia' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('asistencia')}>Asistencia</button>
        <button className={`btn ${activeTab === 'licencias' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('licencias')}>Licencias</button>
        <button className={`btn ${activeTab === 'nomina' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('nomina')}>Nomina</button>
        <button className={`btn ${activeTab === 'capacitaciones' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('capacitaciones')}>Capacitacion</button>
      </div>

      {activeTab === 'empleados' && (
        <>
          <div className="stat-card" style={{ marginTop: '1.5rem' }}>
            <h2 style={{ marginBottom: '1rem' }}><Plus size={18} /> Nuevo empleado</h2>
            <form onSubmit={submitEmpleado}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                <div className="form-group">
                  <label>Nombre completo</label>
                  <input required value={empleadoForm.nombre} onChange={event => setEmpleadoForm({ ...empleadoForm, nombre: event.target.value })} />
                </div>
                <div className="form-group">
                  <label>Documento</label>
                  <input required value={empleadoForm.documento} onChange={event => setEmpleadoForm({ ...empleadoForm, documento: event.target.value })} />
                </div>
                <div className="form-group">
                  <label>Cargo</label>
                  <input required value={empleadoForm.cargo} onChange={event => setEmpleadoForm({ ...empleadoForm, cargo: event.target.value })} />
                </div>
                <div className="form-group">
                  <label>Area</label>
                  <select value={empleadoForm.area} onChange={event => setEmpleadoForm({ ...empleadoForm, area: event.target.value })}>
                    <option>Operaciones</option>
                    <option>Administracion</option>
                    <option>Deposito</option>
                    <option>Comercial</option>
                    <option>RRHH</option>
                    <option>Mantenimiento</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Sucursal</label>
                  <select value={empleadoForm.sucursal_id} onChange={event => setEmpleadoForm({ ...empleadoForm, sucursal_id: event.target.value })}>
                    <option value="">Sin asignar</option>
                    {sucursales.map(sucursal => <option key={sucursal.id} value={sucursal.id}>{sucursal.nombre}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Telefono</label>
                  <input value={empleadoForm.telefono} onChange={event => setEmpleadoForm({ ...empleadoForm, telefono: event.target.value })} />
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input type="email" value={empleadoForm.email} onChange={event => setEmpleadoForm({ ...empleadoForm, email: event.target.value })} />
                </div>
                <div className="form-group">
                  <label>Ingreso</label>
                  <input type="date" value={empleadoForm.fecha_ingreso} onChange={event => setEmpleadoForm({ ...empleadoForm, fecha_ingreso: event.target.value })} />
                </div>
                <div className="form-group">
                  <label>Contrato vence</label>
                  <input type="date" value={empleadoForm.vencimiento_contrato} onChange={event => setEmpleadoForm({ ...empleadoForm, vencimiento_contrato: event.target.value })} />
                </div>
                <div className="form-group">
                  <label>Salario base</label>
                  <input type="number" value={empleadoForm.salario_base} onChange={event => setEmpleadoForm({ ...empleadoForm, salario_base: event.target.value })} />
                </div>
                <div className="form-group">
                  <label>Contacto emergencia</label>
                  <input value={empleadoForm.contacto_emergencia} onChange={event => setEmpleadoForm({ ...empleadoForm, contacto_emergencia: event.target.value })} />
                </div>
                <div className="form-group">
                  <label>Observaciones</label>
                  <input value={empleadoForm.observaciones} onChange={event => setEmpleadoForm({ ...empleadoForm, observaciones: event.target.value })} />
                </div>
              </div>
              <button className="btn btn-primary" type="submit"><UserCheck size={18} /> Guardar empleado</button>
            </form>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Empleado</th>
                  <th>Documento</th>
                  <th>Cargo / Area</th>
                  <th>Sucursal</th>
                  <th>Contrato</th>
                  <th>Salario</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {empleados.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', color: '#6b7280', padding: '1rem' }}>
                      Sin empleados cargados para este tenant.
                    </td>
                  </tr>
                )}
                {empleados.map(empleado => (
                  <tr key={empleado.id}>
                    <td>
                      <strong>{empleado.nombre}</strong>
                      <br />
                      <span style={{ color: '#6b7280' }}>{empleado.telefono || empleado.email}</span>
                    </td>
                    <td>{empleado.documento}</td>
                    <td>{empleado.cargo}<br /><span style={{ color: '#6b7280' }}>{empleado.area}</span></td>
                    <td>{empleado.sucursal_nombre || '-'}</td>
                    <td>{empleado.vencimiento_contrato || '-'}</td>
                    <td>{money(empleado.salario_base)}</td>
                    <td><span className={`status-badge ${empleado.estado === 'activo' ? 'entregado' : 'pendiente'}`}>{empleado.estado}</span></td>
                    <td>
                      {empleado.estado === 'activo' ? (
                        <button className="btn btn-outline" onClick={() => deleteRecord(`/api/rrhh/empleados/${empleado.id}`)}><UserX size={16} /> Inactivar</button>
                      ) : (
                        <button className="btn btn-outline" onClick={() => updateRecord(`/api/rrhh/empleados/${empleado.id}`, { estado: 'activo' })}><UserCheck size={16} /> Reactivar</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {activeTab === 'asistencia' && (
        <>
          <div className="stat-card" style={{ marginTop: '1.5rem' }}>
            <h2 style={{ marginBottom: '1rem' }}>Registrar asistencia</h2>
            <form onSubmit={submitAsistencia}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                <div className="form-group">
                  <label>Empleado</label>
                  {selectEmpleado(asistenciaForm.empleado_id, value => setAsistenciaForm({ ...asistenciaForm, empleado_id: value }))}
                </div>
                <div className="form-group">
                  <label>Fecha</label>
                  <input type="date" value={asistenciaForm.fecha} onChange={event => setAsistenciaForm({ ...asistenciaForm, fecha: event.target.value })} />
                </div>
                <div className="form-group">
                  <label>Entrada</label>
                  <input type="time" value={asistenciaForm.entrada} onChange={event => setAsistenciaForm({ ...asistenciaForm, entrada: event.target.value })} />
                </div>
                <div className="form-group">
                  <label>Salida</label>
                  <input type="time" value={asistenciaForm.salida} onChange={event => setAsistenciaForm({ ...asistenciaForm, salida: event.target.value })} />
                </div>
                <div className="form-group">
                  <label>Tipo</label>
                  <select value={asistenciaForm.tipo} onChange={event => setAsistenciaForm({ ...asistenciaForm, tipo: event.target.value })}>
                    <option>normal</option>
                    <option>extra</option>
                    <option>nocturno</option>
                    <option>feriado</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Estado</label>
                  <select value={asistenciaForm.estado} onChange={event => setAsistenciaForm({ ...asistenciaForm, estado: event.target.value })}>
                    <option>presente</option>
                    <option>ausente</option>
                    <option>permiso</option>
                    <option>tarde</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Observaciones</label>
                  <input value={asistenciaForm.observaciones} onChange={event => setAsistenciaForm({ ...asistenciaForm, observaciones: event.target.value })} />
                </div>
              </div>
              <button className="btn btn-primary" type="submit"><CalendarCheck size={18} /> Registrar</button>
            </form>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Empleado</th>
                  <th>Area</th>
                  <th>Entrada</th>
                  <th>Salida</th>
                  <th>Tipo</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {asistencias.map(asistencia => (
                  <tr key={asistencia.id}>
                    <td>{asistencia.fecha}</td>
                    <td>{asistencia.empleado_nombre}</td>
                    <td>{asistencia.area}</td>
                    <td>{asistencia.entrada || '-'}</td>
                    <td>{asistencia.salida || '-'}</td>
                    <td>{asistencia.tipo}</td>
                    <td><span className="status-badge asignado">{asistencia.estado}</span></td>
                    <td><button className="btn btn-outline" onClick={() => deleteRecord(`/api/rrhh/asistencias/${asistencia.id}`)}><Trash2 size={16} /> Eliminar</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {activeTab === 'licencias' && (
        <>
          <div className="stat-card" style={{ marginTop: '1.5rem' }}>
            <h2 style={{ marginBottom: '1rem' }}>Nueva licencia o permiso</h2>
            <form onSubmit={submitLicencia}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                <div className="form-group">
                  <label>Empleado</label>
                  {selectEmpleado(licenciaForm.empleado_id, value => setLicenciaForm({ ...licenciaForm, empleado_id: value }))}
                </div>
                <div className="form-group">
                  <label>Tipo</label>
                  <select value={licenciaForm.tipo} onChange={event => setLicenciaForm({ ...licenciaForm, tipo: event.target.value })}>
                    <option>Vacaciones</option>
                    <option>Medica</option>
                    <option>Permiso personal</option>
                    <option>Suspension</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Desde</label>
                  <input type="date" value={licenciaForm.fecha_inicio} onChange={event => setLicenciaForm({ ...licenciaForm, fecha_inicio: event.target.value })} />
                </div>
                <div className="form-group">
                  <label>Hasta</label>
                  <input type="date" value={licenciaForm.fecha_fin} onChange={event => setLicenciaForm({ ...licenciaForm, fecha_fin: event.target.value })} />
                </div>
                <div className="form-group">
                  <label>Motivo</label>
                  <input value={licenciaForm.motivo} onChange={event => setLicenciaForm({ ...licenciaForm, motivo: event.target.value })} />
                </div>
              </div>
              <button className="btn btn-primary" type="submit"><Plus size={18} /> Guardar solicitud</button>
            </form>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Empleado</th>
                  <th>Tipo</th>
                  <th>Periodo</th>
                  <th>Motivo</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {licencias.map(licencia => (
                  <tr key={licencia.id}>
                    <td>{licencia.empleado_nombre}</td>
                    <td>{licencia.tipo}</td>
                    <td>{licencia.fecha_inicio} al {licencia.fecha_fin}</td>
                    <td>{licencia.motivo || '-'}</td>
                    <td><span className="status-badge pendiente">{licencia.estado}</span></td>
                    <td style={{ display: 'flex', gap: '0.5rem' }}>
                      {licencia.estado === 'pendiente' && (
                        <button className="btn btn-outline" onClick={() => updateRecord(`/api/rrhh/licencias/${licencia.id}`, { estado: 'aprobada' })}><BadgeCheck size={16} /> Aprobar</button>
                      )}
                      <button className="btn btn-outline" onClick={() => deleteRecord(`/api/rrhh/licencias/${licencia.id}`)}><Trash2 size={16} /> Eliminar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {activeTab === 'nomina' && (
        <>
          <div className="stat-card" style={{ marginTop: '1.5rem' }}>
            <h2 style={{ marginBottom: '1rem' }}>Generar liquidacion</h2>
            <form onSubmit={submitNomina}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }}>
                <div className="form-group">
                  <label>Empleado</label>
                  {selectEmpleado(nominaForm.empleado_id, value => {
                    const empleado = empleados.find(item => String(item.id) === value);
                    setNominaForm({ ...nominaForm, empleado_id: value, salario_base: String(empleado?.salario_base || '') });
                  })}
                </div>
                <div className="form-group">
                  <label>Periodo</label>
                  <input type="month" value={nominaForm.periodo} onChange={event => setNominaForm({ ...nominaForm, periodo: event.target.value })} />
                </div>
                <div className="form-group">
                  <label>Salario base</label>
                  <input type="number" value={nominaForm.salario_base} onChange={event => setNominaForm({ ...nominaForm, salario_base: event.target.value })} />
                </div>
                <div className="form-group">
                  <label>Horas extra</label>
                  <input type="number" value={nominaForm.horas_extra} onChange={event => setNominaForm({ ...nominaForm, horas_extra: event.target.value })} />
                </div>
                <div className="form-group">
                  <label>Bonificaciones</label>
                  <input type="number" value={nominaForm.bonificaciones} onChange={event => setNominaForm({ ...nominaForm, bonificaciones: event.target.value })} />
                </div>
                <div className="form-group">
                  <label>Descuentos</label>
                  <input type="number" value={nominaForm.descuentos} onChange={event => setNominaForm({ ...nominaForm, descuentos: event.target.value })} />
                </div>
              </div>
              <button className="btn btn-primary" type="submit"><ReceiptText size={18} /> Generar</button>
            </form>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Periodo</th>
                  <th>Empleado</th>
                  <th>Cargo</th>
                  <th>Base</th>
                  <th>Extras</th>
                  <th>Bonif.</th>
                  <th>Desc.</th>
                  <th>Neto</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {nomina.map(item => (
                  <tr key={item.id}>
                    <td>{item.periodo}</td>
                    <td>{item.empleado_nombre}</td>
                    <td>{item.cargo}</td>
                    <td>{money(item.salario_base)}</td>
                    <td>{money(item.horas_extra)}</td>
                    <td>{money(item.bonificaciones)}</td>
                    <td>{money(item.descuentos)}</td>
                    <td><strong>{money(item.total_neto)}</strong></td>
                    <td><span className={`status-badge ${item.estado === 'pagada' ? 'entregado' : 'pendiente'}`}>{item.estado}</span></td>
                    <td style={{ display: 'flex', gap: '0.5rem' }}>
                      {item.estado !== 'pagada' && (
                        <button className="btn btn-outline" onClick={() => updateRecord(`/api/rrhh/nomina/${item.id}`, { estado: 'pagada', fecha_pago: today })}><BadgeCheck size={16} /> Pagar</button>
                      )}
                      <button className="btn btn-outline" onClick={() => deleteRecord(`/api/rrhh/nomina/${item.id}`)}><Trash2 size={16} /> Eliminar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {activeTab === 'capacitaciones' && (
        <>
          <div className="stat-card" style={{ marginTop: '1.5rem' }}>
            <h2 style={{ marginBottom: '1rem' }}>Planificar capacitacion</h2>
            <form onSubmit={submitCapacitacion}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                <div className="form-group">
                  <label>Empleado</label>
                  {selectEmpleado(capacitacionForm.empleado_id, value => setCapacitacionForm({ ...capacitacionForm, empleado_id: value }), false)}
                </div>
                <div className="form-group">
                  <label>Tema</label>
                  <input required value={capacitacionForm.tema} onChange={event => setCapacitacionForm({ ...capacitacionForm, tema: event.target.value })} />
                </div>
                <div className="form-group">
                  <label>Fecha</label>
                  <input type="date" value={capacitacionForm.fecha} onChange={event => setCapacitacionForm({ ...capacitacionForm, fecha: event.target.value })} />
                </div>
                <div className="form-group">
                  <label>Vencimiento</label>
                  <input type="date" value={capacitacionForm.vencimiento} onChange={event => setCapacitacionForm({ ...capacitacionForm, vencimiento: event.target.value })} />
                </div>
                <div className="form-group">
                  <label>Resultado</label>
                  <select value={capacitacionForm.resultado} onChange={event => setCapacitacionForm({ ...capacitacionForm, resultado: event.target.value })}>
                    <option>programada</option>
                    <option>aprobada</option>
                    <option>reprobada</option>
                    <option>vencida</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Certificado URL</label>
                  <input value={capacitacionForm.certificado_url} onChange={event => setCapacitacionForm({ ...capacitacionForm, certificado_url: event.target.value })} />
                </div>
                <div className="form-group">
                  <label>Observaciones</label>
                  <input value={capacitacionForm.observaciones} onChange={event => setCapacitacionForm({ ...capacitacionForm, observaciones: event.target.value })} />
                </div>
              </div>
              <button className="btn btn-primary" type="submit"><GraduationCap size={18} /> Guardar capacitacion</button>
            </form>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Tema</th>
                  <th>Empleado</th>
                  <th>Fecha</th>
                  <th>Vencimiento</th>
                  <th>Resultado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {capacitaciones.map(item => (
                  <tr key={item.id}>
                    <td><strong>{item.tema}</strong><br /><span style={{ color: '#6b7280' }}>{item.observaciones}</span></td>
                    <td>{item.empleado_nombre || 'Equipo completo'}</td>
                    <td>{item.fecha || '-'}</td>
                    <td>{item.vencimiento || '-'}</td>
                    <td><span className="status-badge asignado">{item.resultado}</span></td>
                    <td style={{ display: 'flex', gap: '0.5rem' }}>
                      {item.resultado === 'programada' && (
                        <button className="btn btn-outline" onClick={() => updateRecord(`/api/rrhh/capacitaciones/${item.id}`, { resultado: 'aprobada' })}><BadgeCheck size={16} /> Completar</button>
                      )}
                      <button className="btn btn-outline" onClick={() => deleteRecord(`/api/rrhh/capacitaciones/${item.id}`)}><Trash2 size={16} /> Eliminar</button>
                    </td>
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
