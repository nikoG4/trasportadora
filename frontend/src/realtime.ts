export type RealtimeMessage = {
  event?: string;
  type?: string;
  payload?: any;
  timestamp?: string;
};

function wsBaseUrl() {
  const apiBase = import.meta.env.VITE_API_URL || '/api';
  const base = apiBase.startsWith('http')
    ? apiBase.replace(/\/api\/?$/, '')
    : `${window.location.origin}${apiBase}`.replace(/\/api\/?$/, '');
  return base.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:');
}

export function connectBackofficeRealtime(onMessage: (message: RealtimeMessage) => void) {
  const token = localStorage.getItem('adminToken');
  if (!token) return () => undefined;
  let closed = false;
  let socket: WebSocket | null = null;
  let timer: number | undefined;

  const connect = () => {
    if (closed) return;
    socket = new WebSocket(`${wsBaseUrl()}/ws?client=backoffice&token=${encodeURIComponent(token)}`);
    socket.onmessage = event => {
      try {
        onMessage(JSON.parse(event.data));
      } catch {
        // Mensaje realtime invalido: se ignora para no romper la UI.
      }
    };
    socket.onclose = () => {
      if (!closed) timer = window.setTimeout(connect, 3000);
    };
    socket.onerror = () => socket?.close();
  };

  connect();
  return () => {
    closed = true;
    if (timer) window.clearTimeout(timer);
    socket?.close();
  };
}
