import { useState, type FormEvent } from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { Truck, Map, Users, Package, FileText, Home, Car, BarChart2, Settings, Shield, Building, DollarSign, Wallet, CreditCard, TrendingUp, UserCog, Wrench } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import Vehiculos from './pages/Vehiculos';
import Choferes from './pages/Choferes';
import Clientes from './pages/Clientes';
import Pedidos from './pages/Pedidos';
import Viajes from './pages/Viajes';
import Mapa from './pages/Mapa';
import Reportes from './pages/Reportes';
import Configuracion from './pages/Configuracion';
import Usuarios from './pages/Usuarios';
import Sucursales from './pages/Sucursales';
import Caja from './pages/Caja';
import Viaticos from './pages/Viaticos';
import CuentasCorrientes from './pages/CuentasCorrientes';
import Ingresos from './pages/Ingresos';
import RRHH from './pages/RRHH';
import GestionIntegral from './pages/GestionIntegral';
import Auditoria from './pages/Auditoria';
import './index.css';

function Sidebar({ role, onLogout }: { role: string, onLogout: () => void }) {
  const tenantName = localStorage.getItem('tenantName') || 'Empresa Demo';
  return (
    <div className="sidebar">
      <div className="sidebar-header" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <div><Truck className="inline-block mr-2" /> Transportadora</div>
        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#111827' }}>{tenantName}</div>
        <div style={{ fontSize: '0.75rem', fontWeight: 'normal', color: '#6b7280' }}>Rol: {role.toUpperCase()}</div>
      </div>
      <ul className="nav-links" style={{ flex: 1, overflowY: 'auto' }}>
        <li><NavLink to="/" className={({isActive}) => isActive ? 'nav-link active' : 'nav-link'}><Home size={20}/> Dashboard</NavLink></li>
        
        <div style={{ height: '1px', background: '#e5e7eb', margin: '1rem 0' }}></div>
        <li style={{ padding: '0 1.5rem', fontSize: '0.75rem', color: '#6b7280', fontWeight: 'bold', marginBottom: '0.5rem' }}>OPERACIONES</li>
        <li><NavLink to="/pedidos" className={({isActive}) => isActive ? 'nav-link active' : 'nav-link'}><Package size={20}/> Pedidos</NavLink></li>
        <li><NavLink to="/viajes" className={({isActive}) => isActive ? 'nav-link active' : 'nav-link'}><Map size={20}/> Viajes</NavLink></li>
        <li><NavLink to="/mapa" className={({isActive}) => isActive ? 'nav-link active' : 'nav-link'}><Map size={20}/> Monitoreo GPS</NavLink></li>
        <li><NavLink to="/gestion-integral" className={({isActive}) => isActive ? 'nav-link active' : 'nav-link'}><Wrench size={20}/> Gestion Integral</NavLink></li>
        
        <div style={{ height: '1px', background: '#e5e7eb', margin: '1rem 0' }}></div>
        <li style={{ padding: '0 1.5rem', fontSize: '0.75rem', color: '#6b7280', fontWeight: 'bold', marginBottom: '0.5rem' }}>FINANZAS Y CAJA</li>
        <li><NavLink to="/caja" className={({isActive}) => isActive ? 'nav-link active' : 'nav-link'}><DollarSign size={20}/> Caja del Día</NavLink></li>
        <li><NavLink to="/viaticos" className={({isActive}) => isActive ? 'nav-link active' : 'nav-link'}><Wallet size={20}/> Viáticos y Rendición</NavLink></li>
        <li><NavLink to="/cuentas-corrientes" className={({isActive}) => isActive ? 'nav-link active' : 'nav-link'}><CreditCard size={20}/> Cuentas Corrientes</NavLink></li>
        <li><NavLink to="/ingresos" className={({isActive}) => isActive ? 'nav-link active' : 'nav-link'}><TrendingUp size={20}/> Ingresos y Facturación</NavLink></li>

        <div style={{ height: '1px', background: '#e5e7eb', margin: '1rem 0' }}></div>
        <li style={{ padding: '0 1.5rem', fontSize: '0.75rem', color: '#6b7280', fontWeight: 'bold', marginBottom: '0.5rem' }}>CATÁLOGOS</li>
        <li><NavLink to="/clientes" className={({isActive}) => isActive ? 'nav-link active' : 'nav-link'}><Users size={20}/> Clientes</NavLink></li>
        <li><NavLink to="/vehiculos" className={({isActive}) => isActive ? 'nav-link active' : 'nav-link'}><Car size={20}/> Flota</NavLink></li>
        <li><NavLink to="/choferes" className={({isActive}) => isActive ? 'nav-link active' : 'nav-link'}><FileText size={20}/> Choferes</NavLink></li>
        <li><NavLink to="/sucursales" className={({isActive}) => isActive ? 'nav-link active' : 'nav-link'}><Building size={20}/> Sucursales</NavLink></li>
        <li><NavLink to="/rrhh" className={({isActive}) => isActive ? 'nav-link active' : 'nav-link'}><UserCog size={20}/> RRHH</NavLink></li>
        
        {/* Admin Only Links */}
        {['admin', 'superadmin_saas', 'admin_empresa'].includes(role) && (
          <>
            <div style={{ height: '1px', background: '#e5e7eb', margin: '1rem 0' }}></div>
            <li style={{ padding: '0 1.5rem', fontSize: '0.75rem', color: '#6b7280', fontWeight: 'bold', marginBottom: '0.5rem' }}>ADMINISTRACIÓN</li>
            <li><NavLink to="/reportes" className={({isActive}) => isActive ? 'nav-link active' : 'nav-link'}><BarChart2 size={20}/> Reportes Financieros</NavLink></li>
            <li><NavLink to="/usuarios" className={({isActive}) => isActive ? 'nav-link active' : 'nav-link'}><Shield size={20}/> Usuarios y Roles</NavLink></li>
            <li><NavLink to="/auditoria" className={({isActive}) => isActive ? 'nav-link active' : 'nav-link'}><Shield size={20}/> Auditoria</NavLink></li>
            <li><NavLink to="/configuracion" className={({isActive}) => isActive ? 'nav-link active' : 'nav-link'}><Settings size={20}/> SaaS Config</NavLink></li>
          </>
        )}
      </ul>
      <div style={{ padding: '1.5rem', borderTop: '1px solid #e5e7eb' }}>
        <button className="btn btn-outline" style={{ width: '100%', justifyContent: 'center' }} onClick={onLogout}>Cerrar Sesión</button>
      </div>
    </div>
  );
}

