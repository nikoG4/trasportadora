import { test, expect } from '@playwright/test';

// Test data
const validRegistrationData = {
  nombre_empresa: 'Transportadora Test E2E',
  ruc: '9999999-9',
  email_admin: 'test-e2e@example.com',
  password_admin: 'TestPassword123',
  confirm_password: 'TestPassword123',
  dominio_personalizado: 'test-e2e.transposaas.com'
};

const invalidEmailData = {
  ...validRegistrationData,
  email_admin: 'invalid-email',
  nombre_empresa: 'Transportadora Invalid Email',
  ruc: '8888888-8'
};

const weakPasswordData = {
  ...validRegistrationData,
  password_admin: 'weak',
  confirm_password: 'weak',
  nombre_empresa: 'Transportadora Weak Password',
  email_admin: 'weak@example.com',
  ruc: '7777777-7'
};

const mismatchedPasswordData = {
  ...validRegistrationData,
  confirm_password: 'DifferentPassword123',
  nombre_empresa: 'Transportadora Mismatched Password',
  email_admin: 'mismatch@example.com',
  ruc: '6666666-6'
};

const invalidRucData = {
  ...validRegistrationData,
  ruc: 'invalid-ruc',
  nombre_empresa: 'Transportadora Invalid RUC',
  email_admin: 'invalidruc@example.com'
};

const invalidDomainData = {
  ...validRegistrationData,
  dominio_personalizado: 'invalid-domain',
  nombre_empresa: 'Transportadora Invalid Domain',
  email_admin: 'invaliddomain@example.com',
  ruc: '5555555-5'
};

test.describe('Flujo de Registro - Landing Page', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to landing page
    await page.goto('/');
  });

  test('debería mostrar la landing page correctamente', async ({ page }) => {
    // Check main elements
    await expect(page.locator('text=TranspoSaaS')).toBeVisible();
    await expect(page.locator('text=La plataforma definitiva para gestionar tu flota y transportadora')).toBeVisible();
    await expect(page.locator('text=Tracking GPS en Vivo')).toBeVisible();
    await expect(page.locator('text=Impresión Bluetooth')).toBeVisible();
    await expect(page.locator('text=Prueba de Entrega (POD)')).toBeVisible();
  });

  test('debería tener botón de registrarse en el navbar', async ({ page }) => {
    const registerButton = page.locator('text=Registrarse');
    await expect(registerButton).toBeVisible();
    await expect(registerButton).toHaveAttribute('href', '/register');
  });

  test('debería tener CTAs para registro en hero section', async ({ page }) => {
    const ctaButton = page.locator('text=Crear Mi Transportadora Gratis');
    await expect(ctaButton).toBeVisible();
    await expect(ctaButton).toHaveAttribute('href', '/register');
  });

  test('debería navegar a la página de registro al hacer clic en registrarse', async ({ page }) => {
    await page.click('text=Registrarse');
    await expect(page).toHaveURL('/register');
    await expect(page.locator('text=Crea tu Transportadora')).toBeVisible();
  });
});

