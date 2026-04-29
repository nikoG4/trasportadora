import { test, expect } from '@playwright/test';

test.describe('Nuevos modulos integrales', () => {
  test('RRHH y Gestion Integral cargan y permiten altas basicas', async ({ page }) => {
    const uniqueId = Date.now().toString().slice(-6);

    await page.goto('/');
    await page.fill('input[placeholder="Ej: admin"]', 'admin');
    await page.locator('input[type="password"]').fill('admin123');
    await page.click('button:has-text("Ingresar")');
    await expect(page.getByText('Control Tower (Dashboard)')).toBeVisible();

    await page.getByRole('link', { name: 'RRHH' }).click();
    await expect(page.getByRole('heading', { name: 'Recursos Humanos' })).toBeVisible();
    const rrhhForm = page.locator('form').first();
    await rrhhForm.locator('input').nth(0).fill(`Empleado E2E ${uniqueId}`);
    await rrhhForm.locator('input').nth(1).fill(`RRHH-E2E-${uniqueId}`);
    await rrhhForm.locator('input').nth(2).fill('Coordinador E2E');
    await rrhhForm.locator('input').nth(7).fill('4100000');
    await page.getByRole('button', { name: 'Guardar empleado' }).click();
    await expect(page.locator('tbody').getByText(`Empleado E2E ${uniqueId}`).first()).toBeVisible();

    await page.getByRole('link', { name: 'Gestion Integral' }).click();
    await expect(page.getByRole('heading', { name: 'Gestion Integral' })).toBeVisible();
    await page.getByRole('button', { name: 'Proveedores' }).click();
    const proveedorForm = page.locator('form').first();
    await proveedorForm.locator('input').nth(0).fill(`Proveedor E2E ${uniqueId}`);
    await proveedorForm.locator('input').nth(1).fill(`800-E2E-${uniqueId}`);
    await page.getByRole('button', { name: 'Guardar proveedor' }).click();
    await expect(page.locator('tbody').getByText(`Proveedor E2E ${uniqueId}`).first()).toBeVisible();
  });
});
