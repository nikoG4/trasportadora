import { test, expect } from '@playwright/test';

// Test data
const validLoginData = {
  email: 'admin',
  password: 'admin123'
};

const invalidLoginData = {
  email: 'nonexistent@example.com',
  password: 'wrongpassword'
};

const emptyEmailData = {
  email: '',
  password: 'admin123'
};

const emptyPasswordData = {
  email: 'admin',
  password: ''
};

test.describe('Página de Login', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('debería mostrar la página de login correctamente', async ({ page }) => {
    // Check main elements
    await expect(page.locator('text=Iniciar Sesión')).toBeVisible();
    await expect(page.locator('text=Ingresa a tu transportadora')).toBeVisible();
    await expect(page.locator('input[placeholder*="tu@email.com"]')).toBeVisible();
    await expect(page.locator('input[placeholder*="••••••••"]')).toBeVisible();
    await expect(page.locator('button:has-text("Iniciar Sesión")')).toBeVisible();
  });

  test('debería tener botón de volver al inicio', async ({ page }) => {
    const backButton = page.locator('text=Volver al Inicio');
    await expect(backButton).toBeVisible();
    await expect(backButton).toHaveAttribute('href', '/');
  });

  test('debería tener enlace para ir a registro', async ({ page }) => {
    const registerLink = page.locator('text=¿No tienes cuenta?');
    await expect(registerLink).toBeVisible();

    const registerButton = page.locator('text=Regístrate gratis');
    await expect(registerButton).toBeVisible();
  });

  test('debería mostrar credenciales de demo', async ({ page }) => {
    await expect(page.locator('text=Credenciales de Demo')).toBeVisible();
    await expect(page.locator('text=admin')).toBeVisible();
    await expect(page.locator('text=admin123')).toBeVisible();
  });

  test('debería tener sección de ayuda', async ({ page }) => {
    await expect(page.locator('text=¿Necesitas ayuda?')).toBeVisible();
    await expect(page.locator('text=soporte@transposaas.com')).toBeVisible();
    await expect(page.locator('text=+595 981 000 000')).toBeVisible();
  });
});