test.describe('Formulario de Registro', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/register');
  });

  test('debería mostrar el formulario de registro', async ({ page }) => {
    await expect(page.locator('text=Crea tu Transportadora')).toBeVisible();
    await expect(page.locator('input[placeholder*="Nombre de la empresa"]')).toBeVisible();
    await expect(page.locator('input[placeholder*="admin@empresa.com"]')).toBeVisible();
    await expect(page.locator('input[placeholder*="Mínimo 8 caracteres"]')).toBeVisible();
    await expect(page.locator('button:has-text("Crear Mi Transportadora")')).toBeVisible();
  });

  test('debería validar email inválido', async ({ page }) => {
    await page.fill('input[placeholder*="admin@empresa.com"]', 'invalid-email');
    await page.blur(); // Trigger validation

    const errorMessage = page.locator('text=Formato de email inválido');
    await expect(errorMessage).toBeVisible();
  });

  test('debería validar contraseña muy corta', async ({ page }) => {
    await page.fill('input[placeholder*="Mínimo 8 caracteres"]', 'short');
    await page.blur(); // Trigger validation

    const errorMessage = page.locator('text=La contraseña debe tener al menos 8 caracteres');
    await expect(errorMessage).toBeVisible();
  });

  test('debería validar contraseñas que no coinciden', async ({ page }) => {
    await page.fill('input[placeholder*="Mínimo 8 caracteres"]:first-of-type', 'Password123');
    await page.fill('input[placeholder*="Repite tu contraseña"]', 'DifferentPassword');
    await page.blur(); // Trigger validation

    const errorMessage = page.locator('text=Las contraseñas no coinciden');
    await expect(errorMessage).toBeVisible();
  });

  test('debería validar formato de RUC inválido', async ({ page }) => {
    await page.fill('input[placeholder*="Ej: 1234567-8"]', 'invalid-ruc');
    await page.blur(); // Trigger validation

    const errorMessage = page.locator('text=Formato inválido');
    await expect(errorMessage).toBeVisible();
  });

  test('debería validar formato de dominio inválido', async ({ page }) => {
    await page.fill('input[placeholder*="empresa.transposaas.com"]', 'invalid-domain');
    await page.blur(); // Trigger validation

    const errorMessage = page.locator('text=Formato inválido');
    await expect(errorMessage).toBeVisible();
  });

  test('debería mostrar/ocultar contraseña al hacer clic en el icono de ojo', async ({ page }) => {
    const passwordInput = page.locator('input[placeholder*="Mínimo 8 caracteres"]:first-of-type');
    const eyeIcon = page.locator('button').filter({ hasText: '' }).first();

    // Initially password should be hidden
    await expect(passwordInput).toHaveAttribute('type', 'password');

    // Click to show password
    await eyeIcon.click();
    await expect(passwordInput).toHaveAttribute('type', 'text');

    // Click to hide password
    await eyeIcon.click();
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });
});

