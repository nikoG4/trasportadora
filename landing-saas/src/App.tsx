import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { Truck, MapPin, Printer, Camera, ShieldAlert, BarChart3, ChevronRight, UserPlus, LogIn } from 'lucide-react';
import './index.css';
import Register from './pages/Register';
import RegisterSuccess from './pages/RegisterSuccess';
import Login from './pages/Login';

const routerBasename = import.meta.env.BASE_URL === '/' ? undefined : import.meta.env.BASE_URL.replace(/\/$/, '');

function App() {
  return (
    <Router basename={routerBasename}>
      <Routes>
        {/* Landing Page */}
        <Route path="/" element={
          <div>
            {/* Navbar */}
            <nav className="bg-white">
              <div className="container flex justify-between items-center">
                <div className="flex items-center gap-4 text-blue-600 font-bold text-xl">
                  <Truck size={28} /> TranspoSaaS
                </div>
                <div className="flex gap-4">
                  <Link to="/login" className="btn btn-secondary flex items-center gap-2">
                    <LogIn size={18} />
                    Iniciar Sesión
                  </Link>
                  <Link to="/register" className="btn btn-primary flex items-center gap-2">
                    <UserPlus size={18} />
                    Registrarse
                  </Link>
                </div>
              </div>
            </nav>

            {/* Hero Section */}
            <section className="py-24 bg-blue-600 text-white text-center">
              <div className="container flex flex-col items-center">
                <h1 className="text-4xl md:text-6xl font-bold max-w-3xl mb-6">
                  La plataforma definitiva para gestionar tu flota y transportadora.
                </h1>
                <p className="text-xl max-w-2xl mb-8 opacity-90">
                  Controla envíos, monitorea tus vehículos en tiempo real por GPS, gestiona choferes, vencimientos y comprobantes de entrega digitales (POD) desde un solo lugar.
                </p>
                <div className="flex gap-4">
                  <Link to="/register" className="btn btn-white flex items-center gap-2">
                    <UserPlus size={18} />
                    Crear Mi Transportadora Gratis <ChevronRight size={18} />
                  </Link>
                  <Link to="/login" className="btn btn-outline-white flex items-center gap-2">
                    <LogIn size={18} />
                    Iniciar Sesión <ChevronRight size={18} />
                  </Link>
                </div>
              </div>
            </section>

            {/* Features */}
            <section className="py-16 container">
              <div className="text-center mb-16">
                <h2 className="text-4xl font-bold text-blue-600">Todo lo que necesitas, listo para usar</h2>
                <p className="text-gray-600 mt-4 text-xl">Preparado como SaaS para empresas transportadoras modernas.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

                <div className="bg-white p-8 rounded-lg shadow-md text-center">
                  <MapPin size={48} className="text-blue-600 mx-auto mb-4" />
                  <h3 className="font-bold text-xl mb-2">Tracking GPS en Vivo</h3>
                  <p className="text-gray-600">Sigue tus vehículos en el mapa segundo a segundo desde que el chofer inicia su viaje en la App.</p>
                </div>

                <div className="bg-white p-8 rounded-lg shadow-md text-center">
                  <Printer size={48} className="text-blue-600 mx-auto mb-4" />
                  <h3 className="font-bold text-xl mb-2">Impresión Bluetooth</h3>
                  <p className="text-gray-600">Los choferes imprimen comandas o recibos en impresoras térmicas portátiles conectadas por BT al celular.</p>
                </div>

                <div className="bg-white p-8 rounded-lg shadow-md text-center">
                  <Camera size={48} className="text-blue-600 mx-auto mb-4" />
                  <h3 className="font-bold text-xl mb-2">Prueba de Entrega (POD)</h3>
                  <p className="text-gray-600">Los choferes toman fotos al entregar, enviándolas en tiempo real al panel administrativo para trazabilidad total.</p>
                </div>

                <div className="bg-white p-8 rounded-lg shadow-md text-center">
                  <ShieldAlert size={48} className="text-blue-600 mx-auto mb-4" />
                  <h3 className="font-bold text-xl mb-2">Alertas de Vencimientos</h3>
                  <p className="text-gray-600">Notificaciones inteligentes 30 días antes del vencimiento de licencias, seguros y habilitaciones municipales.</p>
                </div>

                <div className="bg-white p-8 rounded-lg shadow-md text-center">
                  <BarChart3 size={48} className="text-blue-600 mx-auto mb-4" />
                  <h3 className="font-bold text-xl mb-2">Control de Combustible</h3>
                  <p className="text-gray-600">Registra las cargas de combustible, kilometraje y costos, obteniendo un reporte detallado del gasto de tu flota.</p>
                </div>

                <div className="bg-white p-8 rounded-lg shadow-md text-center">
                  <Truck size={48} className="text-blue-600 mx-auto mb-4" />
                  <h3 className="font-bold text-xl mb-2">Gestión de Flota & SaaS</h3>
                  <p className="text-gray-600">Define tus precios de viaje, administra clientes y personaliza el membrete de tu empresa al instante.</p>
                </div>

              </div>
            </section>

            {/* CTA */}
            <section className="bg-gray-100 py-16 text-center">
              <div className="container">
                <h2 className="text-3xl font-bold mb-6">¿Listo para llevar tu transportadora al siguiente nivel?</h2>
                <div className="flex gap-4 justify-center">
                  <Link to="/register" className="btn btn-primary flex items-center gap-2">
                    <UserPlus size={18} />
                    Crear Mi Transportadora Gratis
                  </Link>
                  <Link to="/login" className="btn btn-secondary flex items-center gap-2">
                    <LogIn size={18} />
                    Iniciar Sesión
                  </Link>
                </div>
              </div>
            </section>

            {/* Footer */}
            <footer className="bg-white py-8 text-center text-gray-600 border-t border-gray-200">
              <p>&copy; 2026 TranspoSaaS - Desarrollado para Paraguay y la Región.</p>
            </footer>
          </div>
        } />

        {/* Login Page */}
        <Route path="/login" element={<Login />} />

        {/* Register Page */}
        <Route path="/register" element={<Register />} />

        {/* Register Success Page */}
        <Route path="/register/success" element={<RegisterSuccess />} />

        {/* Catch all - redirect to home */}
        <Route path="*" element={<div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Página no encontrada</h1>
            <Link to="/" className="text-blue-600 hover:text-blue-700">Volver al inicio</Link>
          </div>
        </div>} />
      </Routes>
    </Router>
  );
}

export default App;
