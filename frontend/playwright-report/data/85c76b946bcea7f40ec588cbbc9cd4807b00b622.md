# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth.setup.ts >> authenticate
- Location: e2e/auth.setup.ts:6:6

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3000/login
Call log:
  - navigating to "http://localhost:3000/login", waiting until "load"

```

# Test source

```ts
  1  | import { test as setup, expect } from '@playwright/test';
  2  | import path from 'path';
  3  | 
  4  | const authFile = path.join(__dirname, '.auth/user.json');
  5  | 
  6  | setup('authenticate', async ({ page }) => {
  7  |   const username = process.env.E2E_USERNAME ?? 'admin';
  8  |   const password = process.env.E2E_PASSWORD ?? 'admin';
  9  | 
> 10 |   await page.goto('/login');
     |              ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3000/login
  11 |   await page.waitForLoadState('networkidle');
  12 | 
  13 |   await page.getByLabel('Usuario').fill(username);
  14 |   await page.getByLabel('Contraseña').fill(password);
  15 |   await page.getByRole('button', { name: /iniciar sesión/i }).click();
  16 | 
  17 |   // Esperar redirección al dashboard (confirma login exitoso)
  18 |   await expect(page).toHaveURL(/\/(dashboard|ventas|inicio)/, { timeout: 10_000 });
  19 | 
  20 |   // Guardar estado de autenticación para los demás tests
  21 |   await page.context().storageState({ path: authFile });
  22 | });
  23 | 
```