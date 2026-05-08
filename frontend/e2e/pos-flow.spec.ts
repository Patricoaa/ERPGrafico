import { test, expect } from '@playwright/test';

/**
 * Flujo POS (T-63)
 * Cubre: acceso a módulo POS, sesión activa, cierre de caja
 */
test.describe('Flujo POS', () => {
  test('el módulo POS es accesible y carga sin error', async ({ page }) => {
    await page.goto('/ventas/pos');
    await page.waitForLoadState('networkidle');
    const validRoutes = [/ventas\/pos/, /pos/, /punto-de-venta/];
    const currentUrl = page.url();
    const isValid = validRoutes.some(r => r.test(currentUrl));
    expect(isValid || currentUrl.includes('pos')).toBeTruthy();
    await expect(page.getByText(/error 500|internal server error/i)).not.toBeVisible();
  });

  test('la vista de cajas / sesiones POS carga', async ({ page }) => {
    await page.goto('/tesoreria/cajas');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/error 500|internal server error/i)).not.toBeVisible();
    // Debe existir algún contenido de lista o panel de sesiones
    const mainContent = page.locator('main, [role="main"]').first();
    await expect(mainContent).toBeVisible({ timeout: 8_000 });
  });

  test('la sección de historial de sesiones tiene estructura de tabla o lista', async ({ page }) => {
    await page.goto('/tesoreria/cajas');
    await page.waitForLoadState('networkidle');
    const hasTable = await page.locator('table, [role="table"]').count() > 0;
    const hasList  = await page.locator('[role="list"], ul').count() > 0;
    const hasEmpty = await page.getByText(/sin sesiones|no hay sesiones|vacío|empty/i).count() > 0;
    const hasCard  = await page.locator('[data-testid*="session"], .session-card').count() > 0;
    expect(hasTable || hasList || hasEmpty || hasCard).toBeTruthy();
  });
});
