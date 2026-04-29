import { test, expect } from '@playwright/test';

test.describe('Admin E2E Flow', () => {
  test('Flujo completo de administración', async ({ page }) => {
    page.on('dialog', dialog => {
      console.log('DIALOG:', dialog.message());
      dialog.accept();
    });

    const uniqueId = Date.now().toString().slice(-6);

    // 1. Login de administrador
    await page.goto('/');
    
    await page.fill('input[placeholder="Ej: admin"]', 'admin');
    await page.locator('input[type="password"]').fill('admin123');
    await page.click('button:has-text("Ingresar")');
    
    await expect(page.getByText('Control Tower (Dashboard)')).toBeVisible();

    // 2. Crear una Sucursal Origen
    await page.getByRole('link', { name: 'Sucursales' }).click();
    await page.getByRole('button', { name: 'Nueva Sucursal' }).click();
    await page.locator('input[name="nombre"]').fill('Sucursal Origen E2E');
    await page.locator('input[name="codigo"]').fill(`SUC-ORG-${uniqueId}`);
    await page.locator('input[name="ciudad"]').fill('Ciudad Origen');
    await page.locator('input[name="direccion"]').fill('Calle Origen 123');
    await page.locator('input[name="telefono"]').fill('123456789');
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.locator('tbody').getByText('Sucursal Origen E2E').first()).toBeVisible();

    // 3. Crear una Sucursal Destino
    await page.getByRole('button', { name: 'Nueva Sucursal' }).click();
    await page.locator('input[name="nombre"]').fill('Sucursal Destino E2E');
    await page.locator('input[name="codigo"]').fill(`SUC-DST-${uniqueId}`);
    await page.locator('input[name="ciudad"]').fill('Ciudad Destino');
    await page.locator('input[name="direccion"]').fill('Calle Destino 456');
    await page.locator('input[name="telefono"]').fill('987654321');
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.locator('tbody').getByText('Sucursal Destino E2E').first()).toBeVisible();

    // 4. Crear un Cliente
    await page.getByRole('link', { name: 'Clientes' }).click();
    await page.getByRole('button', { name: 'Nuevo Cliente' }).click();
    await page.locator('input[name="nombre"]').fill(`Cliente E2E SA ${uniqueId}`);
    await page.locator('input[name="ruc"]').fill(`8000${uniqueId}-3`);
    await page.locator('input[name="direccion"]').fill('Direccion Cliente');
    await page.locator('input[name="telefono"]').fill('098765432');
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.locator('tbody').getByText(`Cliente E2E SA ${uniqueId}`)).toBeVisible();

    // 5. Crear un Vehículo
    await page.getByRole('link', { name: 'Flota' }).click();
    await page.getByRole('button', { name: 'Nuevo Vehículo' }).click();
    await page.locator('input[name="chapa"]').fill(`AAA-${uniqueId}`);
    await page.locator('input[name="marca"]').fill('Toyota');
    await page.locator('input[name="modelo"]').fill('Hilux');
    await page.locator('input[name="capacidad"]').fill('1500');
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.locator('tbody').getByText(`AAA-${uniqueId}`)).toBeVisible();

    // 6. Crear un Chofer
    await page.getByRole('link', { name: 'Choferes' }).click();
    await page.getByRole('button', { name: 'Nuevo Chofer' }).click();
    await page.locator('input[name="nombre"]').fill(`Juan Perez E2E ${uniqueId}`);
    await page.locator('input[name="documento"]').fill(`${uniqueId}00`);
    await page.locator('input[name="licencia"]').fill('Cat B');
    await page.locator('input[name="telefono"]').fill('0981112233');
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.locator('tbody').getByText(`Juan Perez E2E ${uniqueId}`)).toBeVisible();

    // 7. Crear un Pedido
    await page.getByRole('link', { name: 'Pedidos' }).click();
    await page.getByRole('button', { name: 'Nuevo Pedido' }).click();
    
    // Tab Generales
    await page.locator('select[name="cliente_pagador_id"]').selectOption({ label: `Cliente E2E SA ${uniqueId}` });
    await page.locator('input[name="precio"]').fill('150000');
    
    // Tab Sujetos
    await page.getByRole('button', { name: 'Sujetos (Rem. y Dest.)' }).click();
    await page.locator('input[name="remitente_nombre"]').fill('Remitente Test');
    await page.locator('input[name="destinatario_nombre"]').fill('Destinatario Test');
    
    // Tab Logística
    await page.getByRole('button', { name: 'Logística' }).click();
    await page.locator('select[name="sucursal_origen_id"]').selectOption({ label: 'Sucursal Origen E2E' });
    await page.locator('select[name="sucursal_destino_id"]').selectOption({ label: 'Sucursal Destino E2E' });
    
    // Tab Carga
    await page.getByRole('button', { name: 'Carga' }).click();
    await page.locator('input[name="tipo_carga"]').fill('Cajas Test');
    await page.locator('input[name="cantidad_bultos"]').fill('5');
    await page.locator('input[name="peso"]').fill('100');
    
    await page.getByRole('button', { name: 'Guardar Pedido' }).click();
    
    // Wait for the new order to appear in the table body
    await expect(page.locator('tbody').getByText('Sucursal Destino E2E').first()).toBeVisible({ timeout: 5000 });

    // 8. Crear un Viaje y Asignar Pedido
    await page.getByRole('link', { name: 'Viajes' }).click();
    await page.getByRole('button', { name: 'Nuevo Viaje' }).click();
    
    const selects = page.locator('form select');
    await selects.nth(0).selectOption({ label: 'Sucursal Origen E2E' });
    await selects.nth(1).selectOption({ label: 'Sucursal Destino E2E' });
    await selects.nth(2).selectOption({ label: `Juan Perez E2E ${uniqueId}` });
    await selects.nth(3).selectOption({ label: `AAA-${uniqueId} - Toyota` });
    
    await page.locator('input[type="datetime-local"]').fill('2025-01-01T10:00');
    await page.locator('input[type="number"]').fill('500000'); // Costo
    
    // Select the first order checkbox
    const checkbox = page.locator('input[type="checkbox"]').first();
    await checkbox.check();
    
    await page.getByRole('button', { name: 'Crear Viaje' }).click();
    await page.waitForTimeout(500);

    // The trip should be created
    await expect(page.locator('tbody').getByText(`Juan Perez E2E ${uniqueId}`).first()).toBeVisible();

    // 9. Navegación al Dashboard y Reportes
    await page.getByRole('link', { name: 'Dashboard' }).click();
    await expect(page.getByText('Control Tower (Dashboard)')).toBeVisible();
  });
});
