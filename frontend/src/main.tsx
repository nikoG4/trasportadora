import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

const nativeFetch = window.fetch.bind(window);
let refreshPromise: Promise<string | null> | null = null;

function clearSession() {
  localStorage.removeItem('adminToken');
  localStorage.removeItem('adminRole');
  localStorage.removeItem('tenantName');
  localStorage.removeItem('refreshToken');
}

async function refreshAccessToken() {
  if (!refreshPromise) {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) return null;

    refreshPromise = nativeFetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken })
    })
      .then(async response => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.token) {
          clearSession();
          return null;
        }
        localStorage.setItem('adminToken', data.token);
        return data.token as string;
      })
      .catch(() => {
        clearSession();
        return null;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

function withAuthHeader(init: RequestInit = {}, token: string) {
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  return { ...init, headers };
}

window.fetch = async (input, init = {}) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  const token = localStorage.getItem('adminToken');
  const isProtectedApi = url.startsWith('/api/')
    && !url.startsWith('/api/login')
    && !url.startsWith('/api/auth/refresh')
    && !url.startsWith('/api/public/');

  const requestInit = token && isProtectedApi ? withAuthHeader(init, token) : init;
  const response = await nativeFetch(input, requestInit);

  if (response.status === 401 && isProtectedApi) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      return nativeFetch(input, withAuthHeader(init, newToken));
    }

    if (!window.location.pathname.includes('/login')) {
      window.location.reload();
    }
  }

  return response;
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