test.describe('Flujo Complejo de Registro', () => {
  test('debería completar el registro exitosamente con datos válidos', async ({ page }) => {
    // Navigate to registration page
    await page.goto('/register');

    // Fill in the form
    await page.fill('input[placeholder*="Nombre de la empresa"]', validRegistrationData.nombre_empresa);
    await page.fill('input[placeholder*="Ej: 1234567-8"]', validRegistrationData.ruc);
    await page.fill('input[placeholder*="admin@empresa.com"]', validRegistrationData.email_admin);
    await page.fill('input[placeholder*="Mínimo 8 caracteres"]:first-of-type', validRegistrationData.password_admin);
    await page.fill('input[placeholder*="Repite tu contraseña"]', validRegistrationData.confirm_password);
    await page.fill('input[placeholder*="empresa.transposaas.com"]', validRegistrationData.dominio_personalizado);

    // Submit the form
    await page.click('button:has-text("Crear Mi Transportadora")');

    // Should redirect to success page
    await expect(page).toHaveURL('/register/success');

    // Verify success message
    await expect(page.locator('text=¡Registro Exitoso!')).toBeVisible();
    await expect(page.locator('text=Tu transportadora ha sido creada exitosamente')).toBeVisible();

    // Verify tenant information is displayed
    await expect(page.locator(`text=${validRegistrationData.nombre_empresa}`)).toBeVisible();
    await expect(page.locator(`text=${validRegistrationData.ruc}`)).toBeVisible();
    await expect(page.locator(`text=${validRegistrationData.dominio_personalizado}`)).toBeVisible();

    // Verify credentials are displayed
    await expect(page.locator('text=Tus Credenciales de Acceso')).toBeVisible();
    await expect(page.locator(`text=${validRegistrationData.email_admin}`)).toBeVisible();

    // Verify next steps are shown
    await expect(page.locator('text=Próximos Pasos')).toBeVisible();
    await expect(page.locator('text=Inicia sesión con tus credenciales')).toBeVisible();

    // Verify "Ir al Sistema" button exists
    await expect(page.locator('button:has-text("Ir al Sistema")')).toBeVisible();
  });

  test('debería mostrar error de validación con email inválido', async ({ page }) => {
    await page.goto('/register');

    // Fill form with invalid email
    await page.fill('input[placeholder*="Nombre de la empresa"]', invalidEmailData.nombre_empresa);
    await page.fill('input[placeholder*="Ej: 1234567-8"]', invalidEmailData.ruc);
    await page.fill('input[placeholder*="admin@empresa.com"]', invalidEmailData.email_admin);
    await page.fill('input[placeholder*="Mínimo 8 caracteres"]:first-of-type', invalidEmailData.password_admin);
    await page.fill('input[placeholder*="Repite tu contraseña"]', invalidEmailData.confirm_password);

    // Try to submit
    await page.click('button:has-text("Crear Mi Transportadora")');

    // Should show validation error
    await expect(page.locator('text=Formato de email inválido')).toBeVisible();

    // Should not redirect
    await expect(page).toHaveURL('/register');
  });

  test('debería mostrar error de validación con contraseña débil', async ({ page }) => {
    await page.goto('/register');

    // Fill form with weak password
    await page.fill('input[placeholder*="Nombre de la empresa"]', weakPasswordData.nombre_empresa);
    await page.fill('input[placeholder*="Ej: 1234567-8"]', weakPasswordData.ruc);
    await page.fill('input[placeholder*="admin@empresa.com"]', weakPasswordData.email_admin);
    await page.fill('input[placeholder*="Mínimo 8 caracteres"]:first-of-type', weakPasswordData.password_admin);
    await page.fill('input[placeholder*="Repite tu contraseña"]', weakPasswordData.confirm_password);

    // Try to submit
    await page.click('button:has-text("Crear Mi Transportadora")');

    // Should show validation error
    await expect(page.locator('text=La contraseña debe tener al menos 8 caracteres')).toBeVisible();

    // Should not redirect
    await expect(page).toHaveURL('/register');
  });

  test('debería mostrar error de validación con contraseñas que no coinciden', async ({ page }) => {
    await page.goto('/register');

    // Fill form with mismatched passwords
    await page.fill('input[placeholder*="Nombre de la empresa"]', mismatchedPasswordData.nombre_empresa);
    await page.fill('input[placeholder*="Ej: 1234567-8"]', mismatchedPasswordData.ruc);
    await page.fill('input[placeholder*="admin@empresa.com"]', mismatchedPasswordData.email_admin);
    await page.fill('input[placeholder*="Mínimo 8 caracteres"]:first-of-type', mismatchedPasswordData.password_admin);
    await page.fill('input[placeholder*="Repite tu contraseña"]', mismatchedPasswordData.confirm_password);

    // Try to submit
    await page.click('button:has-text("Crear Mi Transportadora")');

    // Should show validation error
    await expect(page.locator('text=Las contraseñas no coinciden')).toBeVisible();

    // Should not redirect
    await expect(page).toHaveURL('/register');
  });

  test('debería mostrar error de validación con RUC inválido', async ({ page }) => {
    await page.goto('/register');

    // Fill form with invalid RUC
    await page.fill('input[placeholder*="Nombre de la empresa"]', invalidRucData.nombre_empresa);
    await page.fill('input[placeholder*="Ej: 1234567-8"]', invalidRucData.ruc);
    await page.fill('input[placeholder*="admin@empresa.com"]', invalidRucData.email_admin);
    await page.fill('input[placeholder*="Mínimo 8 caracteres"]:first-of-type', invalidRucData.password_admin);
    await page.fill('input[placeholder*="Repite tu contraseña"]', invalidRucData.confirm_password);

    // Try to submit
    await page.click('button:has-text("Crear Mi Transportadora")');

    // Should show validation error
    await expect(page.locator('text=Formato inválido')).toBeVisible();

    // Should not redirect
    await expect(page).toHaveURL('/register');
  });

  test('debería mostrar error de validación con dominio inválido', async ({ page }) => {
    await page.goto('/register');

    // Fill form with invalid domain
    await page.fill('input[placeholder*="Nombre de la empresa"]', invalidDomainData.nombre_empresa);
    await page.fill('input[placeholder*="Ej: 1234567-8"]', invalidDomainData.ruc);
    await page.fill('input[placeholder*="admin@empresa.com"]', invalidDomainData.email_admin);
    await page.fill('input[placeholder*="Mínimo 8 caracteres"]:first-of-type', invalidDomainData.password_admin);
    await page.fill('input[placeholder*="Repite tu contraseña"]', invalidDomainData.confirm_password);
    await page.fill('input[placeholder*="empresa.transposaas.com"]', invalidDomainData.dominio_personalizado);

    // Try to submit
    await page.click('button:has-text("Crear Mi Transportadora")');

    // Should show validation error
    await expect(page.locator('text=Formato inválido')).toBeVisible();

    // Should not redirect
    await expect(page).toHaveURL('/register');
  });

  test('debería mostrar error cuando el email ya está registrado', async ({ page }) => {
    await page.goto('/register');

    // Fill form with existing email (using admin email from seed data)
    await page.fill('input[placeholder*="Nombre de la empresa"]', 'Transportadora Email Existente');
    await page.fill('input[placeholder*="Ej: 1234567-8"]', '1111111-1');
    await page.fill('input[placeholder*="admin@empresa.com"]', 'admin'); // This email already exists
    await page.fill('input[placeholder*="Mínimo 8 caracteres"]:first-of-type', 'Password123');
    await page.fill('input[placeholder*="Repite tu contraseña"]', 'Password123');

    // Try to submit
    await page.click('button:has-text("Crear Mi Transportadora")');

    // Should show error about existing email
    await expect(page.locator('text=El email ya está registrado')).toBeVisible();

    // Should not redirect
    await expect(page).toHaveURL('/register');
  });

  test('debería poder copiar las credenciales en la página de éxito', async ({ page }) => {
    // First complete a successful registration
    await page.goto('/register');

    const uniqueEmail = `test-copy-${Date.now()}@example.com`;
    await page.fill('input[placeholder*="Nombre de la empresa"]', 'Transportadora Copy Test');
    await page.fill('input[placeholder*="Ej: 1234567-8"]', '2222222-2');
    await page.fill('input[placeholder*="admin@empresa.com"]', uniqueEmail);
    await page.fill('input[placeholder*="Mínimo 8 caracteres"]:first-of-type', 'Password123');
    await page.fill('input[placeholder*="Repite tu contraseña"]', 'Password123');

    await page.click('button:has-text("Crear Mi Transportadora")');

    // Wait for success page
    await expect(page).toHaveURL('/register/success');

    // Click copy button
    await page.click('button:has-text("Copiar Credenciales")');

    // Verify button text changes to "Copiado"
    await expect(page.locator('button:has-text("Copiado")')).toBeVisible();
  });

  test('debería navegar de vuelta al inicio desde la página de éxito', async ({ page }) => {
    // Complete registration first
    await page.goto('/register');

    const uniqueEmail = `test-back-${Date.now()}@example.com`;
    await page.fill('input[placeholder*="Nombre de la empresa"]', 'Transportadora Back Test');
    await page.fill('input[placeholder*="Ej: 1234567-8"]', '3333333-3');
    await page.fill('input[placeholder*="admin@empresa.com"]', uniqueEmail);
    await page.fill('input[placeholder*="Mínimo 8 caracteres"]:first-of-type', 'Password123');
    await page.fill('input[placeholder*="Repite tu contraseña"]', 'Password123');

    await page.click('button:has-text("Crear Mi Transportadora")');

    // Wait for success page
    await expect(page).toHaveURL('/register/success');

    // Click back to home
    await page.click('text=Volver al Inicio');

    // Should navigate to home
    await expect(page).toHaveURL('/');
  });

  test('debería mostrar error del servidor cuando hay un problema', async ({ page }) => {
    // This test would require mocking server errors
    // For now, we'll skip this as it requires more setup
    test.skip(true, 'Requires server error mocking setup');
  });
});

