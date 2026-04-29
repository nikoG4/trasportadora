import { useNavigate } from 'react-router-dom';
import { Truck, CheckCircle, ArrowLeft, Shield, Clock, HeadphonesIcon, Zap } from 'lucide-react';
import RegisterForm from '../components/RegisterForm';

export default function Register() {
  const navigate = useNavigate();

  const handleRegistrationSuccess = (data: any) => {
    navigate('/register/success', { state: data });
  };

  const handleBack = () => {
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-gray-600 hover:text-blue-600 transition-colors"
          >
            <ArrowLeft size={20} />
            <span>Volver al Inicio</span>
          </button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-12">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Left Column - Form */}
          <div>
            <div className="bg-white rounded-2xl shadow-lg p-8">
              <div className="text-center mb-8">
                <div className="flex items-center justify-center gap-3 mb-4">
                  <Truck className="text-blue-600" size={40} />
                  <h1 className="text-3xl font-bold text-gray-900">
                    Crea tu Transportadora
                  </h1>
                </div>
                <p className="text-gray-600">
                  Regístrate gratis y comienza a gestionar tu flota en minutos
                </p>
              </div>

              <RegisterForm onSuccess={handleRegistrationSuccess} />

              <div className="mt-6 text-center">
                <p className="text-sm text-gray-600">
                  ¿Ya tienes cuenta?{' '}
                  <a
                    href="/"
                    className="text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Inicia Sesión
                  </a>
                </p>
              </div>
            </div>

            {/* Trust Badges */}
            <div className="mt-8 grid grid-cols-3 gap-4">
              <div className="text-center">
                <Shield className="mx-auto text-blue-600 mb-2" size={32} />
                <p className="text-xs text-gray-600">Datos Seguros</p>
              </div>
              <div className="text-center">
                <Clock className="mx-auto text-blue-600 mb-2" size={32} />
                <p className="text-xs text-gray-600">Activo 24/7</p>
              </div>
              <div className="text-center">
                <HeadphonesIcon className="mx-auto text-blue-600 mb-2" size={32} />
                <p className="text-xs text-gray-600">Soporte Local</p>
              </div>
            </div>
          </div>

          {/* Right Column - Benefits */}
          <div className="space-y-6">
            <div className="bg-blue-600 rounded-2xl p-8 text-white">
              <h2 className="text-2xl font-bold mb-4">
                ¿Por qué elegir TranspoSaaS?
              </h2>
              <p className="text-blue-100 mb-6">
                La plataforma más completa para transportadoras en Paraguay
              </p>

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <CheckCircle className="flex-shrink-0 mt-1" size={20} />
                  <div>
                    <h3 className="font-semibold">Sin costos de instalación</h3>
                    <p className="text-sm text-blue-100">
                      Comienza gratis, solo paga cuando crezcas
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <CheckCircle className="flex-shrink-0 mt-1" size={20} />
                  <div>
                    <h3 className="font-semibold">Activo en minutos</h3>
                    <p className="text-sm text-blue-100">
                      Sin configuración técnica compleja
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <CheckCircle className="flex-shrink-0 mt-1" size={20} />
                  <div>
                    <h3 className="font-semibold">Soporte en español</h3>
                    <p className="text-sm text-blue-100">
                      Equipo local disponible para ayudarte
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <CheckCircle className="flex-shrink-0 mt-1" size={20} />
                  <div>
                    <h3 className="font-semibold">Actualizaciones automáticas</h3>
                    <p className="text-sm text-blue-100">
                      Siempre con las últimas funcionalidades
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Features Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-xl p-6 shadow-md">
                <Zap className="text-blue-600 mb-3" size={32} />
                <h3 className="font-semibold text-gray-900 mb-2">
                  Rápido de Implementar
                </h3>
                <p className="text-sm text-gray-600">
                  Tu sistema listo en menos de 24 horas
                </p>
              </div>

              <div className="bg-white rounded-xl p-6 shadow-md">
                <Shield className="text-blue-600 mb-3" size={32} />
                <h3 className="font-semibold text-gray-900 mb-2">
                  100% Seguro
                </h3>
                <p className="text-sm text-gray-600">
                  Tus datos protegidos con encriptación
                </p>
              </div>

              <div className="bg-white rounded-xl p-6 shadow-md">
                <Clock className="text-blue-600 mb-3" size={32} />
                <h3 className="font-semibold text-gray-900 mb-2">
                  Disponible 24/7
                </h3>
                <p className="text-sm text-gray-600">
                  Acceso a tu sistema cuando lo necesites
                </p>
              </div>

              <div className="bg-white rounded-xl p-6 shadow-md">
                <HeadphonesIcon className="text-blue-600 mb-3" size={32} />
                <h3 className="font-semibold text-gray-900 mb-2">
                  Soporte Dedicado
                </h3>
                <p className="text-sm text-gray-600">
                  Ayuda personalizada cuando la necesites
                </p>
              </div>
            </div>

            {/* Testimonial */}
            <div className="bg-white rounded-xl p-6 shadow-md">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-blue-600 font-bold">JP</span>
                  </div>
                </div>
                <div>
                  <p className="text-gray-700 italic mb-2">
                    "Implementamos TranspoSaaS en nuestra transportadora y redujimos los tiempos de gestión en un 60%. ¡Increíble!"
                  </p>
                  <p className="text-sm font-semibold text-gray-900">
                    Juan Pérez
                  </p>
                  <p className="text-xs text-gray-600">
                    Gerente de Operaciones, Transportadora Rápida S.A.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
