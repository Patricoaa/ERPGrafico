import { test, expect } from '@playwright/test';

test.describe('Universal Search Navigation', () => {
    test('Navigates to entity detail page correctly', async ({ page }) => {
        // Mock the Universal Search API response
        await page.route('**/api/search/universal/?q=NV-1000', async route => {
            const json = {
                results: [
                    {
                        id: 1000,
                        type: 'sale_order',
                        display: 'NV-1000 - Juan Perez',
                        detail_url: '/sales/orders/1000',
                        icon: 'receipt-text',
                        label: 'Nota de Venta'
                    }
                ]
            };
            await route.fulfill({ json });
        });

        // Mock the detail page API response
        await page.route('**/api/sales/orders/1000/', async route => {
            const json = {
                id: 1000,
                number: 'NV-1000',
                customer_name: 'Juan Perez',
                status: 'DRAFT',
                total: 50000,
                lines: []
            };
            await route.fulfill({ json });
        });

        // Go to dashboard (or any page with universal search)
        await page.goto('/');

        // Open Universal Search (Ctrl+K)
        await page.keyboard.press('Control+k');

        // Wait for dialog to open
        await expect(page.getByRole('dialog', { name: /búsqueda/i })).toBeVisible();

        // Type query
        await page.keyboard.type('NV-1000');

        // Wait for result to appear
        const result = page.locator('text=NV-1000 - Juan Perez');
        await expect(result).toBeVisible();

        // Click the result
        await result.click();

        // Check if URL changed correctly
        await expect(page).toHaveURL(/.*\/sales\/orders\/1000/);

        // Check if the EntityDetailPage rendered
        await expect(page.locator('text=Nota de Venta')).toBeVisible();
        await expect(page.locator('text=NV-1000')).toBeVisible();
    });

    test('Navigates to invoice detail page correctly and handles server-side split', async ({ page }) => {
        // Mock the Universal Search API response
        await page.route('**/api/search/universal/?q=FAC-1001', async route => {
            const json = {
                results: [
                    {
                        id: 1001,
                        type: 'invoice',
                        display: 'FACTURA 1001 - Proveedor A',
                        detail_url: '/billing/invoices/1001',
                        icon: 'file-text',
                        label: 'Factura/Boleta'
                    }
                ]
            };
            await route.fulfill({ json });
        });

        // Mock the detail page API response to return a PURCHASE_INV
        await page.route('**/api/billing/invoices/1001/', async route => {
            const json = {
                id: 1001,
                number: '1001',
                dte_type: 'PURCHASE_INV',
                dte_type_display: 'Factura de Compra',
                partner_name: 'Proveedor A',
                status: 'POSTED',
                total: 100000,
                is_sale_document: false,
                lines: []
            };
            await route.fulfill({ json });
        });

        // Go to dashboard
        await page.goto('/');

        // Open Universal Search
        await page.keyboard.press('Control+k');

        // Wait for dialog to open
        await expect(page.getByRole('dialog', { name: /búsqueda/i })).toBeVisible();

        // Type query
        await page.keyboard.type('FAC-1001');

        // Wait for result to appear
        const result = page.locator('text=FACTURA 1001 - Proveedor A');
        await expect(result).toBeVisible();

        // Click the result
        await result.click();

        // Check if URL changed and redirected correctly to purchases
        await expect(page).toHaveURL(/.*\/billing\/purchases\/1001/);

        // Check if the EntityDetailPage rendered
        await expect(page.locator('text=Factura de Compra')).toBeVisible();
    });

    test('Navigates to product detail page correctly', async ({ page }) => {
        await page.route('**/api/search/universal/?q=PROD-001', async route => {
            const json = {
                results: [
                    {
                        id: 501,
                        type: 'inventory.product',
                        display: 'Producto Test · PROD-001',
                        detail_url: '/inventory/products/501',
                        icon: 'package',
                        label: 'inventory.product'
                    }
                ]
            };
            await route.fulfill({ json });
        });

        await page.route('**/api/inventory/products/501/', async route => {
            const json = {
                id: 501,
                name: 'Producto Test',
                code: 'PROD-001',
                type: 'storable'
            };
            await route.fulfill({ json });
        });

        await page.goto('/');
        await page.keyboard.press('Control+k');
        await expect(page.getByRole('dialog', { name: /búsqueda/i })).toBeVisible();
        await page.keyboard.type('PROD-001');

        const result = page.locator('text=Producto Test · PROD-001');
        await expect(result).toBeVisible();
        await result.click();

        await expect(page).toHaveURL(/.*\/inventory\/products\/501/);
        await expect(page.locator('text=Producto Test')).toBeVisible();
    });

    test('Navigates to product category detail page correctly', async ({ page }) => {
        await page.route('**/api/search/universal/?q=CAT-001', async route => {
            const json = {
                results: [
                    {
                        id: 502,
                        type: 'inventory.productcategory',
                        display: 'CAT-001 · Categoría Test',
                        detail_url: '/inventory/categories/502',
                        icon: 'folder-tree',
                        label: 'inventory.productcategory'
                    }
                ]
            };
            await route.fulfill({ json });
        });

        await page.route('**/api/inventory/categories/502/', async route => {
            const json = {
                id: 502,
                name: 'Categoría Test',
                prefix: 'CAT-001'
            };
            await route.fulfill({ json });
        });

        await page.goto('/');
        await page.keyboard.press('Control+k');
        await expect(page.getByRole('dialog', { name: /búsqueda/i })).toBeVisible();
        await page.keyboard.type('CAT-001');

        const result = page.locator('text=CAT-001 · Categoría Test');
        await expect(result).toBeVisible();
        await result.click();

        await expect(page).toHaveURL(/.*\/inventory\/categories\/502/);
        await expect(page.locator('text=Categoría Test')).toBeVisible();
    });

    test('Navigates to warehouse detail page correctly', async ({ page }) => {
        await page.route('**/api/search/universal/?q=WH-001', async route => {
            const json = {
                results: [
                    {
                        id: 503,
                        type: 'inventory.warehouse',
                        display: 'WH-001 · Bodega Test',
                        detail_url: '/inventory/warehouses/503',
                        icon: 'warehouse',
                        label: 'inventory.warehouse'
                    }
                ]
            };
            await route.fulfill({ json });
        });

        await page.route('**/api/inventory/warehouses/503/', async route => {
            const json = {
                id: 503,
                name: 'Bodega Test',
                code: 'WH-001'
            };
            await route.fulfill({ json });
        });

        await page.goto('/');
        await page.keyboard.press('Control+k');
        await expect(page.getByRole('dialog', { name: /búsqueda/i })).toBeVisible();
        await page.keyboard.type('WH-001');

        const result = page.locator('text=WH-001 · Bodega Test');
        await expect(result).toBeVisible();
        await result.click();

        await expect(page).toHaveURL(/.*\/inventory\/warehouses\/503/);
        await expect(page.locator('text=Bodega Test')).toBeVisible();
    });

    test('Navigates to stock move detail page correctly', async ({ page }) => {
        await page.route('**/api/search/universal/?q=MOV-001', async route => {
            const json = {
                results: [
                    {
                        id: 504,
                        type: 'inventory.stockmove',
                        display: 'MOV-504',
                        detail_url: '/inventory/moves/504',
                        icon: 'arrow-right-left',
                        label: 'inventory.stockmove'
                    }
                ]
            };
            await route.fulfill({ json });
        });

        await page.route('**/api/inventory/stock_moves/504/', async route => {
            const json = {
                id: 504,
                display_id: 'MOV-504',
                move_type: 'IN',
                quantity: '100',
                unit_cost: '500',
                product_details: { name: 'Producto Test' },
                warehouse_details: { name: 'Bodega Test' }
            };
            await route.fulfill({ json });
        });

        await page.goto('/');
        await page.keyboard.press('Control+k');
        await expect(page.getByRole('dialog', { name: /búsqueda/i })).toBeVisible();
        await page.keyboard.type('MOV-001');

        const result = page.locator('text=MOV-504');
        await expect(result).toBeVisible();
        await result.click();

        await expect(page).toHaveURL(/.*\/inventory\/moves\/504/);
        await expect(page.locator('text=MOV-504')).toBeVisible();
        await expect(page.locator('text=Movimiento de Stock')).toBeVisible();
    });

    test('Navigates to account detail page correctly', async ({ page }) => {
        await page.route('**/api/search/universal/?q=1.1.1.1', async route => {
            const json = {
                results: [
                    {
                        id: 601,
                        type: 'accounting.account',
                        display: '1.1.1.1 · Caja',
                        detail_url: '/accounting/accounts/601',
                        icon: 'book-open',
                        label: 'accounting.account'
                    }
                ]
            };
            await route.fulfill({ json });
        });

        await page.route('**/api/accounting/accounts/601/', async route => {
            const json = {
                id: 601,
                code: '1.1.1.1',
                name: 'Caja',
                account_type: 'ASSET',
                children_count: 0
            };
            await route.fulfill({ json });
        });

        await page.goto('/');
        await page.keyboard.press('Control+k');
        await expect(page.getByRole('dialog', { name: /búsqueda/i })).toBeVisible();
        await page.keyboard.type('1.1.1.1');

        const result = page.locator('text=1.1.1.1 · Caja');
        await expect(result).toBeVisible();
        await result.click();

        await expect(page).toHaveURL(/.*\/accounting\/accounts\/601/);
        await expect(page.locator('text=Caja').first()).toBeVisible();
    });

    test('Navigates to journal entry detail page correctly', async ({ page }) => {
        await page.route('**/api/search/universal/?q=AS-602', async route => {
            const json = {
                results: [
                    {
                        id: 602,
                        type: 'accounting.journalentry',
                        display: 'AS-602',
                        detail_url: '/accounting/entries/602',
                        icon: 'notebook-pen',
                        label: 'accounting.journalentry'
                    }
                ]
            };
            await route.fulfill({ json });
        });

        await page.route('**/api/accounting/entries/602/', async route => {
            const json = {
                id: 602,
                number: 602,
                reference: 'AS-602',
                date: '2026-05-08',
                description: 'Asiento Inicial',
                state: 'POSTED',
                items: []
            };
            await route.fulfill({ json });
        });

        await page.goto('/');
        await page.keyboard.press('Control+k');
        await expect(page.getByRole('dialog', { name: /búsqueda/i })).toBeVisible();
        await page.keyboard.type('AS-602');

        const result = page.locator('text=AS-602');
        await expect(result).toBeVisible();
        await result.click();

        await expect(page).toHaveURL(/.*\/accounting\/entries\/602/);
        await expect(page.locator('text=Asiento Contable').first()).toBeVisible();
    });

    test('Navigates to fiscal year detail page correctly', async ({ page }) => {
        await page.route('**/api/search/universal/?q=2026', async route => {
            const json = {
                results: [
                    {
                        id: 603,
                        type: 'accounting.fiscalyear',
                        display: 'Año Fiscal 2026',
                        detail_url: '/accounting/closures/603',
                        icon: 'calendar',
                        label: 'accounting.fiscalyear'
                    }
                ]
            };
            await route.fulfill({ json });
        });

        await page.route('**/api/accounting/fiscal-years/?ordering=-year', async route => {
            const json = {
                results: [
                    {
                        id: 603,
                        year: 2026,
                        status: 'OPEN'
                    }
                ]
            };
            await route.fulfill({ json });
        });

        await page.route('**/api/tax/accounting-periods/?ordering=-year,-month', async route => {
            const json = {
                results: []
            };
            await route.fulfill({ json });
        });

        await page.goto('/');
        await page.keyboard.press('Control+k');
        await expect(page.getByRole('dialog', { name: /búsqueda/i })).toBeVisible();
        await page.keyboard.type('2026');

        const result = page.locator('text=Año Fiscal 2026');
        await expect(result).toBeVisible();
        await result.click();

        await expect(page).toHaveURL(/.*\/accounting\/closures\/603/);
        await expect(page.locator('text=Ejercicio 2026').first()).toBeVisible();
    });

    test('Navigates to budget detail page correctly', async ({ page }) => {
        await page.route('**/api/search/universal/?q=Presupuesto', async route => {
            const json = {
                results: [
                    {
                        id: 604,
                        type: 'accounting.budget',
                        display: 'Presupuesto 2026',
                        detail_url: '/finances/budgets/604',
                        icon: 'wallet',
                        label: 'accounting.budget'
                    }
                ]
            };
            await route.fulfill({ json });
        });

        await page.route('**/api/accounting/budgets/604/', async route => {
            const json = {
                id: 604,
                name: 'Presupuesto 2026',
                year: 2026
            };
            await route.fulfill({ json });
        });

        await page.goto('/');
        await page.keyboard.press('Control+k');
        await expect(page.getByRole('dialog', { name: /búsqueda/i })).toBeVisible();
        await page.keyboard.type('Presupuesto');

        const result = page.locator('text=Presupuesto 2026');
        await expect(result).toBeVisible();
        await result.click();

        await expect(page).toHaveURL(/.*\/finances\/budgets\/604/);
    });

    test('Navigates to treasury movement detail page correctly', async ({ page }) => {
        await page.route('**/api/search/universal/?q=MOV-001', async route => {
            const json = {
                results: [
                    {
                        id: 701,
                        type: 'treasury.treasurymovement',
                        display: 'MOV-000701',
                        detail_url: '/treasury/movements/701',
                        icon: 'landmark',
                        label: 'treasury.treasurymovement'
                    }
                ]
            };
            await route.fulfill({ json });
        });

        await page.route('**/api/treasury/payments/701/', async route => {
            const json = {
                id: 701,
                display_id: 'MOV-000701',
                movement_type: 'INBOUND',
                movement_type_display: 'Depósito',
                payment_method: 'CASH',
                payment_method_display: 'Efectivo',
                amount: '50000',
                date: '2026-05-08',
                created_by_name: 'Admin',
                notes: 'Depósito de prueba',
                from_account_name: null,
                to_account_name: 'Caja Principal',
                partner_name: null,
            };
            await route.fulfill({ json });
        });

        await page.goto('/');
        await page.keyboard.press('Control+k');
        await expect(page.getByRole('dialog', { name: /búsqueda/i })).toBeVisible();
        await page.keyboard.type('MOV-001');

        const result = page.locator('text=MOV-000701');
        await expect(result).toBeVisible();
        await result.click();

        await expect(page).toHaveURL(/.*\/treasury\/movements\/701/);
        await expect(page.locator('text=Movimiento de Tesorería').first()).toBeVisible();
    });

    test('Navigates to treasury account detail page correctly', async ({ page }) => {
        await page.route('**/api/search/universal/?q=Caja+Principal', async route => {
            const json = {
                results: [
                    {
                        id: 702,
                        type: 'treasury.treasuryaccount',
                        display: 'Caja Principal',
                        detail_url: '/treasury/accounts/702',
                        icon: 'piggy-bank',
                        label: 'treasury.treasuryaccount'
                    }
                ]
            };
            await route.fulfill({ json });
        });

        await page.route('**/api/treasury/accounts/702/', async route => {
            const json = {
                id: 702,
                name: 'Caja Principal',
                account_type: 'CASH',
                account_type_display: 'Caja Física (Efectivo)',
                currency: 'CLP',
                current_balance: 150000,
                account: null,
                bank: null,
                account_number: '',
                is_system_managed: false,
            };
            await route.fulfill({ json });
        });

        await page.route('**/api/treasury/banks/', async route => {
            await route.fulfill({ json: [] });
        });

        await page.goto('/');
        await page.keyboard.press('Control+k');
        await expect(page.getByRole('dialog', { name: /búsqueda/i })).toBeVisible();
        await page.keyboard.type('Caja Principal');

        const result = page.locator('text=Caja Principal').first();
        await expect(result).toBeVisible();
        await result.click();

        await expect(page).toHaveURL(/.*\/treasury\/accounts\/702/);
        await expect(page.locator('text=Cuenta de Tesorería').first()).toBeVisible();
    });

    test('Navigates to POS session detail page correctly (readonly)', async ({ page }) => {
        await page.route('**/api/search/universal/?q=SES-001', async route => {
            const json = {
                results: [
                    {
                        id: 703,
                        type: 'treasury.possession',
                        display: 'Sesión POS 703',
                        detail_url: '/treasury/sessions/703',
                        icon: 'calculator',
                        label: 'treasury.possession'
                    }
                ]
            };
            await route.fulfill({ json });
        });

        await page.route('**/api/treasury/pos-sessions/703/', async route => {
            const json = {
                id: 703,
                user_name: 'Cajero Test',
                terminal_name: 'Terminal 1',
                treasury_account_name: 'Caja Principal',
                status: 'CLOSED',
                status_display: 'Cerrada',
                opened_at: '2026-05-08T09:00:00Z',
                closed_at: '2026-05-08T18:00:00Z',
                opening_balance: 50000,
                total_cash_sales: 200000,
                total_card_sales: 150000,
                total_transfer_sales: 0,
                total_credit_sales: 0,
                total_other_cash_inflow: 0,
                total_other_cash_outflow: 10000,
                expected_cash: 240000,
                notes: '',
            };
            await route.fulfill({ json });
        });

        await page.goto('/');
        await page.keyboard.press('Control+k');
        await expect(page.getByRole('dialog', { name: /búsqueda/i })).toBeVisible();
        await page.keyboard.type('SES-001');

        const result = page.locator('text=Sesión POS 703');
        await expect(result).toBeVisible();
        await result.click();

        await expect(page).toHaveURL(/.*\/treasury\/sessions\/703/);
        await expect(page.locator('text=Sesión de Caja POS').first()).toBeVisible();
        await expect(page.locator('text=Solo lectura').first()).toBeVisible();
    });

    test('Navigates to bank statement detail page correctly (readonly)', async ({ page }) => {
        await page.route('**/api/search/universal/?q=EXT-001', async route => {
            const json = {
                results: [
                    {
                        id: 704,
                        type: 'treasury.bankstatement',
                        display: 'Cartola Caja Principal 2026-05-01',
                        detail_url: '/treasury/statements/704',
                        icon: 'file-spreadsheet',
                        label: 'treasury.bankstatement'
                    }
                ]
            };
            await route.fulfill({ json });
        });

        await page.route('**/api/treasury/statements/704/', async route => {
            const json = {
                id: 704,
                display_id: 'EXT-000704',
                treasury_account: 702,
                treasury_account_name: 'Caja Principal',
                statement_date: '2026-05-01',
                period_start: '2026-04-01',
                period_end: '2026-04-30',
                opening_balance: '100000.00',
                closing_balance: '150000.00',
                status: 'CONFIRMED',
                bank_format: 'GENERIC_CSV',
                total_lines: 10,
                reconciled_lines: 7,
                reconciliation_progress: 70.0,
                notes: '',
            };
            await route.fulfill({ json });
        });

        await page.goto('/');
        await page.keyboard.press('Control+k');
        await expect(page.getByRole('dialog', { name: /búsqueda/i })).toBeVisible();
        await page.keyboard.type('EXT-001');

        const result = page.locator('text=Cartola Caja Principal 2026-05-01');
        await expect(result).toBeVisible();
        await result.click();

        await expect(page).toHaveURL(/.*\/treasury\/statements\/704/);
        await expect(page.locator('text=Cartola Bancaria').first()).toBeVisible();
        await expect(page.locator('text=Solo lectura').first()).toBeVisible();
    });
});
