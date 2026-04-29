import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Plus, X, Printer } from 'lucide-react';

export default function Viajes() {
  const [viajes, setViajes] = useState<any[]>([]);
  const [choferes, setChoferes] = useState<any[]>([]);
  const [vehiculos, setVehiculos] = useState<any[]>([]);
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [sucursales, setSucursales] = useState<any[]>([]);
  
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ 
    chofer_id: '', 
    vehiculo_id: '', 
    sucursal_origen_id: '',
    sucursal_destino_id: '',
    costo_estimado: 0,
    fecha_inicio: '', 
    pedido_ids: [] as string[],
    tipo_viaje: 'interurbano'
  });

  const printFrameRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    loadViajes();
    fetch('/api/choferes').then(res => res.json()).then(data => setChoferes(data.filter((c:any) => c.estado === 'activo')));
    fetch('/api/vehiculos').then(res => res.json()).then(data => setVehiculos(data.filter((v:any) => v.estado === 'disponible')));
    fetch('/api/pedidos').then(res => res.json()).then(data => setPedidos(data.filter((p:any) => ['pendiente_planificacion', 'registrado', 'borrador'].includes(p.estado))));
    fetch('/api/sucursales').then(res => res.json()).then(setSucursales);
  }, []);

  const loadViajes = () => {
    fetch('/api/viajes')
      .then(res => res.json())
      .then(data => setViajes(data))
      .catch(console.error);
  };

  const handleOpenModal = () => {
    setFormData({ 
      chofer_id: '', 
      vehiculo_id: '', 
      sucursal_origen_id: '',
      sucursal_destino_id: '',
      costo_estimado: 0,
      fecha_inicio: '', 
      pedido_ids: [],
      tipo_viaje: 'interurbano'
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (formData.pedido_ids.length === 0) {
      alert('Debe seleccionar al menos un pedido para el viaje.');
      return;
    }
    try {
      const res = await fetch('/api/viajes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (!res.ok) {
        const errorData = await res.json();
        alert('Error: ' + errorData.error);
      } else {
        setShowModal(false);
        loadViajes();
        fetch('/api/vehiculos').then(res => res.json()).then(data => setVehiculos(data.filter((v:any) => v.estado === 'disponible')));
        fetch('/api/pedidos').then(res => res.json()).then(data => setPedidos(data.filter((p:any) => ['pendiente_planificacion', 'registrado', 'borrador'].includes(p.estado))));
      }
    } catch (e: any) {
      alert('Error de conexión al guardar el viaje');
    }
  };

  const handlePedidoSelect = (id: string) => {
    if (formData.pedido_ids.includes(id)) {
      setFormData({...formData, pedido_ids: formData.pedido_ids.filter(pid => pid !== id)});
    } else {
      setFormData({...formData, pedido_ids: [...formData.pedido_ids, id]});
    }
  };

  const handlePrintManifest = (viaje: any) => {
    if (!printFrameRef.current) return;
    const doc = printFrameRef.current.contentWindow?.document;
    if (!doc) return;

    const html = `
      <html>
        <head>
          <title>Manifiesto de Carga - Viaje ${viaje.id}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
            .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
            .info { display: flex; justify-content: space-between; margin-bottom: 15px; border: 1px solid #ccc; padding: 10px; }
            h1 { margin: 0; font-size: 24px; }
            p { margin: 5px 0; font-size: 14px; }
            .details { border-collapse: collapse; width: 100%; margin-top: 20px; }
            .details th, .details td { border: 1px solid #ccc; padding: 8px; text-align: left; }
            .details th { background-color: #f9f9f9; }
            .footer { margin-top: 30px; text-align: center; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>MANIFIESTO DE CARGA</h1>
            <p><strong>Viaje Nro:</strong> ${viaje.id}</p>
            <p><strong>Fecha Impresión:</strong> ${new Date().toLocaleDateString()}</p>
          </div>
          
          <div class="info">
            <div>
              <p><strong>Chofer:</strong> ${viaje.chofer_nombre || 'N/A'}</p>
              <p><strong>Vehículo:</strong> ${viaje.vehiculo_chapa || 'N/A'}</p>
              <p><strong>Costo Estimado:</strong> $${viaje.costo_estimado || 0}</p>
              <p><strong>Tipo de Viaje:</strong> ${viaje.tipo_viaje === 'reparto_local' ? 'Reparto Local' : 'Interurbano'}</p>
            </div>
            <div>
              <p><strong>Fecha Inicio:</strong> ${viaje.fecha_inicio || 'N/A'}</p>
              <p><strong>Estado:</strong> ${viaje.estado || 'N/A'}</p>
            </div>
          </div>

          <table class="details">
            <thead>
              <tr>
                <th>ID Pedido</th>
                <th>Cliente</th>
                <th>Origen</th>
                <th>Destino</th>
                <th>Firma Entrega</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colspan="5" style="text-align: center; padding: 20px; color: #666;">
                  Ver detalle de pedidos asociados en el sistema.
                </td>
              </tr>
            </tbody>
          </table>

          <div class="footer">
            <p>Firma Chofer _________________________ &nbsp;&nbsp;&nbsp;&nbsp; Firma Despachante _________________________</p>
          </div>
        </body>
      </html>
    `;

    doc.open();
    doc.write(html);
    doc.close();

    setTimeout(() => {
      printFrameRef.current?.contentWindow?.focus();
      printFrameRef.current?.contentWindow?.print();
    }, 250);
  };

  return (
    <div>
      <iframe ref={printFrameRef} style={{ display: 'none' }} title="print-manifest-frame"></iframe>

      <div className="page-header">
        <h1>Asignación y Despacho (Viajes)</h1>
        <button className="btn btn-primary" onClick={handleOpenModal}>
          <Plus size={20} /> Nuevo Viaje
        </button>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>ID Viaje</th>
              <th>Tipo</th>
              <th>Chofer</th>
              <th>Vehículo (Chapa)</th>
              <th>Fecha Inicio</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {viajes.map(v => (
              <tr key={v.id}>
                <td>{v.id}</td>
                <td>{v.tipo_viaje === 'reparto_local' ? 'Reparto Local' : 'Interurbano'}</td>
                <td>{v.chofer_nombre}</td>
                <td>{v.vehiculo_chapa}</td>
                <td>{v.fecha_inicio}</td>
                <td>
                  <span className={`status-badge ${v.estado === 'planificado' ? 'pendiente' : (v.estado === 'en curso' ? 'en_curso' : 'entregado')}`}>
                    {v.estado}
                  </span>
                </td>
                <td>
                  <button className="btn btn-outline" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }} onClick={() => handlePrintManifest(v)}>
                    <Printer size={16} className="inline mr-1" /> Imprimir Manifiesto
                  </button>
                </td>
              </tr>
            ))}
            {viajes.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
                  No hay viajes registrados
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px', width: '90%' }}>
            <div className="modal-header">
              <h2>Planificar Nuevo Viaje</h2>
              <button onClick={() => setShowModal(false)} style={{background:'none',border:'none',cursor:'pointer'}}><X/></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label>Sucursal Origen</label>
                  <select required value={formData.sucursal_origen_id} onChange={e => setFormData({...formData, sucursal_origen_id: e.target.value})}>
                    <option value="">Seleccione origen</option>
                    {sucursales.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Sucursal Destino</label>
                  <select required value={formData.sucursal_destino_id} onChange={e => setFormData({...formData, sucursal_destino_id: e.target.value})}>
                    <option value="">Seleccione destino</option>
                    {sucursales.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Chofer</label>
                  <select required value={formData.chofer_id} onChange={e => setFormData({...formData, chofer_id: e.target.value})}>
                    <option value="">Seleccione un chofer</option>
                    {choferes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Vehículo Disponible</label>
                  <select required value={formData.vehiculo_id} onChange={e => setFormData({...formData, vehiculo_id: e.target.value})}>
                    <option value="">Seleccione un vehículo</option>
                    {vehiculos.map(v => <option key={v.id} value={v.id}>{v.chapa} - {v.marca}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Fecha de Inicio</label>
                  <input type="datetime-local" required value={formData.fecha_inicio} onChange={e => setFormData({...formData, fecha_inicio: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Costo Estimado ($)</label>
                  <input type="number" step="0.01" required value={formData.costo_estimado} onChange={e => setFormData({...formData, costo_estimado: parseFloat(e.target.value)})} />
                </div>
                <div className="form-group">
                  <label>Tipo de Viaje</label>
                  <select required value={formData.tipo_viaje} onChange={e => setFormData({...formData, tipo_viaje: e.target.value})}>
                    <option value="interurbano">Interurbano</option>
                    <option value="reparto_local">Reparto Local</option>
                  </select>
                </div>
              </div>
              
              <div className="form-group" style={{ marginTop: '1rem' }}>
                <label>Pedidos a incluir en el viaje</label>
                <div style={{maxHeight:'150px', overflowY:'auto', border:'1px solid #e5e7eb', padding:'0.5rem', borderRadius:'0.375rem'}}>
                  {pedidos.length === 0 ? <p style={{color:'#6b7280', fontSize:'0.875rem'}}>No hay pedidos pendientes</p> : null}
                  {pedidos.map(p => (
                    <div key={p.id} style={{marginBottom:'0.5rem'}}>
                      <label style={{display:'flex', alignItems:'center', gap:'0.5rem', fontWeight:'normal'}}>
                        <input type="checkbox" checked={formData.pedido_ids.includes(p.id.toString())} onChange={() => handlePedidoSelect(p.id.toString())} />
                        Pedido #{p.numero_guia || p.id} - {p.cliente_pagador_nombre || p.cliente_nombre || 'S/N'} ({p.sucursal_origen_nombre || p.origen || 'S/N'} a {p.sucursal_destino_nombre || p.destino || 'S/N'})
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem', borderTop: '1px solid #e5e7eb', paddingTop: '1rem' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Crear Viaje</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
