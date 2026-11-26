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
import { test, expect, Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Helper: abre el Universal Search, escribe la query y devuelve el locator
// ---------------------------------------------------------------------------
async function openSearchAndType(page: Page, query: string, { reload = true }: { reload?: boolean } = {}) {
    // El valor por defecto preserva el patrón T-79 (cada caso empieza en `/`). Los casos de
    // regresión #260 necesitan abrir la búsqueda dos veces sin recargar para no perder las pestañas.
    if (reload) await page.goto('/');
    await page.keyboard.press('Control+k');
    const dialog = page.getByRole('dialog', { name: /búsqueda/i });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('combobox').fill(query);
}

// ---------------------------------------------------------------------------
// Helpers ADR-0152: filas mínimas y mocks compartidos por búsqueda/redirects
// ---------------------------------------------------------------------------
function budgetRow(id: number, name: string) {
    return {
        id,
        name,
        description: 'Gastos generales',
        start_date: '2026-01-01',
        end_date: '2026-12-31',
        items: [],
    };
}

function payrollRow(id: number, employeeName = 'Juan Empleado') {
    return {
        id,
        display_id: `LIQ-${id}`,
        employee: id - 1,
        employee_name: employeeName,
        employee_detail: {
            contact_detail: { name: employeeName, tax_id: '12.345.678-9' },
            position: 'Desarrollador',
            department: 'TI',
        },
        period_year: 2026,
        period_month: 11,
        period_label: 'Noviembre 2026',
        status: 'POSTED',
        status_display: 'Contabilizado',
        base_salary: '500000',
        total_haberes: '500000',
        total_descuentos: '100000',
        net_salary: '400000',
        legal_deductions_worker: '100000',
        employer_contribution: '70000',
        other_deductions: '0',
        advances_total: '0',
        worked_days: 30,
        agreed_days: 30,
        remuneration_paid_status: 'PENDING',
        previred_paid_status: 'PENDING',
        items: [],
        payments: [],
    };
}

function searchResult(id: number, type: string, display: string, detail_url: string, icon: string) {
    return { id, type, display, detail_url, icon, label: type };
}

async function mockUniversalSearch(page: Page, query: string, results: ReturnType<typeof searchResult>[]) {
    await page.route(`**/api/search/universal/?q=${query}`, async route => {
        await route.fulfill({ json: { results } });
    });
}

async function mockBudgetEndpoints(page: Page, budgets: ReturnType<typeof budgetRow>[]) {
    await page.route(/\/api\/accounting\/budgets\/\?/, async route => {
        await route.fulfill({ json: { count: budgets.length, next: null, previous: null, results: budgets } });
    });
    for (const budget of budgets) {
        await page.route(`**/api/accounting/budgets/${budget.id}/`, async route => {
            await route.fulfill({ json: budget });
        });
        await page.route(`**/api/accounting/budgets/${budget.id}/execution/`, async route => {
            await route.fulfill({
                json: {
                    budget,
                    summary: { total_budgeted: 1000, total_actual: 900, total_variance: -100 },
                    items: [],
                },
            });
        });
    }
}

async function mockPayrollEndpoints(page: Page, payrolls: ReturnType<typeof payrollRow>[]) {
    await page.route(/\/api\/hr\/payrolls\/\?/, async route => {
        await route.fulfill({ json: { count: payrolls.length, next: null, previous: null, results: payrolls } });
    });
    for (const payroll of payrolls) {
        await page.route(`**/api/hr/payrolls/${payroll.id}/`, async route => {
            await route.fulfill({ json: payroll });
        });
    }
    // La ficha admin (drawer) necesita conceptos, pagos y movimientos; el resumen del empleado
    // consume el mismo registro, así que no hace falta un mock adicional para la preview.
    await page.route('**/api/hr/concepts/', async route => {
        await route.fulfill({ json: [] });
    });
    await page.route(/\/api\/hr\/payroll-payments\/\?/, async route => {
        await route.fulfill({ json: { count: 0, next: null, previous: null, results: [] } });
    });
    await page.route(/\/api\/hr\/employee-movements\/\?/, async route => {
        await route.fulfill({ json: { count: 0, next: null, previous: null, results: [] } });
    });
}

// ---------------------------------------------------------------------------
// sales.saledelivery
// ---------------------------------------------------------------------------
test.describe('Universal Search — Entidades adicionales (T-79)', () => {

    test('Navega a detalle de Despacho de Venta', async ({ page }) => {
        // ADR-0080 (GAP-08): el backend emite la URL canónica; el despacho no tiene lista
        // con ?selected propio, así que es el resolvedor /d/{label}/{id} (antes se simulaba
        // '/sales/deliveries/800', una ruta que el backend nunca emitía y no existe).
        await page.route('**/api/search/universal/?q=DES-800', async route => {
            await route.fulfill({
                json: {
                    results: [{
                        id: 800,
                        type: 'sales.saledelivery',
                        display: 'DES-800',
                        detail_url: '/d/sales.saledelivery/800',
                        icon: 'truck',
                        label: 'sales.saledelivery',
                    }],
                },
            });
        });
        await page.route('**/api/core/documents/sales.saledelivery/800/', async route => {
            await route.fulfill({
                json: {
                    label: 'sales.saledelivery', id: 800, display_id: 'DES-800', title: 'Despacho', icon: 'truck',
                    status: 'CONFIRMED', status_display: 'Confirmado', date: '2026-10-02', partner_name: 'Cliente Test',
                    url: '/d/sales.saledelivery/800', accessible: true, exists: true,
                },
            });
        });
        await page.route('**/api/sales/deliveries/800/', async route => {
            await route.fulfill({
                json: {
                    id: 800,
                    number: 800,
                    status: 'CONFIRMED',
                    sale_order_number: 'OV-100',
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
        await expect(page).toHaveURL(/.*\/d\/sales\.saledelivery\/800/);
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
                        detail_url: '/d/sales.salereturn/801',
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
        await expect(page).toHaveURL(/.*\/d\/sales\.salereturn\/801/);
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
                        detail_url: '/purchasing/dtes/orders/802',
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
        await expect(page).toHaveURL(/.*\/purchasing\/dtes\/orders\?selected=802/);
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
    test('Navega a la pestaña de Liquidación de Sueldo y limpia la URL (ADR-0152)', async ({ page }) => {
        await mockUniversalSearch(page, 'LIQ-911', [
            searchResult(911, 'hr.payroll', 'LIQ-911 · Juan Empleado', '/hr/payrolls?selected=911', 'wallet'),
        ]);
        await mockPayrollEndpoints(page, [payrollRow(911)]);

        await openSearchAndType(page, 'LIQ-911');
        const result = page.locator('text=LIQ-911 · Juan Empleado').first();
        await expect(result).toBeVisible();
        await result.click();
        // `useDeepLinkEntity` abre la pestaña y retira `?selected`.
        await expect(page).toHaveURL(/\/hr\/payrolls$/);
        await expect(page.locator('[data-tab-key="hr.payroll:911"]')).toBeVisible();
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

// ---------------------------------------------------------------------------
// ADR-0152 — links antiguos y regresión #260 (dos pestañas del mismo tipo)
// ---------------------------------------------------------------------------
test.describe('ADR-0152 — redirects y pestañas múltiples (#260)', () => {

    test('El enlace antiguo /finances/budgets/604 abre la ejecución en la lista', async ({ page }) => {
        await mockBudgetEndpoints(page, [budgetRow(604, 'Presupuesto 2026')]);

        await page.goto('/finances/budgets/604');

        await expect(page).toHaveURL(/\/finances\/budgets\/list\?selected=604&action=execution/);
        await expect(page.locator('[data-tab-key="panel:accounting.budget:execution:604"]')).toBeVisible();
        await expect(page.getByRole('dialog', { name: 'Ejecución: Presupuesto 2026' })).toBeVisible();
        await expect(page.getByText('Resumen de ejecución presupuestaria')).toBeVisible();
    });

    test('El enlace antiguo /hr/payrolls/911 abre la pestaña y limpia la URL', async ({ page }) => {
        await mockPayrollEndpoints(page, [payrollRow(911)]);

        await page.goto('/hr/payrolls/911');

        await expect(page).toHaveURL(/\/hr\/payrolls$/);
        await expect(page.locator('[data-tab-key="hr.payroll:911"]')).toBeVisible();
    });

    test('Dos presupuestos abiertos desde la lista conservan dos pestañas (#260)', async ({ page }) => {
        await mockBudgetEndpoints(page, [
            budgetRow(604, 'Presupuesto 2026'),
            budgetRow(605, 'Presupuesto 2027'),
        ]);

        await page.goto('/finances/budgets/list');
        const firstRow = page.getByRole('button', { name: 'Presupuesto 2026' });
        const secondRow = page.getByRole('button', { name: 'Presupuesto 2027' });
        await expect(firstRow).toBeVisible();
        await firstRow.click();
        await expect(page.locator('[data-tab-key="accounting.budget:604"]')).toBeVisible();

        // Volver a la pestaña de la lista para poder pulsar la segunda fila; el drawer queda abierto.
        await page.getByRole('tab').first().click();
        await expect(secondRow).toBeVisible();
        await secondRow.click();

        await expect(page.locator('[data-tab-key="accounting.budget:605"]')).toBeVisible();
        await expect(page.locator('[data-tab-key="accounting.budget:604"]')).toBeVisible();
    });

    test('Dos liquidaciones abiertas desde la búsqueda conservan dos pestañas (#260)', async ({ page }) => {
        await mockUniversalSearch(page, 'LIQ-911', [
            searchResult(911, 'hr.payroll', 'LIQ-911 · Juan Empleado', '/hr/payrolls?selected=911', 'wallet'),
        ]);
        await mockUniversalSearch(page, 'LIQ-912', [
            searchResult(912, 'hr.payroll', 'LIQ-912 · María Empleada', '/hr/payrolls?selected=912', 'wallet'),
        ]);
        await mockPayrollEndpoints(page, [payrollRow(911), payrollRow(912, 'María Empleada')]);

        await openSearchAndType(page, 'LIQ-911');
        await page.locator('text=LIQ-911 · Juan Empleado').first().click();
        await expect(page).toHaveURL(/\/hr\/payrolls$/);
        await expect(page.locator('[data-tab-key="hr.payroll:911"]')).toBeVisible();

        // Segunda búsqueda sin `page.goto`: las pestañas viven en el provider y deben conservar la primera.
        await openSearchAndType(page, 'LIQ-912', { reload: false });
        await page.locator('text=LIQ-912 · María Empleada').first().click();
        await expect(page.locator('[data-tab-key="hr.payroll:912"]')).toBeVisible();
        await expect(page.locator('[data-tab-key="hr.payroll:911"]')).toBeVisible();
    });

});

// ---------------------------------------------------------------------------
// ADR-0158 — /finances/budgets/versus: barra canónica con el periodo en la URL
// ---------------------------------------------------------------------------
test.describe('ADR-0158 — versus presupuestario con estado en la URL', () => {
    const varianceNode = {
        id: 1,
        code: '4',
        name: 'Ingresos operacionales',
        type: 'INCOME',
        month_actual: 120,
        month_budget: 100,
        month_variance: 20,
        month_percentage: 120,
        ytd_actual: 900,
        ytd_budget: 800,
        ytd_variance: 100,
        ytd_percentage: 112.5,
        is_unbudgeted: false,
        children: [],
    };

    test('el mes de la URL llega al endpoint y el CSV usa ese mismo periodo', async ({ page }) => {
        const budgets = [budgetRow(604, 'Presupuesto 2026')];
        await mockBudgetEndpoints(page, budgets);
        await page.route('**/api/core/server-time/', async route => {
            await route.fulfill({ json: { datetime: '2026-11-26T12:00:00Z', date: '2026-11-26', year: 2026, month: 11, day: 26, timezone: 'UTC' } });
        });
        const varianceUrls: string[] = [];
        await page.route(/\/api\/accounting\/budgets\/604\/variance\//, async route => {
            varianceUrls.push(route.request().url());
            await route.fulfill({ json: [varianceNode] });
        });

        await page.goto('/finances/budgets/versus?budget=604&month=3&year=2025');

        await expect(page.getByRole('heading', { name: 'Versus Presupuestario' })).toBeVisible();
        await expect.poll(() => varianceUrls[0] ?? '').toContain('month=3');
        await expect.poll(() => varianceUrls.at(-1) ?? '').toContain('year=2025');
        await expect(page.getByText('Ingresos operacionales')).toBeVisible();

        // Un cambio de mes en la URL debe refetchear; la key de React Query incluye el periodo.
        await page.goto('/finances/budgets/versus?budget=604&month=4&year=2025');
        await expect.poll(() => varianceUrls.at(-1) ?? '').toContain('month=4');
        await expect.poll(() => varianceUrls.length).toBe(2);

        await page.getByRole('button', { name: 'Exportar' }).click();
        const downloadPromise = page.waitForEvent('download');
        await page.getByRole('menuitem', { name: 'CSV' }).click();
        const download = await downloadPromise;
        expect(download.suggestedFilename()).toBe('variacion_604_2025-4.csv');
    });
});
