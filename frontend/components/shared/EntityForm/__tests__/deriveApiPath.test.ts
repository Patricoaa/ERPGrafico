import { describe, it, expect } from 'vitest';
import { deriveApiPath } from '../index';

describe('deriveApiPath', () => {
    it('pluralizes standard words by adding s', () => {
        expect(deriveApiPath('inventory.product')).toBe('/inventory/products/');
        expect(deriveApiPath('sales.order')).toBe('/sales/orders/');
    });

    it('pluralizes words ending in y correctly (ies)', () => {
        expect(deriveApiPath('inventory.category')).toBe('/inventory/categories/');
        expect(deriveApiPath('core.company')).toBe('/core/companies/');
    });

    it('pluralizes words ending in s, x, z, ch, sh by adding es', () => {
        expect(deriveApiPath('accounting.tax')).toBe('/accounting/taxes/');
        expect(deriveApiPath('core.process')).toBe('/core/processes/');
        expect(deriveApiPath('inventory.box')).toBe('/inventory/boxes/');
    });

    it('handles known irregulars explicitly', () => {
        expect(deriveApiPath('system.auditlog')).toBe('/system/auditlogs/');
    });
});
