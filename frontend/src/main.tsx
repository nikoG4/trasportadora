import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

const nativeFetch = window.fetch.bind(window);
window.fetch = (input, init = {}) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  const token = localStorage.getItem('adminToken');

  if (token && url.startsWith('/api/') && !url.startsWith('/api/login') && !url.startsWith('/api/public/')) {
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${token}`);
    init = { ...init, headers };
  }

  return nativeFetch(input, init);
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
