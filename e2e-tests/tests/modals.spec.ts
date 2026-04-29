import { test, expect } from '@playwright/test';

test.describe('Modals rendering tests', () => {
  test('Flujo de modales en Caja del Día', async ({ page }) => {
    // Login
    await page.goto('/');
    await page.fill('input[placeholder="Ej: admin"]', 'admin');
    await page.locator('input[type="password"]').fill('admin123');
    await page.click('button:has-text("Ingresar")');
    await expect(page.getByText('Control Tower (Dashboard)')).toBeVisible();

    // Navigate to Caja
    await page.getByRole('link', { name: 'Caja del Día' }).click();

    // The cash register starts closed
    await expect(page.getByText('La caja está cerrada')).toBeVisible();

    // Click 'Abrir Caja Ahora'
    await page.getByRole('button', { name: 'Abrir Caja Ahora' }).click();
    
    // Wait for modal backdrop and content
    await expect(page.locator('.modal-backdrop')).toBeVisible();
    await expect(page.getByText('Confirmar Apertura')).toBeVisible();
    
    // Close the modal
    await page.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.locator('.modal-backdrop')).toBeHidden();
  });
});
