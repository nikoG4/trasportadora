import { useEffect, useMemo, useState } from 'react';
import { AlignCenter, AlignLeft, AlignRight, Eye, EyeOff, Image, Minus, Plus, Save, Trash2, Type, ArrowDown, ArrowUp, GripVertical } from 'lucide-react';

type TicketField = { key: string; label: string };
type PaperWidth = 58 | 80;
type HeaderBlockType = 'LOGO' | 'TEXT' | 'SEPARATOR' | 'SPACER';
type Alignment = 'LEFT' | 'CENTER' | 'RIGHT';

type HeaderBlock = {
  id: string;
  type: HeaderBlockType;
  visible: boolean;
  order: number;
  alignment: Alignment;
  text?: string;
  imageUrl?: string;
  fontSize?: number;
  bold?: boolean;
  widthPercent?: number;
  marginTop?: number;
  marginBottom?: number;
  height?: number;
};

type HeaderTemplate = {
  id?: number | null;
  companyId?: number;
  name: string;
  paperWidthDefault: PaperWidth;
  blocks: HeaderBlock[];
  version?: number;
  updatedAt?: string;
};

type MapCenterConfig = {
  label: string;
  lat: string;
  lng: string;
  zoom: string;
};

const ticketFields: TicketField[] = [
  { key: 'numero_guia', label: 'Numero de guia' },
  { key: 'fecha', label: 'Fecha y hora' },
  { key: 'remitente_nombre', label: 'Remitente' },
  { key: 'remitente_doc', label: 'Documento remitente' },
  { key: 'remitente_tel', label: 'Telefono remitente' },
  { key: 'remitente_direccion', label: 'Direccion remitente' },
  { key: 'destinatario_nombre', label: 'Destinatario' },
  { key: 'destinatario_doc', label: 'Documento destinatario' },
  { key: 'destinatario_tel', label: 'Telefono destinatario' },
  { key: 'destinatario_direccion', label: 'Direccion destinatario' },
  { key: 'sucursal_origen_nombre', label: 'Sucursal origen' },
  { key: 'sucursal_destino_nombre', label: 'Sucursal destino' },
  { key: 'tipo_carga', label: 'Tipo de carga' },
  { key: 'cantidad_bultos', label: 'Bultos' },
  { key: 'peso', label: 'Peso' },
  { key: 'volumen', label: 'Volumen' },
  { key: 'valor_declarado', label: 'Valor declarado' },
  { key: 'precio', label: 'Precio' },
  { key: 'tipo_pago', label: 'Tipo de pago' },
  { key: 'estado', label: 'Estado del pedido' },
  { key: 'observaciones', label: 'Observaciones' }
];

const defaultFields = ticketFields.reduce<Record<string, boolean>>((acc, field) => {
  acc[field.key] = !['volumen', 'valor_declarado'].includes(field.key);
  return acc;
}, {});

const defaultTemplate: HeaderTemplate = {
  name: 'Membrete principal',
  paperWidthDefault: 58,
  blocks: [
    { id: crypto.randomUUID(), type: 'TEXT', visible: true, order: 1, alignment: 'CENTER', text: 'TRANSPORTADORA PARAGUAY SAAS', fontSize: 18, bold: true, marginTop: 2, marginBottom: 2 },
    { id: crypto.randomUUID(), type: 'TEXT', visible: true, order: 2, alignment: 'CENTER', text: 'RUC: 80012345-6', fontSize: 14, bold: false, marginTop: 0, marginBottom: 2 },
    { id: crypto.randomUUID(), type: 'TEXT', visible: true, order: 3, alignment: 'CENTER', text: 'Tel: 0981 000 000', fontSize: 14, bold: false, marginTop: 0, marginBottom: 4 }
  ]
};

function sortBlocks(blocks: HeaderBlock[]) {
  return [...blocks].sort((a, b) => a.order - b.order).map((block, index) => ({ ...block, order: index + 1 }));
}

function ticketPixels(width: PaperWidth) {
  return width === 80 ? 576 : 384;
}