test.describe('Formulario de Login', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('debería validar email vacío', async ({ page }) => {
    await page.fill('input[placeholder*="tu@email.com"]', '');
    await page.blur(); // Trigger validation

    const errorMessage = page.locator('text=El email es requerido');
    await expect(errorMessage).toBeVisible();
  });

  test('debería validar email inválido', async ({ page }) => {
    await page.fill('input[placeholder*="tu@email.com"]', 'invalid-email');
    await page.blur(); // Trigger validation

    const errorMessage = page.locator('text=Formato de email inválido');
    await expect(errorMessage).toBeVisible();
  });

  test('debería validar contraseña vacía', async ({ page }) => {
    await page.fill('input[placeholder*="••••••••"]', '');
    await page.blur(); // Trigger validation

    const errorMessage = page.locator('text=La contraseña es requerida');
    await expect(errorMessage).toBeVisible();
  });

  test('debería mostrar/ocultar contraseña al hacer clic en el icono de ojo', async ({ page }) => {
    const passwordInput = page.locator('input[placeholder*="••••••••"]');
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

  test('debería tener checkbox de recordarme', async ({ page }) => {
    const rememberCheckbox = page.locator('input[type="checkbox"]');
    await expect(rememberCheckbox).toBeVisible();

    const rememberLabel = page.locator('text=Recordarme');
    await expect(rememberLabel).toBeVisible();
  });

  test('debería tener enlace de ¿Olvidaste tu contraseña?', async ({ page }) => {
    const forgotPasswordLink = page.locator('text=¿Olvidaste tu contraseña?');
    await expect(forgotPasswordLink).toBeVisible();
    await expect(forgotPasswordLink).toHaveAttribute('href', '#');
  });
});

test.describe('Flujo de Login', () => {
  test('debería iniciar sesión exitosamente con credenciales válidas', async ({ page }) => {
    await page.goto('/login');

    // Fill in the form
    await page.fill('input[placeholder*="tu@email.com"]', validLoginData.email);
    await page.fill('input[placeholder*="••••••••"]', validLoginData.password);

    // Submit the form
    await page.click('button:has-text("Iniciar Sesión")');

    // Should redirect to main app (localhost:5173)
    // Note: This might fail if the main app is not running
    // We're just verifying the login attempt is made
    await expect(page).toHaveURL(/http:\/\/localhost:5173/);
  });

  test('debería mostrar error con credenciales inválidas', async ({ page }) => {
    await page.goto('/login');

    // Fill form with invalid credentials
    await page.fill('input[placeholder*="tu@email.com"]', invalidLoginData.email);
    await page.fill('input[placeholder*="••••••••"]', invalidLoginData.password);

    // Try to submit
    await page.click('button:has-text("Iniciar Sesión")');

    // Should show error message
    await expect(page.locator('text=Error al iniciar sesión')).toBeVisible();

    // Should not redirect
    await expect(page).toHaveURL('/login');
  });

  test('debería mostrar error con email vacío', async ({ page }) => {
    await page.goto('/login');

    // Fill form with empty email
    await page.fill('input[placeholder*="tu@email.com"]', emptyEmailData.email);
    await page.fill('input[placeholder*="••••••••"]', emptyEmailData.password);

    // Try to submit
    await page.click('button:has-text("Iniciar Sesión")');

    // Should show validation error
    await expect(page.locator('text=El email es requerido')).toBeVisible();

    // Should not redirect
    await expect(page).toHaveURL('/login');
  });

  test('debería mostrar error con contraseña vacía', async ({ page }) => {
    await page.goto('/login');

    // Fill form with empty password
    await page.fill('input[placeholder*="tu@email.com"]', emptyPasswordData.email);
    await page.fill('input[placeholder*="••••••••"]', emptyPasswordData.password);

    // Try to submit
    await page.click('button:has-text("Iniciar Sesión")');

    // Should show validation error
    await expect(page.locator('text=La contraseña es requerida')).toBeVisible();

    // Should not redirect
    await expect(page).toHaveURL('/login');
  });

  test('debería limpiar errores al escribir en los campos', async ({ page }) => {
    await page.goto('/login');

    // Trigger validation error
    await page.fill('input[placeholder*="tu@email.com"]', '');
    await page.blur();
    await expect(page.locator('text=El email es requerido')).toBeVisible();

    // Type in the field
    await page.fill('input[placeholder*="tu@email.com"]', 'test@example.com');

    // Error should be cleared
    await expect(page.locator('text=El email es requerido')).not.toBeVisible();
  });

  test('debería navegar a la página de registro al hacer clic en "Regístrate gratis"', async ({ page }) => {
    await page.goto('/login');

    await page.click('text=Regístrate gratis');

    await expect(page).toHaveURL('/register');
    await expect(page.locator('text=Crea tu Transportadora')).toBeVisible();
  });

  test('debería navegar al inicio al hacer clic en "Volver al Inicio"', async ({ page }) => {
    await page.goto('/login');

    await page.click('text=Volver al Inicio');

    await expect(page).toHaveURL('/');
    await expect(page.locator('text=TranspoSaaS')).toBeVisible();
  });
});

test.describe('Navegación desde Landing Page', () => {
  test('debería navegar a login desde el navbar', async ({ page }) => {
    await page.goto('/');

    const loginButton = page.locator('text=Iniciar Sesión');
    await expect(loginButton).toBeVisible();
    await expect(loginButton).toHaveAttribute('href', '/login');

    await page.click('text=Iniciar Sesión');

    await expect(page).toHaveURL('/login');
    await expect(page.locator('text=Iniciar Sesión')).toBeVisible();
  });

  test('debería navegar a login desde el hero section', async ({ page }) => {
    await page.goto('/');

    const loginButton = page.locator('text=Iniciar Sesión').filter({ hasText: 'ChevronRight' });
    await expect(loginButton).toBeVisible();

    await page.click('text=Iniciar Sesión');

    await expect(page).toHaveURL('/login');
  });

  test('debería navegar a login desde la sección CTA', async ({ page }) => {
    await page.goto('/');

    // Scroll to CTA section
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    const loginButton = page.locator('text=Iniciar Sesión').last();
    await expect(loginButton).toBeVisible();

    await page.click('text=Iniciar Sesión');

    await expect(page).toHaveURL('/login');
  });
});

test.describe('Responsive Design - Login', () => {
  test('debería verse bien en móvil', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/login');

    // Check that form is usable on mobile
    await expect(page.locator('text=Iniciar Sesión')).toBeVisible();
    await expect(page.locator('input[placeholder*="tu@email.com"]')).toBeVisible();

    // Check that inputs are large enough for touch
    const firstInput = page.locator('input[placeholder*="tu@email.com"]');
    const box = await firstInput.boundingBox();
    expect(box?.height).toBeGreaterThan(40);
  });

  test('debería verse bien en tablet', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/login');

    // Check that layout is appropriate for tablet
    await expect(page.locator('text=Iniciar Sesión')).toBeVisible();
    await expect(page.locator('text=Credenciales de Demo')).toBeVisible();
  });

  test('debería verse bien en desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/login');

    // Check that layout is appropriate for desktop
    await expect(page.locator('text=Iniciar Sesión')).toBeVisible();
    await expect(page.locator('text=¿Necesitas ayuda?')).toBeVisible();
  });
});

