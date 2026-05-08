import { test as setup, expect } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '.auth/user.json');

setup('authenticate', async ({ page }) => {
  const username = process.env.E2E_USERNAME ?? 'admin';
  const password = process.env.E2E_PASSWORD ?? 'admin';

  await page.goto('/login');
  await page.waitForLoadState('networkidle');

  await page.getByLabel('Usuario').fill(username);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: /iniciar sesión/i }).click();

  // Esperar redirección al dashboard (confirma login exitoso)
  await expect(page).toHaveURL(/\/(dashboard|ventas|inicio)/, { timeout: 10_000 });

  // Guardar estado de autenticación para los demás tests
  await page.context().storageState({ path: authFile });
});