function optimizeLogo(file: File, maxWidth: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer el logo'));
    reader.onload = () => {
      const img = document.createElement('img');
      img.onerror = () => reject(new Error('Imagen corrupta o formato no soportado'));
      img.onload = () => {
        const fitWidth = Math.max(1, Math.min(maxWidth, img.width));
        const scale = Math.min(1, fitWidth / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('No se pudo optimizar el logo'));
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/png'));
      };
      img.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  });
}

function blockLabel(type: HeaderBlockType) {
  return ({ LOGO: 'Logo', TEXT: 'Texto', SEPARATOR: 'Separador', SPACER: 'Espacio' } as Record<HeaderBlockType, string>)[type];
}

export default function Configuracion() {
  const [template, setTemplate] = useState<HeaderTemplate>(defaultTemplate);
  const [previewWidth, setPreviewWidth] = useState<PaperWidth>(58);
  const [ticketWidth, setTicketWidth] = useState(32);
  const [ticketCopies, setTicketCopies] = useState(2);
  const [mapCenter, setMapCenter] = useState<MapCenterConfig>({
    label: 'Ciudad del Este',
    lat: '-25.5167',
    lng: '-54.6167',
    zoom: '13'
  });
  const [fields, setFields] = useState<Record<string, boolean>>(defaultFields);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');

  const enabledCount = useMemo(() => Object.values(fields).filter(Boolean).length, [fields]);
  const orderedBlocks = useMemo(() => sortBlocks(template.blocks), [template.blocks]);

  useEffect(() => {
    fetch('/api/header-template')
      .then(res => res.json())
      .then(data => {
        if (data?.blocks) {
          setTemplate({ ...defaultTemplate, ...data, blocks: sortBlocks(data.blocks) });
          setPreviewWidth(Number(data.paperWidthDefault) === 80 ? 80 : 58);
        }
      })
      .catch(() => setStatus('No se pudo cargar el diseno de membrete'));

    fetch('/api/configuracion')
      .then(res => res.json())
      .then(data => {
        const byKey = Object.fromEntries(data.map((item: any) => [item.clave, item.valor]));
        setTicketWidth(Number(byKey.ticket_width_chars || 32));
        setTicketCopies(Number(byKey.ticket_copies || 2));
        setMapCenter({
          label: String(byKey.map_default_label || 'Ciudad del Este'),
          lat: String(byKey.map_default_lat || '-25.5167'),
          lng: String(byKey.map_default_lng || '-54.6167'),
          zoom: String(byKey.map_default_zoom || '13')
        });
        if (byKey.ticket_fields) {
          try {
            setFields({ ...defaultFields, ...JSON.parse(String(byKey.ticket_fields)) });
          } catch {
            setFields(defaultFields);
          }
        }
      });
  }, []);

  const patchTemplate = (patch: Partial<HeaderTemplate>) => setTemplate(prev => ({ ...prev, ...patch }));

  const updateBlock = (id: string, patch: Partial<HeaderBlock>) => {
    setTemplate(prev => ({ ...prev, blocks: sortBlocks(prev.blocks.map(block => block.id === id ? { ...block, ...patch } : block)) }));
  };

  const addBlock = (type: HeaderBlockType) => {
    const next: HeaderBlock = {
      id: crypto.randomUUID(),
      type,
      visible: true,
      order: orderedBlocks.length + 1,
      alignment: 'CENTER',
      text: type === 'TEXT' ? 'Nuevo texto' : '',
      fontSize: type === 'TEXT' ? 14 : 12,
      bold: false,
      widthPercent: type === 'LOGO' ? 55 : 100,
      marginTop: 2,
      marginBottom: 2,
      height: type === 'SPACER' ? 12 : 1
    };
    setTemplate(prev => ({ ...prev, blocks: sortBlocks([...prev.blocks, next]) }));
  };

  const moveBlock = (id: string, direction: -1 | 1) => {
    const blocks = sortBlocks(template.blocks);
    const index = blocks.findIndex(block => block.id === id);
    const swapIndex = index + direction;
    if (index < 0 || swapIndex < 0 || swapIndex >= blocks.length) return;
    [blocks[index], blocks[swapIndex]] = [blocks[swapIndex], blocks[index]];
    setTemplate(prev => ({ ...prev, blocks: sortBlocks(blocks) }));
  };

  const removeBlock = (id: string) => {
    setTemplate(prev => ({ ...prev, blocks: sortBlocks(prev.blocks.filter(block => block.id !== id)) }));
  };

  const handleLogo = async (blockId: string, file?: File) => {
    if (!file) return;
    try {
      const maxWidth = ticketPixels(previewWidth);
      const dataUrl = await optimizeLogo(file, maxWidth);
      updateBlock(blockId, { imageUrl: dataUrl });
      fetch('/api/header-template/logo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataUrl })
      }).catch(() => undefined);
    } catch (err: any) {
      alert(err.message || 'No se pudo procesar el logo');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setStatus('');
    try {
      const cleanTemplate = { ...template, blocks: orderedBlocks, paperWidthDefault: previewWidth };
      const headerRes = await fetch('/api/header-template', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cleanTemplate)
      });
      if (!headerRes.ok) throw new Error('No se pudo guardar el membrete');
      const saved = await headerRes.json();
      setTemplate({ ...saved, blocks: sortBlocks(saved.blocks || []) });

      await fetch('/api/configuracion/bulk', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticket_width_chars: String(ticketWidth),
          ticket_copies: String(ticketCopies),
          map_default_label: mapCenter.label,
          map_default_lat: mapCenter.lat,
          map_default_lng: mapCenter.lng,
          map_default_zoom: mapCenter.zoom,
          ticket_fields: JSON.stringify(fields)
        })
      });
      setStatus('Configuracion guardada');
    } catch (err: any) {
      setStatus(err.message || 'Error guardando configuracion');
    } finally {
      setSaving(false);
    }
  };

  const renderPreviewBlock = (block: HeaderBlock) => {
    if (!block.visible) return null;
    const textAlign = block.alignment.toLowerCase() as any;
    const margins = { marginTop: block.marginTop || 0, marginBottom: block.marginBottom || 0 };
    if (block.type === 'TEXT') {
      return <div key={block.id} style={{ ...margins, textAlign, fontSize: block.fontSize || 14, fontWeight: block.bold ? 800 : 500, lineHeight: 1.15, overflowWrap: 'anywhere' }}>{block.text}</div>;
    }
    if (block.type === 'LOGO') {
      const imageWidth = Math.min(block.widthPercent || 55, previewWidth === 80 ? 56 : 60);
      return (
        <div key={block.id} style={{ ...margins, textAlign }}>
          {block.imageUrl ? <img src={block.imageUrl} alt="Logo" style={{ width: `${imageWidth}%`, maxWidth: '100%', height: 'auto', objectFit: 'contain' }} /> : <div style={{ border: '1px dashed #9ca3af', padding: '0.75rem', color: '#6b7280' }}>Logo</div>}
        </div>
      );
    }
    if (block.type === 'SEPARATOR') return <div key={block.id} style={{ ...margins, borderTop: '1px dashed #111827' }} />;
    return <div key={block.id} style={{ height: block.height || 12 }} />;
  };

  return (
    <div>
      <div className="page-header">
        <h1>Diseno de membrete</h1>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          <Save size={16} /> {saving ? 'Guardando...' : 'Guardar configuracion'}
        </button>
      </div>

      {status && <div style={{ marginBottom: '1rem', color: status.includes('Error') || status.includes('No se') ? '#b91c1c' : '#047857', fontWeight: 600 }}>{status}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(360px, 1fr) minmax(320px, 460px)', gap: '1.25rem', alignItems: 'start' }}>
        <section className="stat-card">
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label>Nombre del diseno</label>
              <input value={template.name} onChange={e => patchTemplate({ name: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Ancho por defecto</label>
              <select value={previewWidth} onChange={e => setPreviewWidth(Number(e.target.value) as PaperWidth)}>
                <option value={58}>58 mm</option>
                <option value={80}>80 mm</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', margin: '0.25rem 0 1rem' }}>
            <button className="btn btn-outline" type="button" onClick={() => addBlock('LOGO')}><Image size={16} /> Logo</button>
            <button className="btn btn-outline" type="button" onClick={() => addBlock('TEXT')}><Type size={16} /> Texto</button>
            <button className="btn btn-outline" type="button" onClick={() => addBlock('SEPARATOR')}><Minus size={16} /> Separador</button>
            <button className="btn btn-outline" type="button" onClick={() => addBlock('SPACER')}><Plus size={16} /> Espacio</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {orderedBlocks.map((block, index) => (
              <div key={block.id} style={{ border: '1px solid #e5e7eb', borderRadius: '0.5rem', padding: '0.9rem', background: '#fff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <strong style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><GripVertical size={16} /> {index + 1}. {blockLabel(block.type)}</strong>
                  <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                    <button className="btn btn-outline" style={{ padding: '0.35rem' }} type="button" onClick={() => moveBlock(block.id, -1)} title="Subir"><ArrowUp size={16} /></button>
                    <button className="btn btn-outline" style={{ padding: '0.35rem' }} type="button" onClick={() => moveBlock(block.id, 1)} title="Bajar"><ArrowDown size={16} /></button>
                    <button className="btn btn-outline" style={{ padding: '0.35rem' }} type="button" onClick={() => updateBlock(block.id, { visible: !block.visible })} title={block.visible ? 'Ocultar' : 'Mostrar'}>{block.visible ? <Eye size={16} /> : <EyeOff size={16} />}</button>
                    <button className="btn btn-outline" style={{ padding: '0.35rem', color: '#b91c1c' }} type="button" onClick={() => removeBlock(block.id)} title="Eliminar"><Trash2 size={16} /></button>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem' }}>
                  <div className="form-group">
                    <label>Alineacion</label>
                    <div style={{ display: 'flex', gap: '0.35rem' }}>
                      {(['LEFT', 'CENTER', 'RIGHT'] as Alignment[]).map(alignment => (
                        <button key={alignment} type="button" className={block.alignment === alignment ? 'btn btn-primary' : 'btn btn-outline'} style={{ padding: '0.45rem' }} onClick={() => updateBlock(block.id, { alignment })}>
                          {alignment === 'LEFT' ? <AlignLeft size={16} /> : alignment === 'CENTER' ? <AlignCenter size={16} /> : <AlignRight size={16} />}
                        </button>
                      ))}
                    </div>
                  </div>

                  {block.type === 'TEXT' && (
                    <>
                      <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                        <label>Texto</label>
                        <textarea rows={2} value={block.text || ''} onChange={e => updateBlock(block.id, { text: e.target.value })} />
                      </div>
                      <div className="form-group">
                        <label>Tamano</label>
                        <input type="number" min={8} max={36} value={block.fontSize || 14} onChange={e => updateBlock(block.id, { fontSize: Number(e.target.value) })} />
                      </div>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1.9rem' }}>
                        <input type="checkbox" checked={Boolean(block.bold)} onChange={e => updateBlock(block.id, { bold: e.target.checked })} style={{ width: 'auto' }} />
                        Negrita
                      </label>
                    </>
                  )}

                  {block.type === 'LOGO' && (
                    <>
                      <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                        <label>Logo</label>
                        <input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => handleLogo(block.id, e.target.files?.[0])} />
                      </div>
                      <div className="form-group">
                        <label>Ancho del logo (%)</label>
                        <input type="range" min={10} max={70} value={Math.min(block.widthPercent || 55, 70)} onChange={e => updateBlock(block.id, { widthPercent: Number(e.target.value) })} />
                        <small style={{ color: '#6b7280' }}>En impresion se recortan los bordes blancos del membrete y se centra automaticamente.</small>
                      </div>
                    </>
                  )}

                  {block.type === 'SPACER' && (
                    <div className="form-group">
                      <label>Alto (px)</label>
                      <input type="number" min={1} max={120} value={block.height || 12} onChange={e => updateBlock(block.id, { height: Number(e.target.value) })} />
                    </div>
                  )}

                  <div className="form-group">
                    <label>Margen superior</label>
                    <input type="number" min={0} max={40} value={block.marginTop || 0} onChange={e => updateBlock(block.id, { marginTop: Number(e.target.value) })} />
                  </div>
                  <div className="form-group">
                    <label>Margen inferior</label>
                    <input type="number" min={0} max={40} value={block.marginBottom || 0} onChange={e => updateBlock(block.id, { marginBottom: Number(e.target.value) })} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <aside style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <section className="stat-card">
            <h3>Centro por defecto de mapas</h3>
            <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: '0.5rem 0 1rem' }}>
              Se usa cuando una pantalla no tiene puntos cargados todavia.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem' }}>
              <div className="form-group">
                <label>Referencia</label>
                <input value={mapCenter.label} onChange={e => setMapCenter(prev => ({ ...prev, label: e.target.value }))} placeholder="Ciudad del Este" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label>Latitud</label>
                  <input type="number" step="any" value={mapCenter.lat} onChange={e => setMapCenter(prev => ({ ...prev, lat: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Longitud</label>
                  <input type="number" step="any" value={mapCenter.lng} onChange={e => setMapCenter(prev => ({ ...prev, lng: e.target.value }))} />
                </div>
              </div>
              <div className="form-group">
                <label>Zoom inicial</label>
                <input type="number" min={3} max={19} value={mapCenter.zoom} onChange={e => setMapCenter(prev => ({ ...prev, zoom: e.target.value }))} />
              </div>
            </div>
          </section>

          <section className="stat-card">
            <h3>Vista previa</h3>
            <div style={{ display: 'flex', gap: '0.5rem', margin: '0.75rem 0' }}>
              <button className={previewWidth === 58 ? 'btn btn-primary' : 'btn btn-outline'} onClick={() => setPreviewWidth(58)}>58 mm</button>
              <button className={previewWidth === 80 ? 'btn btn-primary' : 'btn btn-outline'} onClick={() => setPreviewWidth(80)}>80 mm</button>
            </div>
            <div style={{ overflowX: 'auto', paddingBottom: '0.5rem' }}>
              <div style={{ width: Math.min(ticketPixels(previewWidth) / 2, 360), minHeight: 220, margin: '0 auto', background: '#fff', color: '#111827', border: '1px solid #d1d5db', padding: 10, fontFamily: 'Arial, sans-serif', boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }}>
                {orderedBlocks.map(renderPreviewBlock)}
                <div style={{ borderTop: '1px dashed #111827', margin: '8px 0' }} />
                <div style={{ textAlign: 'center', fontWeight: 800, fontSize: 13 }}>COMPROBANTE DE RETIRO</div>
                <div style={{ fontFamily: 'monospace', fontSize: 12, marginTop: 6 }}>
                  <div><strong>Guia:</strong> Numero de ejemplo</div>
                  <div><strong>Remitente:</strong> Remitente de ejemplo</div>
                  <div><strong>Total:</strong> Monto de ejemplo</div>
                </div>
              </div>
            </div>
          </section>

          <section className="stat-card">
            <h3>Tickets termicos Bluetooth</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
              <div className="form-group">
                <label>Ancho en caracteres</label>
                <input type="number" min={24} max={64} value={ticketWidth} onChange={e => setTicketWidth(Number(e.target.value))} />
              </div>
              <div className="form-group">
                <label>Vias por defecto</label>
                <input type="number" min={1} max={5} value={ticketCopies} onChange={e => setTicketCopies(Number(e.target.value))} />
              </div>
            </div>
          </section>

          <section className="stat-card">
            <h3>Campos a imprimir</h3>
            <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: '0.5rem 0 1rem' }}>{enabledCount} campos activos.</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.35rem' }}>
              {ticketFields.map(field => (
                <label key={field.key} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input type="checkbox" checked={Boolean(fields[field.key])} onChange={() => setFields(prev => ({ ...prev, [field.key]: !prev[field.key] }))} style={{ width: 'auto' }} />
                  <span>{field.label}</span>
                </label>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
