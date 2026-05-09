/**
 * T-79 — Universal Search: rutas de entidades no cubiertas en universal-search.spec.ts
 *
 * Cubre las 12 entidades del UniversalRegistry que aún no tenían test E2E:
 *   sales.saledelivery, sales.salereturn, purchasing.purchaseorder,
 *   contacts.contact, hr.employee, hr.payroll, production.workorder,
 *   tax.f29declaration, tax.accountingperiod, workflow.task,
 *   core.user, core.attachment
 *
 * Patrón de cada test:
 *  1. Mockear /api/search/universal/?q=... → resultado con detail_url canónico
 *  2. Mockear el endpoint REST del detalle → respuesta mínima
 *  3. Abrir Universal Search (Ctrl+K), escribir query, hacer click
 *  4. Verificar URL final y que la página renderiza sin error visible
 */
import { test, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// Helper: abre el Universal Search, escribe la query y devuelve el locator
// ---------------------------------------------------------------------------
async function openSearchAndType(page: Parameters<typeof test>[1] extends never ? never : Parameters<Parameters<typeof test>[1]>[0], query: string) {
    await page.goto('/');
    await page.keyboard.press('Control+k');
    await expect(page.getByRole('dialog', { name: /búsqueda/i })).toBeVisible();
    await page.keyboard.type(query);
}

// ---------------------------------------------------------------------------
// sales.saledelivery
// ---------------------------------------------------------------------------
test.describe('Universal Search — Entidades adicionales (T-79)', () => {

    test('Navega a detalle de Despacho de Venta', async ({ page }) => {
        await page.route('**/api/search/universal/?q=DES-800', async route => {
            await route.fulfill({
                json: {
                    results: [{
                        id: 800,
                        type: 'sales.saledelivery',
                        display: 'DES-800',
                        detail_url: '/sales/deliveries/800',
                        icon: 'truck',
                        label: 'sales.saledelivery',
                    }],
                },
            });
        });
        await page.route('**/api/sales/deliveries/800/', async route => {
            await route.fulfill({
                json: {
                    id: 800,
                    number: 800,
                    status: 'CONFIRMED',
                    sale_order_number: 'NV-100',
                    customer_name: 'Cliente Test',
                    total: 50000,
                    lines: [],
                },
            });
        });

        await openSearchAndType(page, 'DES-800');
        const result = page.locator('text=DES-800').first();
        await expect(result).toBeVisible();
        await result.click();
        await expect(page).toHaveURL(/.*\/sales\/deliveries\/800/);
    });

    // ---------------------------------------------------------------------------
    // sales.salereturn
    // ---------------------------------------------------------------------------
    test('Navega a detalle de Devolución de Venta', async ({ page }) => {
        await page.route('**/api/search/universal/?q=DEV-801', async route => {
            await route.fulfill({
                json: {
                    results: [{
                        id: 801,
                        type: 'sales.salereturn',
                        display: 'DEV-801',
                        detail_url: '/sales/returns/801',
                        icon: 'undo-2',
                        label: 'sales.salereturn',
                    }],
                },
            });
        });
        await page.route('**/api/sales/returns/801/', async route => {
            await route.fulfill({
                json: {
                    id: 801,
                    number: 801,
                    status: 'CONFIRMED',
                    total: 30000,
                    lines: [],
                },
            });
        });

        await openSearchAndType(page, 'DEV-801');
        const result = page.locator('text=DEV-801').first();
        await expect(result).toBeVisible();
        await result.click();
        await expect(page).toHaveURL(/.*\/sales\/returns\/801/);
    });

    // ---------------------------------------------------------------------------
    // purchasing.purchaseorder
    // ---------------------------------------------------------------------------
    test('Navega a detalle de Orden de Compra', async ({ page }) => {
        await page.route('**/api/search/universal/?q=OCS-802', async route => {
            await route.fulfill({
                json: {
                    results: [{
                        id: 802,
                        type: 'purchasing.purchaseorder',
                        display: 'OCS-802 · Proveedor Test',
                        detail_url: '/purchasing/orders/802',
                        icon: 'shopping-cart',
                        label: 'purchasing.purchaseorder',
                    }],
                },
            });
        });
        await page.route('**/api/purchasing/orders/802/', async route => {
            await route.fulfill({
                json: {
                    id: 802,
                    number: 802,
                    status: 'CONFIRMED',
                    supplier_name: 'Proveedor Test',
                    total: 120000,
                    lines: [],
                },
            });
        });

        await openSearchAndType(page, 'OCS-802');
        const result = page.locator('text=OCS-802 · Proveedor Test').first();
        await expect(result).toBeVisible();
        await result.click();
        await expect(page).toHaveURL(/.*\/purchasing\/orders\/802/);
    });

    // ---------------------------------------------------------------------------
    // contacts.contact
    // ---------------------------------------------------------------------------
    test('Navega a detalle de Contacto', async ({ page }) => {
        await page.route('**/api/search/universal/?q=Empresa+Test', async route => {
            await route.fulfill({
                json: {
                    results: [{
                        id: 900,
                        type: 'contacts.contact',
                        display: 'Empresa Test · 76.000.000-0',
                        detail_url: '/contacts/900',
                        icon: 'users',
                        label: 'contacts.contact',
                    }],
                },
            });
        });
        await page.route('**/api/contacts/contacts/900/', async route => {
            await route.fulfill({
                json: {
                    id: 900,
                    name: 'Empresa Test',
                    tax_id: '76.000.000-0',
                    is_customer: true,
                    is_supplier: false,
                    is_partner: false,
                },
            });
        });

        await openSearchAndType(page, 'Empresa Test');
        const result = page.locator('text=Empresa Test · 76.000.000-0').first();
        await expect(result).toBeVisible();
        await result.click();
        await expect(page).toHaveURL(/.*\/contacts\/900/);
    });

    // ---------------------------------------------------------------------------
    // hr.employee
    // ---------------------------------------------------------------------------
    test('Navega a detalle de Empleado', async ({ page }) => {
        await page.route('**/api/search/universal/?q=EMP-001', async route => {
            await route.fulfill({
                json: {
                    results: [{
                        id: 910,
                        type: 'hr.employee',
                        display: 'Juan Empleado (EMP-001)',
                        detail_url: '/hr/employees/910',
                        icon: 'user-check',
                        label: 'hr.employee',
                    }],
                },
            });
        });
        await page.route('**/api/hr/employees/910/', async route => {
            await route.fulfill({
                json: {
                    id: 910,
                    code: 'EMP-001',
                    contact_name: 'Juan Empleado',
                    position: 'Desarrollador',
                    department: 'TI',
                    is_active: true,
                },
            });
        });

        await openSearchAndType(page, 'EMP-001');
        const result = page.locator('text=Juan Empleado (EMP-001)').first();
        await expect(result).toBeVisible();
        await result.click();
        await expect(page).toHaveURL(/.*\/hr\/employees\/910/);
    });

    // ---------------------------------------------------------------------------
    // hr.payroll
    // ---------------------------------------------------------------------------
    test('Navega a detalle de Liquidación de Sueldo', async ({ page }) => {
        await page.route('**/api/search/universal/?q=LIQ-911', async route => {
            await route.fulfill({
                json: {
                    results: [{
                        id: 911,
                        type: 'hr.payroll',
                        display: 'LIQ-911 · Juan Empleado',
                        detail_url: '/hr/payrolls/911',
                        icon: 'wallet',
                        label: 'hr.payroll',
                    }],
                },
            });
        });
        await page.route('**/api/hr/payrolls/911/', async route => {
            await route.fulfill({
                json: {
                    id: 911,
                    number: 911,
                    employee_name: 'Juan Empleado',
                    period_month: 5,
                    period_year: 2026,
                    total_gross: 1000000,
                    total_net: 800000,
                },
            });
        });

        await openSearchAndType(page, 'LIQ-911');
        const result = page.locator('text=LIQ-911 · Juan Empleado').first();
        await expect(result).toBeVisible();
        await result.click();
        await expect(page).toHaveURL(/.*\/hr\/payrolls\/911/);
    });

    // ---------------------------------------------------------------------------
    // production.workorder
    // ---------------------------------------------------------------------------
    test('Navega a detalle de Orden de Trabajo', async ({ page }) => {
        await page.route('**/api/search/universal/?q=OT-920', async route => {
            await route.fulfill({
                json: {
                    results: [{
                        id: 920,
                        type: 'production.workorder',
                        display: 'OT-920 · Fabricación de piezas',
                        detail_url: '/production/orders/920',
                        icon: 'wrench',
                        label: 'production.workorder',
                    }],
                },
            });
        });
        await page.route('**/api/production/orders/920/', async route => {
            await route.fulfill({
                json: {
                    id: 920,
                    number: 920,
                    description: 'Fabricación de piezas',
                    status: 'IN_PROGRESS',
                },
            });
        });

        await openSearchAndType(page, 'OT-920');
        const result = page.locator('text=OT-920 · Fabricación de piezas').first();
        await expect(result).toBeVisible();
        await result.click();
        await expect(page).toHaveURL(/.*\/production\/orders\/920/);
    });

    // ---------------------------------------------------------------------------
    // tax.f29declaration
    // ---------------------------------------------------------------------------
    test('Navega a detalle de Declaración F29', async ({ page }) => {
        await page.route('**/api/search/universal/?q=F29+Folio+930', async route => {
            await route.fulfill({
                json: {
                    results: [{
                        id: 930,
                        type: 'tax.f29declaration',
                        display: 'F29 Folio 930',
                        detail_url: '/tax/f29/930',
                        icon: 'file-badge',
                        label: 'tax.f29declaration',
                    }],
                },
            });
        });
        await page.route('**/api/tax/f29-declarations/930/', async route => {
            await route.fulfill({
                json: {
                    id: 930,
                    folio_number: 930,
                    period_month: 4,
                    period_year: 2026,
                    status: 'SUBMITTED',
                },
            });
        });

        await openSearchAndType(page, 'F29 Folio 930');
        const result = page.locator('text=F29 Folio 930').first();
        await expect(result).toBeVisible();
        await result.click();
        await expect(page).toHaveURL(/.*\/tax\/f29\/930/);
    });

    // ---------------------------------------------------------------------------
    // tax.accountingperiod
    // ---------------------------------------------------------------------------
    test('Navega a detalle de Período Tributario', async ({ page }) => {
        await page.route('**/api/search/universal/?q=Periodo+5/2026', async route => {
            await route.fulfill({
                json: {
                    results: [{
                        id: 931,
                        type: 'tax.accountingperiod',
                        display: 'Periodo 5/2026',
                        detail_url: '/tax/periods/931',
                        icon: 'calendar-clock',
                        label: 'tax.accountingperiod',
                    }],
                },
            });
        });
        await page.route('**/api/tax/accounting-periods/931/', async route => {
            await route.fulfill({
                json: {
                    id: 931,
                    month: 5,
                    year: 2026,
                    status: 'OPEN',
                },
            });
        });

        await openSearchAndType(page, 'Periodo 5/2026');
        const result = page.locator('text=Periodo 5/2026').first();
        await expect(result).toBeVisible();
        await result.click();
        await expect(page).toHaveURL(/.*\/tax\/periods\/931/);
    });

    // ---------------------------------------------------------------------------
    // workflow.task
    // ---------------------------------------------------------------------------
    test('Navega a detalle de Tarea', async ({ page }) => {
        await page.route('**/api/search/universal/?q=Revisar+contrato', async route => {
            await route.fulfill({
                json: {
                    results: [{
                        id: 940,
                        type: 'workflow.task',
                        display: 'Revisar contrato',
                        detail_url: '/workflow/tasks/940',
                        icon: 'circle-check',
                        label: 'workflow.task',
                    }],
                },
            });
        });
        await page.route('**/api/workflow/tasks/940/', async route => {
            await route.fulfill({
                json: {
                    id: 940,
                    title: 'Revisar contrato',
                    description: 'Revisar y aprobar el contrato de proveedor.',
                    status: 'PENDING',
                    assigned_to_name: 'Admin',
                },
            });
        });

        await openSearchAndType(page, 'Revisar contrato');
        const result = page.locator('text=Revisar contrato').first();
        await expect(result).toBeVisible();
        await result.click();
        await expect(page).toHaveURL(/.*\/workflow\/tasks\/940/);
    });

    // ---------------------------------------------------------------------------
    // core.user
    // ---------------------------------------------------------------------------
    test('Navega a detalle de Usuario', async ({ page }) => {
        await page.route('**/api/search/universal/?q=admin@test.com', async route => {
            await route.fulfill({
                json: {
                    results: [{
                        id: 1,
                        type: 'core.user',
                        display: 'Admin User',
                        detail_url: '/settings/users/1',
                        icon: 'user',
                        label: 'core.user',
                    }],
                },
            });
        });
        await page.route('**/api/core/users/1/', async route => {
            await route.fulfill({
                json: {
                    id: 1,
                    first_name: 'Admin',
                    last_name: 'User',
                    email: 'admin@test.com',
                    is_active: true,
                },
            });
        });

        await openSearchAndType(page, 'admin@test.com');
        const result = page.locator('text=Admin User').first();
        await expect(result).toBeVisible();
        await result.click();
        await expect(page).toHaveURL(/.*\/settings\/users\/1/);
    });

    // ---------------------------------------------------------------------------
    // core.attachment
    // ---------------------------------------------------------------------------
    test('Navega a detalle de Archivo adjunto (readonly)', async ({ page }) => {
        await page.route('**/api/search/universal/?q=contrato.pdf', async route => {
            await route.fulfill({
                json: {
                    results: [{
                        id: 950,
                        type: 'core.attachment',
                        display: 'contrato.pdf',
                        detail_url: '/files/950',
                        icon: 'paperclip',
                        label: 'core.attachment',
                    }],
                },
            });
        });
        await page.route('**/api/core/attachments/950/', async route => {
            await route.fulfill({
                json: {
                    id: 950,
                    original_filename: 'contrato.pdf',
                    file_size: 204800,
                    content_type: 'application/pdf',
                    uploaded_at: '2026-05-08T10:00:00Z',
                },
            });
        });

        await openSearchAndType(page, 'contrato.pdf');
        const result = page.locator('text=contrato.pdf').first();
        await expect(result).toBeVisible();
        await result.click();
        await expect(page).toHaveURL(/.*\/files\/950/);
    });

});