test.describe('Página de Éxito de Registro', () => {
  test('debería mostrar información completa del tenant registrado', async ({ page }) => {
    // Complete registration first
    await page.goto('/register');

    const uniqueEmail = `test-success-${Date.now()}@example.com`;
    await page.fill('input[placeholder*="Nombre de la empresa"]', 'Transportadora Success Test');
    await page.fill('input[placeholder*="Ej: 1234567-8"]', '4444444-4');
    await page.fill('input[placeholder*="admin@empresa.com"]', uniqueEmail);
    await page.fill('input[placeholder*="Mínimo 8 caracteres"]:first-of-type', 'Password123');
    await page.fill('input[placeholder*="Repite tu contraseña"]', 'Password123');

    await page.click('button:has-text("Crear Mi Transportadora")');

    // Verify all success page elements
    await expect(page.locator('text=¡Registro Exitoso!')).toBeVisible();
    await expect(page.locator('text=Información de tu Empresa')).toBeVisible();
    await expect(page.locator('text=Tus Credenciales de Acceso')).toBeVisible();
    await expect(page.locator('text=Próximos Pasos')).toBeVisible();
    await expect(page.locator('text=¿Necesitas Ayuda?')).toBeVisible();
  });

  test('debería redirigir a /register si no hay datos de registro', async ({ page }) => {
    // Navigate directly to success page without registration data
    await page.goto('/register/success');

    // Should redirect to register page
    await expect(page).toHaveURL('/register');
  });

  test('debería tener botón funcional para ir al sistema', async ({ page }) => {
    // Complete registration first
    await page.goto('/register');

    const uniqueEmail = `test-system-${Date.now()}@example.com`;
    await page.fill('input[placeholder*="Nombre de la empresa"]', 'Transportadora System Test');
    await page.fill('input[placeholder*="Ej: 1234567-8"]', '5555555-5');
    await page.fill('input[placeholder*="admin@empresa.com"]', uniqueEmail);
    await page.fill('input[placeholder*="Mínimo 8 caracteres"]:first-of-type', 'Password123');
    await page.fill('input[placeholder*="Repite tu contraseña"]', 'Password123');

    await page.click('button:has-text("Crear Mi Transportadora")');

    // Click "Ir al Sistema" button
    const systemButton = page.locator('button:has-text("Ir al Sistema")');
    await expect(systemButton).toBeVisible();

    // Note: This would navigate to localhost:5173 which may not be available
    // We're just verifying the button exists and is clickable
    await expect(systemButton).toBeEnabled();
  });
});

