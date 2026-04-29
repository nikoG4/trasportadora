import { useState, type FormEvent } from 'react';
import { Loader2 } from 'lucide-react';

type RegisterFormProps = {
  onSuccess: (data: any) => void;
};

export default function RegisterForm({ onSuccess }: RegisterFormProps) {
  const [formData, setFormData] = useState({
    nombre_empresa: '',
    ruc: '',
    email_admin: '',
    password_admin: '',
    confirm_password: '',
    dominio_personalizado: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const updateField = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError('');
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/public/register-tenant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          dominio_personalizado: formData.dominio_personalizado || undefined
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No se pudo registrar la empresa');
      onSuccess(data);
    } catch (err: any) {
      setError(err.message || 'No se pudo registrar la empresa');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Empresa</label>
        <input className="w-full px-4 py-3 border border-gray-300 rounded-lg" required value={formData.nombre_empresa} onChange={e => updateField('nombre_empresa', e.target.value)} />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">RUC</label>
        <input className="w-full px-4 py-3 border border-gray-300 rounded-lg" value={formData.ruc} onChange={e => updateField('ruc', e.target.value)} placeholder="80012345-6" />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Email administrador</label>
        <input className="w-full px-4 py-3 border border-gray-300 rounded-lg" type="email" required value={formData.email_admin} onChange={e => updateField('email_admin', e.target.value.toLowerCase())} />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Contrasena</label>
        <input className="w-full px-4 py-3 border border-gray-300 rounded-lg" type="password" required minLength={8} value={formData.password_admin} onChange={e => updateField('password_admin', e.target.value)} />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Confirmar contrasena</label>
        <input className="w-full px-4 py-3 border border-gray-300 rounded-lg" type="password" required minLength={8} value={formData.confirm_password} onChange={e => updateField('confirm_password', e.target.value)} />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Dominio personalizado</label>
        <input className="w-full px-4 py-3 border border-gray-300 rounded-lg" value={formData.dominio_personalizado} onChange={e => updateField('dominio_personalizado', e.target.value.toLowerCase())} placeholder="empresa.transposaas.com" />
      </div>

      <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
        {loading && <Loader2 className="animate-spin" size={20} />}
        Crear cuenta
      </button>
    </form>
  );
}
