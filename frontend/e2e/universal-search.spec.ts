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
});
