import { useEffect, useMemo, useRef, useState } from 'react';
import { Bold, Italic, List, Save, Type } from 'lucide-react';

type TicketField = {
  key: string;
  label: string;
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

export default function Configuracion() {
  const [membrete, setMembrete] = useState('');
  const editorRef = useRef<HTMLDivElement>(null);
  const [ticketWidth, setTicketWidth] = useState(32);
  const [ticketCopies, setTicketCopies] = useState(2);
  const [fields, setFields] = useState<Record<string, boolean>>(defaultFields);

  const enabledCount = useMemo(() => Object.values(fields).filter(Boolean).length, [fields]);

  useEffect(() => {
    fetch('/api/configuracion')
      .then(res => res.json())
      .then(data => {
        const byKey = Object.fromEntries(data.map((item: any) => [item.clave, item.valor]));
        setMembrete(String(byKey.membrete || ''));
        setTicketWidth(Number(byKey.ticket_width_chars || 32));
        setTicketCopies(Number(byKey.ticket_copies || 2));
        if (byKey.ticket_fields) {
          try {
            setFields({ ...defaultFields, ...JSON.parse(String(byKey.ticket_fields)) });
          } catch {
            setFields(defaultFields);
          }
        }
      });
  }, []);

  const toggleField = (key: string) => {
    setFields(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = () => {
    fetch('/api/configuracion/bulk', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        membrete,
        ticket_width_chars: String(ticketWidth),
        ticket_copies: String(ticketCopies),
        ticket_fields: JSON.stringify(fields)
      })
    }).then(() => alert('Configuracion guardada'));
  };

  const format = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    setMembrete(editorRef.current?.innerHTML || '');
  };

  return (
    <div>
      <div className="page-header">
        <h1>Configuracion SaaS</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 620px) minmax(320px, 1fr)', gap: '1.5rem', alignItems: 'start' }}>
        <section className="stat-card">
          <h3>Tickets termicos Bluetooth</h3>
          <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: '0.5rem 0 1rem' }}>
            Parametros usados por la app de choferes para comprobantes de retiro y comandas.
          </p>

          <div className="form-group">
            <label>Membrete</label>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
              <button type="button" className="btn btn-outline" style={{ padding: '0.45rem 0.6rem' }} onClick={() => format('bold')} title="Negrita"><Bold size={16} /></button>
              <button type="button" className="btn btn-outline" style={{ padding: '0.45rem 0.6rem' }} onClick={() => format('italic')} title="Cursiva"><Italic size={16} /></button>
              <button type="button" className="btn btn-outline" style={{ padding: '0.45rem 0.6rem' }} onClick={() => format('insertUnorderedList')} title="Lista"><List size={16} /></button>
              <button type="button" className="btn btn-outline" style={{ padding: '0.45rem 0.6rem' }} onClick={() => format('formatBlock', 'h3')} title="Titulo"><Type size={16} /></button>
            </div>
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              onInput={e => setMembrete(e.currentTarget.innerHTML)}
              dangerouslySetInnerHTML={{ __html: membrete }}
              style={{
                minHeight: 140,
                border: '1px solid #d1d5db',
                borderRadius: '0.5rem',
                padding: '0.75rem',
                background: '#fff',
                outline: 'none'
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label>Ancho del ticket en caracteres</label>
              <input
                type="number"
                min={24}
                max={64}
                value={ticketWidth}
                onChange={e => setTicketWidth(Number(e.target.value))}
              />
            </div>

            <div className="form-group">
              <label>Vias por defecto</label>
              <input
                type="number"
                min={1}
                max={5}
                value={ticketCopies}
                onChange={e => setTicketCopies(Number(e.target.value))}
              />
            </div>
          </div>

          <button className="btn btn-primary" onClick={handleSave}>
            <Save size={16} /> Guardar configuracion
          </button>
        </section>

        <section className="stat-card">
          <h3>Campos a imprimir</h3>
          <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: '0.5rem 0 1rem' }}>
            {enabledCount} campos activos para los comprobantes.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.5rem 1rem' }}>
            {ticketFields.map(field => (
              <label key={field.key} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', padding: '0.35rem 0' }}>
                <input
                  type="checkbox"
                  checked={Boolean(fields[field.key])}
                  onChange={() => toggleField(field.key)}
                  style={{ width: 'auto' }}
                />
                <span>{field.label}</span>
              </label>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
