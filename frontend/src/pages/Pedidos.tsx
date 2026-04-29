import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Plus, X, Printer } from 'lucide-react';

export default function Pedidos() {
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [sucursales, setSucursales] = useState<any[]>([]);
  
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState('generales');
  
  const [formData, setFormData] = useState({
    numero_guia: '',
    tipo_pago: 'contado',
    precio: 0,
    cliente_pagador_id: '',
    remitente_nombre: '', remitente_doc: '', remitente_tel: '', remitente_direccion: '',
    destinatario_nombre: '', destinatario_doc: '', destinatario_tel: '', destinatario_direccion: '',
    sucursal_origen_id: '', sucursal_destino_id: '',
    modalidad_retiro: 'sucursal', modalidad_entrega: 'sucursal',
    cantidad_bultos: 1, peso: 0, volumen: 0, valor_declarado: 0, tipo_carga: ''
  });

  const printFrameRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    loadPedidos();
    fetch('/api/clientes').then(res => res.json()).then(setClientes);
    fetch('/api/sucursales').then(res => res.json()).then(setSucursales);
  }, []);

  const loadPedidos = () => {
    fetch('/api/pedidos')
      .then(res => res.json())
      .then(data => setPedidos(data))
      .catch(console.error);
  };

  const handleOpenModal = () => {
    setFormData({
      numero_guia: 'GUI-' + Math.floor(Math.random() * 1000000),
      tipo_pago: 'contado',
      precio: 0,
      cliente_pagador_id: '',
      remitente_nombre: '', remitente_doc: '', remitente_tel: '', remitente_direccion: '',
      destinatario_nombre: '', destinatario_doc: '', destinatario_tel: '', destinatario_direccion: '',
      sucursal_origen_id: '', sucursal_destino_id: '',
      modalidad_retiro: 'sucursal', modalidad_entrega: 'sucursal',
      cantidad_bultos: 1, peso: 0, volumen: 0, valor_declarado: 0, tipo_carga: ''
    });
    setActiveTab('generales');
    setShowModal(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (formData.sucursal_origen_id === formData.sucursal_destino_id) {
      alert('La sucursal de origen y destino no pueden ser la misma.');
      return;
    }

    const payload = {
      ...formData,
      origen: sucursales.find(s => s.id.toString() === formData.sucursal_origen_id)?.nombre || 'S/N',
      destino: sucursales.find(s => s.id.toString() === formData.sucursal_destino_id)?.nombre || 'S/N',
      fecha_prevista: new Date().toISOString().split('T')[0],
      estado: 'pendiente_planificacion'
    };

    try {
      const res = await fetch('/api/pedidos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const errorData = await res.json();
        alert('Error: ' + errorData.error);
      } else {
        setShowModal(false);
        loadPedidos();
      }
    } catch (e: any) {
      alert('Error de conexión al guardar pedido');
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSelectRemitente = (e: ChangeEvent<HTMLSelectElement>) => {
    const cliente = clientes.find(c => c.id.toString() === e.target.value);
    if (cliente) {
      setFormData(prev => ({
        ...prev,
        remitente_nombre: cliente.nombre || '',
        remitente_doc: cliente.ruc || '',
        remitente_tel: cliente.telefono || '',
        remitente_direccion: cliente.direccion || '',
      }));
    }
  };

  const handleSelectDestinatario = (e: ChangeEvent<HTMLSelectElement>) => {
    const cliente = clientes.find(c => c.id.toString() === e.target.value);
    if (cliente) {
      setFormData(prev => ({
        ...prev,
        destinatario_nombre: cliente.nombre || '',
        destinatario_doc: cliente.ruc || '',
        destinatario_tel: cliente.telefono || '',
        destinatario_direccion: cliente.direccion || '',
      }));
    }
  };

  const handlePrint = (pedido: any) => {
    if (!printFrameRef.current) return;
    const doc = printFrameRef.current.contentWindow?.document;
    if (!doc) return;

    const html = `
      <html>
        <head>
          <title>Guía de Envío ${pedido.numero_guia || pedido.id}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
            .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
            .row { display: flex; justify-content: space-between; margin-bottom: 15px; }
            .box { border: 1px solid #ccc; padding: 10px; width: 48%; }
            h1 { margin: 0; font-size: 24px; }
            h2 { font-size: 16px; border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-top: 0; }
            p { margin: 5px 0; font-size: 14px; }
            .details { border-collapse: collapse; width: 100%; margin-top: 20px; }
            .details th, .details td { border: 1px solid #ccc; padding: 8px; text-align: left; }
            .details th { background-color: #f9f9f9; }
            .footer { margin-top: 30px; text-align: center; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>GUÍA DE ENVÍO</h1>
            <p><strong>Nro:</strong> ${pedido.numero_guia || 'PED-' + pedido.id}</p>
            <p><strong>Fecha:</strong> ${new Date().toLocaleDateString()}</p>
          </div>
          
          <div class="row">
            <div class="box">
              <h2>Remitente</h2>
              <p><strong>Nombre:</strong> ${pedido.remitente_nombre || pedido.cliente_nombre || 'N/A'}</p>
              <p><strong>Doc:</strong> ${pedido.remitente_doc || 'N/A'}</p>
              <p><strong>Tel:</strong> ${pedido.remitente_tel || 'N/A'}</p>
              <p><strong>Origen:</strong> ${pedido.origen || 'N/A'}</p>
            </div>
            <div class="box">
              <h2>Destinatario</h2>
              <p><strong>Nombre:</strong> ${pedido.destinatario_nombre || 'N/A'}</p>
              <p><strong>Doc:</strong> ${pedido.destinatario_doc || 'N/A'}</p>
              <p><strong>Tel:</strong> ${pedido.destinatario_tel || 'N/A'}</p>
              <p><strong>Destino:</strong> ${pedido.destino || 'N/A'}</p>
            </div>
          </div>

          <table class="details">
            <thead>
              <tr>
                <th>Tipo Carga</th>
                <th>Bultos</th>
                <th>Peso</th>
                <th>Precio</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>${pedido.tipo_carga || 'N/A'}</td>
                <td>${pedido.cantidad_bultos || 1}</td>
                <td>${pedido.peso || 0} kg</td>
                <td>$${pedido.precio || 0}</td>
              </tr>
            </tbody>
          </table>

          <div class="footer">
            <p>Firma Remitente _________________________ &nbsp;&nbsp;&nbsp;&nbsp; Firma Destinatario _________________________</p>
            <p>Gracias por confiar en Transportadora SaaS.</p>
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
      <iframe ref={printFrameRef} style={{ display: 'none' }} title="print-frame"></iframe>

      <div className="page-header">
        <h1>Gestión de Pedidos</h1>
        <button className="btn btn-primary" onClick={handleOpenModal}>
          <Plus size={20} /> Nuevo Pedido
        </button>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Guía / ID</th>
              <th>Cliente Pagador</th>
              <th>Origen</th>
              <th>Destino</th>
              <th>Bultos/Peso</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {pedidos.map(p => (
              <tr key={p.id}>
                <td>{p.numero_guia || p.id}</td>
                <td>{p.cliente_pagador_nombre || p.cliente_nombre || 'S/N'}</td>
                <td>{p.sucursal_origen_nombre || p.remitente_direccion || p.origen || 'S/N'}</td>
                <td>{p.sucursal_destino_nombre || p.destinatario_direccion || p.destino || 'S/N'}</td>
                <td>{p.cantidad_bultos || 1} u / {p.peso || 0} kg</td>
                <td>
                  <span className={`status-badge ${p.estado === 'pendiente_planificacion' || p.estado === 'pendiente' ? 'pendiente' : (p.estado === 'entregado' ? 'entregado' : 'en_curso')}`}>
                    {p.estado}
                  </span>
                </td>
                <td>
                  <button className="btn btn-outline" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }} onClick={() => handlePrint(p)}>
                    <Printer size={16} className="inline mr-1" /> Imprimir Guía
                  </button>
                </td>
              </tr>
            ))}
            {pedidos.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
                  No hay pedidos registrados
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '800px', width: '90%' }}>
            <div className="modal-header">
              <h2>Nuevo Pedido</h2>
              <button onClick={() => setShowModal(false)} style={{background:'none',border:'none',cursor:'pointer'}}><X/></button>
            </div>

            <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', marginBottom: '1rem' }}>
              <button 
                type="button"
                style={{ flex: 1, padding: '0.5rem', borderBottom: activeTab === 'generales' ? '2px solid #2563eb' : '2px solid transparent', background: 'none', borderTop: 'none', borderLeft: 'none', borderRight: 'none', cursor: 'pointer', fontWeight: activeTab === 'generales' ? 'bold' : 'normal', color: activeTab === 'generales' ? '#2563eb' : '#6b7280' }}
                onClick={() => setActiveTab('generales')}
              >
                Generales
              </button>
              <button 
                type="button"
                style={{ flex: 1, padding: '0.5rem', borderBottom: activeTab === 'sujetos' ? '2px solid #2563eb' : '2px solid transparent', background: 'none', borderTop: 'none', borderLeft: 'none', borderRight: 'none', cursor: 'pointer', fontWeight: activeTab === 'sujetos' ? 'bold' : 'normal', color: activeTab === 'sujetos' ? '#2563eb' : '#6b7280' }}
                onClick={() => setActiveTab('sujetos')}
              >
                Sujetos (Rem. y Dest.)
              </button>
              <button 
                type="button"
                style={{ flex: 1, padding: '0.5rem', borderBottom: activeTab === 'logistica' ? '2px solid #2563eb' : '2px solid transparent', background: 'none', borderTop: 'none', borderLeft: 'none', borderRight: 'none', cursor: 'pointer', fontWeight: activeTab === 'logistica' ? 'bold' : 'normal', color: activeTab === 'logistica' ? '#2563eb' : '#6b7280' }}
                onClick={() => setActiveTab('logistica')}
              >
                Logística
              </button>
              <button 
                type="button"
                style={{ flex: 1, padding: '0.5rem', borderBottom: activeTab === 'carga' ? '2px solid #2563eb' : '2px solid transparent', background: 'none', borderTop: 'none', borderLeft: 'none', borderRight: 'none', cursor: 'pointer', fontWeight: activeTab === 'carga' ? 'bold' : 'normal', color: activeTab === 'carga' ? '#2563eb' : '#6b7280' }}
                onClick={() => setActiveTab('carga')}
              >
                Carga
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              
              <div style={{ display: activeTab === 'generales' ? 'block' : 'none' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label>Número de Guía</label>
                    <input required name="numero_guia" value={formData.numero_guia} onChange={handleChange} />
                  </div>
                  <div className="form-group">
                    <label>Cliente Pagador</label>
                    <select required name="cliente_pagador_id" value={formData.cliente_pagador_id} onChange={handleChange}>
                      <option value="">Seleccione un cliente</option>
                      {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Tipo de Pago</label>
                    <select required name="tipo_pago" value={formData.tipo_pago} onChange={handleChange}>
                      <option value="contado">Contado</option>
                      <option value="credito">Crédito</option>
                      <option value="destino">Cobro en Destino</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Precio Total</label>
                    <input type="number" required name="precio" value={formData.precio} onChange={handleChange} />
                  </div>
                </div>
              </div>

              <div style={{ display: activeTab === 'sujetos' ? 'block' : 'none' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                  <div>
                    <h3 style={{ fontSize: '1rem', marginBottom: '1rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.5rem' }}>Remitente</h3>
                    <div className="form-group">
                      <label style={{ fontSize: '0.85rem', color: '#6b7280' }}>Seleccionar cliente existente (Opcional)</label>
                      <select onChange={handleSelectRemitente} defaultValue="">
                        <option value="">-- Escribir manualmente --</option>
                        {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Nombre / Razón Social</label>
                      <input required name="remitente_nombre" value={formData.remitente_nombre} onChange={handleChange} />
                    </div>
                    <div className="form-group">
                      <label>Documento/RUC</label>
                      <input name="remitente_doc" value={formData.remitente_doc} onChange={handleChange} />
                    </div>
                    <div className="form-group">
                      <label>Teléfono</label>
                      <input name="remitente_tel" value={formData.remitente_tel} onChange={handleChange} />
                    </div>
                    <div className="form-group">
                      <label>Dirección</label>
                      <input name="remitente_direccion" value={formData.remitente_direccion} onChange={handleChange} />
                    </div>
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1rem', marginBottom: '1rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.5rem' }}>Destinatario</h3>
                    <div className="form-group">
                      <label style={{ fontSize: '0.85rem', color: '#6b7280' }}>Seleccionar cliente existente (Opcional)</label>
                      <select onChange={handleSelectDestinatario} defaultValue="">
                        <option value="">-- Escribir manualmente --</option>
                        {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Nombre / Razón Social</label>
                      <input required name="destinatario_nombre" value={formData.destinatario_nombre} onChange={handleChange} />
                    </div>
                    <div className="form-group">
                      <label>Documento/RUC</label>
                      <input name="destinatario_doc" value={formData.destinatario_doc} onChange={handleChange} />
                    </div>
                    <div className="form-group">
                      <label>Teléfono</label>
                      <input name="destinatario_tel" value={formData.destinatario_tel} onChange={handleChange} />
                    </div>
                    <div className="form-group">
                      <label>Dirección</label>
                      <input name="destinatario_direccion" value={formData.destinatario_direccion} onChange={handleChange} />
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: activeTab === 'logistica' ? 'block' : 'none' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label>Sucursal Origen</label>
                    <select required name="sucursal_origen_id" value={formData.sucursal_origen_id} onChange={handleChange}>
                      <option value="">Seleccione sucursal</option>
                      {sucursales.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Sucursal Destino</label>
                    <select required name="sucursal_destino_id" value={formData.sucursal_destino_id} onChange={handleChange}>
                      <option value="">Seleccione sucursal</option>
                      {sucursales.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Modalidad de Retiro</label>
                    <select required name="modalidad_retiro" value={formData.modalidad_retiro} onChange={handleChange}>
                      <option value="sucursal">En Sucursal</option>
                      <option value="domicilio">Retiro a Domicilio</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Modalidad de Entrega</label>
                    <select required name="modalidad_entrega" value={formData.modalidad_entrega} onChange={handleChange}>
                      <option value="sucursal">En Sucursal</option>
                      <option value="domicilio">Entrega a Domicilio</option>
                    </select>
                  </div>
                </div>
              </div>

              <div style={{ display: activeTab === 'carga' ? 'block' : 'none' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label>Tipo de Carga</label>
                    <input required name="tipo_carga" value={formData.tipo_carga} onChange={handleChange} placeholder="Cajas, Pallets, Sobres..." />
                  </div>
                  <div className="form-group">
                    <label>Cantidad de Bultos</label>
                    <input type="number" required name="cantidad_bultos" value={formData.cantidad_bultos} onChange={handleChange} />
                  </div>
                  <div className="form-group">
                    <label>Peso (kg)</label>
                    <input type="number" step="0.01" required name="peso" value={formData.peso} onChange={handleChange} />
                  </div>
                  <div className="form-group">
                    <label>Volumen (m3)</label>
                    <input type="number" step="0.01" name="volumen" value={formData.volumen} onChange={handleChange} />
                  </div>
                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label>Valor Declarado ($)</label>
                    <input type="number" step="0.01" name="valor_declarado" value={formData.valor_declarado} onChange={handleChange} />
                  </div>
                </div>
              </div>

              <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem', borderTop: '1px solid #e5e7eb', paddingTop: '1rem' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Guardar Pedido</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
