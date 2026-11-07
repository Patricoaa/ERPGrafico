import { test as setup, expect } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '.auth/user.json');

setup('authenticate', async ({ page }) => {
  const username = process.env.E2E_USERNAME ?? 'admin';
  const password = process.env.E2E_PASSWORD ?? 'admin';

  await page.goto('/login');
  await page.waitForLoadState('networkidle');

  await page.locator('input[name="username"]').fill(username);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole('button', { name: /ingresar/i }).click();

  // Salir de /login confirma el inicio de sesión: el dashboard vive en la raíz
  await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });

  // Guardar estado de autenticación para los demás tests
  await page.context().storageState({ path: authFile });
});