function LoginScreen({ onLogin }: { onLogin: (token: string, role: string, tenantName?: string, refreshToken?: string) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    })
    .then(res => res.json())
    .then(data => {
      if (data.token) {
        onLogin(data.token, data.role, data.tenant?.nombre, data.refreshToken);
      } else {
        setError(data.error || 'Error de autenticación');
      }
    })
    .catch(() => setError('Error de conexión con el servidor'));
  };

  return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: '#f3f4f6' }}>
      <div className="stat-card" style={{ width: '100%', maxWidth: '400px' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <Truck size={48} style={{ color: '#2563eb', margin: '0 auto' }} />
          <h2 style={{ marginTop: '1rem', fontSize: '1.5rem' }}>Transportadora SaaS</h2>
          <p style={{ color: '#6b7280' }}>Inicia sesión en tu panel operativo</p>
        </div>
        
        {error && <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '0.75rem', borderRadius: '0.375rem', marginBottom: '1rem', textAlign: 'center' }}>{error}</div>}
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Usuario</label>
            <input required value={username} onChange={e => setUsername(e.target.value)} placeholder="Ej: admin" />
          </div>
          <div className="form-group">
            <label>Contraseña</label>
            <input required type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
          </div>
          <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} type="submit">Ingresar</button>
        </form>
      </div>
    </div>
  );
}

function App() {
  const [token, setToken] = useState(localStorage.getItem('adminToken'));
  const [role, setRole] = useState(localStorage.getItem('adminRole'));

  const handleLogin = (newToken: string, newRole: string, tenantName?: string, refreshToken?: string) => {
    localStorage.setItem('adminToken', newToken);
    localStorage.setItem('adminRole', newRole);
    if (tenantName) localStorage.setItem('tenantName', tenantName);
    if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
    setToken(newToken);
    setRole(newRole);
  };

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminRole');
    localStorage.removeItem('tenantName');
    localStorage.removeItem('refreshToken');
    setToken(null);
    setRole(null);
  };

  if (!token || !role) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <BrowserRouter>
      <div className="layout">
        <Sidebar role={role} onLogout={handleLogout} />
        <div className="content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/pedidos" element={<Pedidos />} />
            <Route path="/viajes" element={<Viajes />} />
            <Route path="/caja" element={<Caja />} />
            <Route path="/viaticos" element={<Viaticos />} />
            <Route path="/cuentas-corrientes" element={<CuentasCorrientes />} />
            <Route path="/ingresos" element={<Ingresos />} />
            <Route path="/mapa" element={<Mapa />} />
            <Route path="/gestion-integral" element={<GestionIntegral />} />
            <Route path="/clientes" element={<Clientes />} />
            <Route path="/vehiculos" element={<Vehiculos />} />
            <Route path="/choferes" element={<Choferes />} />
            <Route path="/sucursales" element={<Sucursales />} />
            <Route path="/rrhh" element={<RRHH />} />
            
            {/* Rutas protegidas para Administradores */}
            {['admin', 'superadmin_saas', 'admin_empresa'].includes(role) && (
              <>
                <Route path="/reportes" element={<Reportes />} />
                <Route path="/usuarios" element={<Usuarios />} />
                <Route path="/auditoria" element={<Auditoria />} />
                <Route path="/configuracion" element={<Configuracion />} />
              </>
            )}
            
            {/* Si un operador intenta entrar a algo prohibido, vuelve al Dashboard */}
            <Route path="*" element={<Dashboard />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}

export default App;