test.describe('Accesibilidad - Login', () => {
  test('debería tener labels apropiados para los inputs', async ({ page }) => {
    await page.goto('/login');

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

  test('debería ser navegable por teclado', async ({ page }) => {
    await page.goto('/login');

    // Tab through form fields
    await page.keyboard.press('Tab'); // First input
    await page.keyboard.press('Tab'); // Second input
    await page.keyboard.press('Tab'); // Checkbox

    // Verify focus moves correctly
    const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(focusedElement).toBe('INPUT');
  });

  test('debería tener atributos ARIA apropiados', async ({ page }) => {
    await page.goto('/login');

    // Check for proper ARIA attributes
    const emailInput = page.locator('input[placeholder*="tu@email.com"]');
    await expect(emailInput).toHaveAttribute('autocomplete', 'email');

    const passwordInput = page.locator('input[placeholder*="••••••••"]');
    await expect(passwordInput).toHaveAttribute('autocomplete', 'current-password');
  });
});

test.describe('Integración con Backend', () => {
  test('debería almacenar tokens en localStorage después de login exitoso', async ({ page }) => {
    // This test requires the backend to be running
    test.skip(true, 'Requires backend server to be running');

    await page.goto('/login');

    await page.fill('input[placeholder*="tu@email.com"]', validLoginData.email);
    await page.fill('input[placeholder*="••••••••"]', validLoginData.password);

    await page.click('button:has-text("Iniciar Sesión")');

    // Wait for redirect
    await page.waitForURL(/http:\/\/localhost:5173/);

    // Check localStorage
    const authToken = await page.evaluate(() => localStorage.getItem('auth_token'));
    const refreshToken = await page.evaluate(() => localStorage.getItem('auth_refresh_token'));

    expect(authToken).toBeTruthy();
    expect(refreshToken).toBeTruthy();
  });

  test('debería manejar errores del servidor correctamente', async ({ page }) => {
    // This test would require mocking server responses
    test.skip(true, 'Requires server error mocking setup');
  });
});

test.describe('UX y Experiencia de Usuario', () => {
  test('debería mostrar indicador de carga durante el login', async ({ page }) => {
    await page.goto('/login');

    await page.fill('input[placeholder*="tu@email.com"]', validLoginData.email);
    await page.fill('input[placeholder*="••••••••"]', validLoginData.password);

    // Click submit button
    await page.click('button:has-text("Iniciar Sesión")');

    // Check for loading indicator
    const loadingSpinner = page.locator('.animate-spin');
    // Note: This might be transient, so we just check it exists at some point
    await expect(page.locator('text=Iniciando sesión...')).toBeVisible();
  });

  test('debería deshabilitar el botón durante el login', async ({ page }) => {
    await page.goto('/login');

    await page.fill('input[placeholder*="tu@email.com"]', validLoginData.email);
    await page.fill('input[placeholder*="••••••••"]', validLoginData.password);

    const submitButton = page.locator('button:has-text("Iniciar Sesión")');

    // Click submit button
    await submitButton.click();

    // Button should be disabled during loading
    await expect(submitButton).toBeDisabled();
  });

  test('debería tener mensajes de error descriptivos', async ({ page }) => {
    await page.goto('/login');

    // Trigger error with invalid credentials
    await page.fill('input[placeholder*="tu@email.com"]', invalidLoginData.email);
    await page.fill('input[placeholder*="••••••••"]', invalidLoginData.password);

    await page.click('button:has-text("Iniciar Sesión")');

    // Check for error message
    const errorMessage = page.locator('text=Error al iniciar sesión');
    await expect(errorMessage).toBeVisible();

    // Error should be in a visible container
    const errorContainer = page.locator('.bg-red-50');
    await expect(errorContainer).toBeVisible();
  });

  test('debería mantener los valores del formulario después de error', async ({ page }) => {
    await page.goto('/login');

    const testEmail = 'test@example.com';
    const testPassword = 'testpassword';

    await page.fill('input[placeholder*="tu@email.com"]', testEmail);
    await page.fill('input[placeholder*="••••••••"]', testPassword);

    // Trigger error
    await page.click('button:has-text("Iniciar Sesión")');

    // Values should be preserved
    await expect(page.locator('input[placeholder*="tu@email.com"]')).toHaveValue(testEmail);
    await expect(page.locator('input[placeholder*="••••••••"]')).toHaveValue(testPassword);
  });
});