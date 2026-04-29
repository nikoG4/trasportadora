import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { CheckCircle, ArrowRight, Truck, Mail, Lock, Building2, Copy, Check } from 'lucide-react';

export default function RegisterSuccess() {
  const navigate = useNavigate();
  const location = useLocation();
  const [registrationData, setRegistrationData] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Get registration data from location state
    if (location.state) {
      setRegistrationData(location.state);
    } else {
      // If no data, redirect to register
      navigate('/register');
    }
  }, [location.state, navigate]);

  const handleCopyCredentials = () => {
    if (registrationData?.credentials) {
      const text = `Email: ${registrationData.credentials.email}\nPassword: ${registrationData.credentials.password}`;
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleGoToSystem = () => {
    window.location.href = '/';
  };

  if (!registrationData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-white">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-blue-600 font-bold text-xl">
              <Truck size={28} />
              <span>TranspoSaaS</span>
            </div>
            <button
              onClick={() => navigate('/')}
              className="text-gray-600 hover:text-blue-600 transition-colors"
            >
              Volver al Inicio
            </button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-12">
        <div className="max-w-3xl mx-auto">
          {/* Success Message */}
          <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="text-green-600" size={40} />
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                ¡Registro Exitoso!
              </h1>
              <p className="text-gray-600">
                Tu transportadora ha sido creada exitosamente
              </p>
            </div>

            {/* Tenant Information */}
            <div className="bg-blue-50 rounded-xl p-6 mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Building2 className="text-blue-600" size={20} />
                Información de tu Empresa
              </h2>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Nombre:</span>
                  <span className="font-medium">{registrationData.tenant.nombre}</span>
                </div>
                {registrationData.tenant.ruc && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">RUC:</span>
                    <span className="font-medium">{registrationData.tenant.ruc}</span>
                  </div>
                )}
                {registrationData.tenant.dominio && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Dominio:</span>
                    <span className="font-medium">{registrationData.tenant.dominio}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-600">Plan:</span>
                  <span className="font-medium capitalize">{registrationData.tenant.plan}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Estado:</span>
                  <span className="font-medium capitalize text-green-600">
                    {registrationData.tenant.estado}
                  </span>
                </div>
              </div>
            </div>

            {/* Credentials */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Lock className="text-yellow-600" size={20} />
                Tus Credenciales de Acceso
              </h2>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Email:</span>
                  <span className="font-medium">{registrationData.credentials.email}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Contraseña:</span>
                  <span className="font-medium">••••••••</span>
                </div>
              </div>
              <button
                onClick={handleCopyCredentials}
                className="mt-4 w-full bg-yellow-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-yellow-700 transition-colors flex items-center justify-center gap-2"
              >
                {copied ? (
                  <>
                    <Check size={20} />
                    Copiado
                  </>
                ) : (
                  <>
                    <Copy size={20} />
                    Copiar Credenciales
                  </>
                )}
              </button>
              <p className="mt-2 text-xs text-yellow-700 text-center">
                ⚠️ Guarda estas credenciales en un lugar seguro. No las compartas con nadie.
              </p>
            </div>

            {/* Next Steps */}
            <div className="bg-gray-50 rounded-xl p-6 mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Próximos Pasos
              </h2>
              <ul className="space-y-3">
                {registrationData.next_steps?.map((step: string, index: number) => (
                  <li key={index} className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                      {index + 1}
                    </div>
                    <span className="text-gray-700">{step}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* CTA Button */}
            <button
              onClick={handleGoToSystem}
              className="w-full bg-blue-600 text-white py-4 px-6 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 text-lg"
            >
              Ir al Sistema
              <ArrowRight size={24} />
            </button>
          </div>

          {/* Additional Information */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl p-6 shadow-md text-center">
              <Mail className="text-blue-600 mx-auto mb-3" size={32} />
              <h3 className="font-semibold text-gray-900 mb-2">
                Revisa tu Email
              </h3>
              <p className="text-sm text-gray-600">
                Hemos enviado un email de confirmación a tu dirección
              </p>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-md text-center">
              <Truck className="text-blue-600 mx-auto mb-3" size={32} />
              <h3 className="font-semibold text-gray-900 mb-2">
                Sistema Listo
              </h3>
              <p className="text-sm text-gray-600">
                Tu transportadora ya está configurada y lista para usar
              </p>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-md text-center">
              <CheckCircle className="text-blue-600 mx-auto mb-3" size={32} />
              <h3 className="font-semibold text-gray-900 mb-2">
                Soporte Disponible
              </h3>
              <p className="text-sm text-gray-600">
                Nuestro equipo está listo para ayudarte cuando lo necesites
              </p>
            </div>
          </div>

          {/* Help Section */}
          <div className="mt-8 bg-white rounded-xl p-6 shadow-md">
            <h3 className="font-semibold text-gray-900 mb-3">
              ¿Necesitas Ayuda?
            </h3>
            <p className="text-gray-600 mb-4">
              Si tienes alguna pregunta o problema, no dudes en contactarnos:
            </p>
            <div className="space-y-2">
              <a href="mailto:soporte@transposaas.com" className="text-blue-600 hover:text-blue-700 flex items-center gap-2">
                <Mail size={16} />
                soporte@transposaas.com
              </a>
              <a href="tel:+595981000000" className="text-blue-600 hover:text-blue-700 flex items-center gap-2">
                📞 +595 981 000 000
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
