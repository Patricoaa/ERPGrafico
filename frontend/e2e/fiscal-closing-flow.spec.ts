import { test, expect } from '@playwright/test';

/**
 * Flujo Cierre Fiscal (T-63)
 * Cubre: Períodos tributarios, F29, cierre anual, asientos contables
 *
 * Estos tests verifican que las rutas críticas del flujo fiscal carguen
 * y no produzcan errores 500. Las acciones destructivas (cierre de período)
 * requieren estado de DB específico y se ejecutan en el pipeline nocturno.
 */
test.describe('Flujo Cierre Fiscal', () => {
  test('la lista de Períodos Contables carga sin error', async ({ page }) => {
    await page.goto('/tributario/periodos');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/tributario\/periodos|periodos/i);
    await expect(page.getByText(/error 500|internal server error/i)).not.toBeVisible();
  });

  test('el módulo F29 es accesible y muestra datos', async ({ page }) => {
    await page.goto('/tributario/f29');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/tributario\/f29|f29/i);
    await expect(page.getByText(/error 500|internal server error/i)).not.toBeVisible();
    // La página debe tener algún contenido estructurado
    await expect(page.locator('main').first()).toBeVisible({ timeout: 8_000 });
  });

  test('la sección de cierre anual carga sin error', async ({ page }) => {
    await page.goto('/contabilidad/cierre-anual');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/error 500|internal server error/i)).not.toBeVisible();
    await expect(page.locator('main').first()).toBeVisible({ timeout: 8_000 });
  });

  test('el listado de asientos contables carga', async ({ page }) => {
    await page.goto('/contabilidad/asientos');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/contabilidad\/asientos|journal/i);
    await expect(page.getByText(/error 500|internal server error/i)).not.toBeVisible();

    // Verificar que existe tabla o estado vacío (no un error en blanco)
    const hasTable = await page.locator('table, [role="table"]').count() > 0;
    const hasEmpty = await page.getByText(/sin asientos|no hay asientos|empty/i).count() > 0;
    const hasContent = await page.locator('main > *').count() > 1;
    expect(hasTable || hasEmpty || hasContent).toBeTruthy();
  });
});
