import { test, expect, type Page } from '@playwright/test';

const localSummary = {
  id: 201,
  estado: 'ASIGNADO',
  zona: 'Centro',
  ciudad: 'Asuncion',
  vehiculo_chapa: 'TST-001',
  total_paradas: 2,
  completadas: 0
};

const localDetail = {
  viaje: {
    id: 201,
    estado: 'ASIGNADO',
    zona: 'Centro',
    ciudad: 'Asuncion',
    vehiculo_id: 1,
    vehiculo_chapa: 'TST-001'
  },
  avance: { total: 2, completadas: 0 },
  paradas: [
    {
      id: 1,
      viaje_id: 201,
      orden: 1,
      tipo_parada: 'RETIRO',
      estado: 'PENDIENTE',
      nombre_contacto: 'Cliente Retiro',
      telefono_contacto: '0981000001',
      direccion: 'Av. Test 123',
      latitud: -25.3001,
      longitud: -57.6001,
      pedido: { numero_guia: 'LOC-001', cantidad_bultos: 1, tipo_carga: 'Caja' }
    },
    {
      id: 2,
      viaje_id: 201,
      orden: 2,
      tipo_parada: 'SUCURSAL_RETORNO',
      estado: 'PENDIENTE',
      nombre_contacto: 'Sucursal Base',
      direccion: 'Base Operativa',
      latitud: -25.2865,
      longitud: -57.6363
    }
  ]
};

const interurbanTrip = {
  id: 301,
  estado: 'en_curso',
  vehiculo_id: 1,
  vehiculo_chapa: 'INT-001',
  fecha_inicio: '2026-05-05T08:00:00',
  sucursal_origen_nombre: 'Asuncion Base',
  sucursal_origen_direccion: 'Base Asuncion',
  sucursal_origen_latitud: -25.2865,
  sucursal_origen_longitud: -57.6363,
  sucursal_destino_nombre: 'Ciudad del Este',
  sucursal_destino_direccion: 'Base CDE',
  sucursal_destino_latitud: -25.5167,
  sucursal_destino_longitud: -54.6167,
  pedidos: [
    {
      id: 55,
      numero_guia: 'INT-001',
      estado: 'asignado',
      remitente_nombre: 'Remitente',
      remitente_direccion: 'Origen cliente',
      latitud_retiro: -25.3001,
      longitud_retiro: -57.6001,
      destinatario_nombre: 'Destinatario',
      destinatario_direccion: 'Destino cliente',
      latitud_entrega: -25.516,
      longitud_entrega: -54.615,
      tipo_carga: 'Caja',
      cantidad_bultos: 1
    }
  ]
};

async function seedSession(page: Page) {
  await page.addInitScript(() => {
    (window as any).__openedUrls = [];
    window.open = ((url?: string | URL) => {
      (window as any).__openedUrls.push(String(url || ''));
      return { closed: false, close: () => undefined } as Window;
    }) as typeof window.open;
    localStorage.setItem('choferId', '1');
    localStorage.setItem('choferNombre', 'Chofer Test');
    localStorage.setItem('choferToken', 'token-test');
    localStorage.setItem('choferRefreshToken', 'refresh-test');
    localStorage.setItem('choferApiUrl', '/api');
  });
}

async function openedUrls(page: Page) {
  return page.evaluate(() => (window as any).__openedUrls as string[]);
}

async function mockCommonApi(page: Page) {
  await page.route('**/api/configuracion', route => route.fulfill({ json: [] }));
  await page.route('**/api/header-template', route => route.fulfill({
    json: { name: 'Membrete test', paperWidthDefault: 58, blocks: [] }
  }));
  await page.route('**/api/tracking', route => route.fulfill({ json: { success: true } }));
}

test.describe('App chofer - navegacion de rutas', () => {
  test('abre la ruta completa y cada punto de reparto local en mapas externos', async ({ page }) => {
    await seedSession(page);
    await mockCommonApi(page);
    await page.route('**/api/viajes/chofer/1', route => route.fulfill({ json: [] }));
    await page.route('**/api/chofer/repartos', route => route.fulfill({ json: [localSummary] }));
    await page.route('**/api/chofer/repartos/201', route => route.fulfill({ json: localDetail }));

    await page.goto('/');
    await expect(page.getByText('Repartos locales', { exact: true })).toBeVisible();
    await expect(page.getByText('Membrete y prueba')).toHaveCount(0);
    await page.locator('.header button').first().click();
    await expect(page.getByText('Membrete y prueba')).toBeVisible();
    await page.getByRole('button', { name: /Volver/i }).click();
    await page.getByRole('button', { name: /Abrir reparto/i }).click();
    await expect(page.getByText(/Siguiente parada/i)).toBeVisible();
    await expect(page.getByText('Puntos a visitar')).toBeVisible();
    await expect(page.getByText('2/2 paradas con coordenadas')).toBeVisible();

    await page.getByRole('button', { name: /Abrir ruta completa en Maps/i }).click();
    const routeUrl = (await openedUrls(page)).at(-1) || '';
    expect(routeUrl).toContain('google.com/maps/dir');
    expect(decodeURIComponent(routeUrl)).toContain('-25.3001,-57.6001');
    expect(decodeURIComponent(routeUrl)).toContain('-25.2865,-57.6363');

    await page.getByRole('button', { name: /^Maps$/ }).first().click();
    const pointUrl = (await openedUrls(page)).at(-1) || '';
    expect(pointUrl).toContain('google.com/maps/dir');
    expect(decodeURIComponent(pointUrl)).toContain('destination=-25.3001,-57.6001');
  });

  test('abre ruta y puntos de viaje interurbano en Google Maps y Waze', async ({ page }) => {
    await seedSession(page);
    await mockCommonApi(page);
    await page.route('**/api/viajes/chofer/1', route => route.fulfill({ json: [interurbanTrip] }));
    await page.route('**/api/chofer/repartos', route => route.fulfill({ json: [] }));

    await page.goto('/');
    await expect(page.getByText('Ruta interurbana')).toBeVisible();
    await expect(page.getByText('4/4 puntos con coordenadas')).toBeVisible();

    await page.getByRole('button', { name: /Abrir ruta completa en Maps/i }).click();
    const routeUrl = (await openedUrls(page)).at(-1) || '';
    expect(routeUrl).toContain('google.com/maps/dir');
    expect(decodeURIComponent(routeUrl)).toContain('-25.2865,-57.6363');
    expect(decodeURIComponent(routeUrl)).toContain('-25.5167,-54.6167');

    await page.getByRole('button', { name: /^Waze$/ }).first().click();
    const wazeUrl = (await openedUrls(page)).at(-1) || '';
    expect(wazeUrl).toContain('waze.com/ul');
    expect(wazeUrl).toContain('navigate=yes');
  });
});
