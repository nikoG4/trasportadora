import { useEffect, useState, type FormEvent } from 'react';
import { Plus, X } from 'lucide-react';

export default function Vehiculos() {
  const [vehiculos, setVehiculos] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ chapa: '', marca: '', modelo: '', capacidad: '', vencimiento_seguro: '', vencimiento_habilitacion: '' });

  useEffect(() => {
    loadVehiculos();
  }, []);

  const loadVehiculos = () => {
    fetch('/api/vehiculos')
      .then(res => res.json())
      .then(data => setVehiculos(data))
      .catch(console.error);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    fetch('/api/vehiculos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    }).then(() => {
      setShowModal(false);
      loadVehiculos();
    });
  };

  return (
    <div>
      <div className="page-header">
        <h1>Gestión de Flota</h1>
        <button className="btn btn-primary" onClick={() => {
          setFormData({ chapa: '', marca: '', modelo: '', capacidad: '', vencimiento_seguro: '', vencimiento_habilitacion: '' });
          setShowModal(true);
        }}>
          <Plus size={20} /> Nuevo Vehículo
        </button>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Chapa</th>
              <th>Marca/Modelo</th>
              <th>Capacidad</th>
              <th>Venc. Seguro</th>
              <th>Venc. Habilitación</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {vehiculos.map(v => (
              <tr key={v.id}>
                <td>{v.id}</td>
                <td>{v.chapa}</td>
                <td>{v.marca} {v.modelo}</td>
                <td>{v.capacidad} kg</td>
                <td>{v.vencimiento_seguro}</td>
                <td>{v.vencimiento_habilitacion}</td>
                <td><span className={`status-badge ${v.estado === 'disponible' ? 'entregado' : 'asignado'}`}>{v.estado}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Nuevo Vehículo</h2>
              <button onClick={() => setShowModal(false)} style={{background:'none',border:'none',cursor:'pointer'}}><X/></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Chapa</label>
                <input name="chapa" required value={formData.chapa} onChange={e => setFormData({...formData, chapa: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Marca</label>
                <input name="marca" required value={formData.marca} onChange={e => setFormData({...formData, marca: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Modelo</label>
                <input name="modelo" required value={formData.modelo} onChange={e => setFormData({...formData, modelo: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Capacidad (kg)</label>
                <input name="capacidad" type="number" required value={formData.capacidad} onChange={e => setFormData({...formData, capacidad: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Vencimiento de Seguro</label>
                <input name="vencimiento_seguro" type="date" value={formData.vencimiento_seguro} onChange={e => setFormData({...formData, vencimiento_seguro: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Vencimiento de Habilitación</label>
                <input name="vencimiento_habilitacion" type="date" value={formData.vencimiento_habilitacion} onChange={e => setFormData({...formData, vencimiento_habilitacion: e.target.value})} />
              </div>
              <button type="submit" className="btn btn-primary">Guardar</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