test.describe('Responsive Design', () => {
  test('debería verse bien en móvil', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/register');

    // Check that form is usable on mobile
    await expect(page.locator('text=Crea tu Transportadora')).toBeVisible();
    await expect(page.locator('input[placeholder*="Nombre de la empresa"]')).toBeVisible();

    // Check that inputs are large enough for touch
    const firstInput = page.locator('input[placeholder*="Nombre de la empresa"]');
    const box = await firstInput.boundingBox();
    expect(box?.height).toBeGreaterThan(40); // At least 40px height for touch targets
  });

  test('debería verse bien en tablet', async ({ page }) => {
    // Set tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });

    await page.goto('/register');

    // Check that layout is appropriate for tablet
    await expect(page.locator('text=Crea tu Transportadora')).toBeVisible();
    await expect(page.locator('text=¿Por qué elegir TranspoSaaS?')).toBeVisible();
  });

  test('debería verse bien en desktop', async ({ page }) => {
    // Set desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });

    await page.goto('/register');

    // Check that layout shows both form and benefits side by side
    await expect(page.locator('text=Crea tu Transportadora')).toBeVisible();
    await expect(page.locator('text=¿Por qué elegir TranspoSaaS?')).toBeVisible();
  });
});

test.describe('Accesibilidad', () => {
  test('debería tener labels apropiados para los inputs', async ({ page }) => {
    await page.goto('/register');

    // Check that all inputs have associated labels
    const inputs = await page.locator('input').all();
    for (const input of inputs) {
      const id = await input.getAttribute('id');
      if (id) {
        const label = page.locator(`label[for="${id}"]`);
        await expect(label).toBeVisible();
      }
    }
  });

  test('debería tener mensajes de error descriptivos', async ({ page }) => {
    await page.goto('/register');

    // Trigger validation error
    await page.fill('input[placeholder*="admin@empresa.com"]', 'invalid');
    await page.blur();

    const errorMessage = page.locator('text=Formato de email inválido');
    await expect(errorMessage).toBeVisible();

    // Check that error message is associated with the input
    const input = page.locator('input[placeholder*="admin@empresa.com"]');
    const inputBox = await input.boundingBox();
    const errorBox = await errorMessage.boundingBox();

    // Error should appear near the input
    expect(errorBox?.y).toBeGreaterThan((inputBox?.y || 0) + (inputBox?.height || 0));
  });

  test('debería ser navegable por teclado', async ({ page }) => {
    await page.goto('/register');

    // Tab through form fields
    await page.keyboard.press('Tab'); // First input
    await page.keyboard.press('Tab'); // Second input
    await page.keyboard.press('Tab'); // Third input

    // Verify focus moves correctly
    const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(focusedElement).toBe('INPUT');
  });
});