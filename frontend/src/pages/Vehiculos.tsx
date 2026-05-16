import { useEffect, useState, type FormEvent } from 'react';
import { Edit, Plus, X } from 'lucide-react';

const emptyForm = {
  chapa: '',
  marca: '',
  modelo: '',
  capacidad: '',
  vencimiento_seguro: '',
  vencimiento_habilitacion: '',
  estado: 'disponible',
  capacidad_m3: '',
  costo_km: '',
  consumo_estimado: '',
  tipo_carga_soportada: ''
};

export default function Vehiculos() {
  const [vehiculos, setVehiculos] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState(emptyForm);

  useEffect(() => {
    loadVehiculos();
  }, []);

  const loadVehiculos = () => {
    fetch('/api/vehiculos')
      .then(res => res.json())
      .then(data => setVehiculos(data))
      .catch(console.error);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
  };

  const openNew = () => {
    setEditingId(null);
    setFormData(emptyForm);
    setShowModal(true);
  };

  const openEdit = (vehiculo: any) => {
    setEditingId(vehiculo.id);
    setFormData({
      chapa: vehiculo.chapa || '',
      marca: vehiculo.marca || '',
      modelo: vehiculo.modelo || '',
      capacidad: vehiculo.capacidad ?? '',
      vencimiento_seguro: vehiculo.vencimiento_seguro || '',
      vencimiento_habilitacion: vehiculo.vencimiento_habilitacion || '',
      estado: vehiculo.estado || 'disponible',
      capacidad_m3: vehiculo.capacidad_m3 ?? '',
      costo_km: vehiculo.costo_km ?? '',
      consumo_estimado: vehiculo.consumo_estimado ?? '',
      tipo_carga_soportada: vehiculo.tipo_carga_soportada || ''
    });
    setShowModal(true);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    fetch(editingId ? `/api/vehiculos/${editingId}` : '/api/vehiculos', {
      method: editingId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    }).then(() => {
      closeModal();
      loadVehiculos();
    });
  };

  return (
    <div>
      <div className="page-header">
        <h1>Gestion de Flota</h1>
        <button className="btn btn-primary" onClick={openNew}>
          <Plus size={20} /> Nuevo Vehiculo
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
              <th>Venc. Habilitacion</th>
              <th>Estado</th>
              <th>Acciones</th>
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
                <td><button className="btn btn-outline" onClick={() => openEdit(v)}><Edit size={16} /> Editar</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>{editingId ? 'Editar Vehiculo' : 'Nuevo Vehiculo'}</h2>
              <button onClick={closeModal} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Chapa</label>
                <input name="chapa" required value={formData.chapa} onChange={e => setFormData({ ...formData, chapa: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Marca</label>
                <input name="marca" required value={formData.marca} onChange={e => setFormData({ ...formData, marca: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Modelo</label>
                <input name="modelo" required value={formData.modelo} onChange={e => setFormData({ ...formData, modelo: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Capacidad kg</label>
                <input name="capacidad" type="number" required value={formData.capacidad} onChange={e => setFormData({ ...formData, capacidad: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Capacidad m3</label>
                <input name="capacidad_m3" type="number" value={formData.capacidad_m3} onChange={e => setFormData({ ...formData, capacidad_m3: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Estado</label>
                <select name="estado" value={formData.estado} onChange={e => setFormData({ ...formData, estado: e.target.value })}>
                  <option value="disponible">Disponible</option>
                  <option value="en_viaje">En viaje</option>
                  <option value="mantenimiento">Mantenimiento</option>
                  <option value="fuera_de_servicio">Fuera de servicio</option>
                </select>
              </div>
              <div className="form-group">
                <label>Vencimiento de Seguro</label>
                <input name="vencimiento_seguro" type="date" value={formData.vencimiento_seguro} onChange={e => setFormData({ ...formData, vencimiento_seguro: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Vencimiento de Habilitacion</label>
                <input name="vencimiento_habilitacion" type="date" value={formData.vencimiento_habilitacion} onChange={e => setFormData({ ...formData, vencimiento_habilitacion: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Costo por km</label>
                <input name="costo_km" type="number" value={formData.costo_km} onChange={e => setFormData({ ...formData, costo_km: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Consumo estimado</label>
                <input name="consumo_estimado" type="number" value={formData.consumo_estimado} onChange={e => setFormData({ ...formData, consumo_estimado: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Tipo de carga soportada</label>
                <input name="tipo_carga_soportada" value={formData.tipo_carga_soportada} onChange={e => setFormData({ ...formData, tipo_carga_soportada: e.target.value })} />
              </div>
              <button type="submit" className="btn btn-primary">Guardar</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
