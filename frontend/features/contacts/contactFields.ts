import { createEntityFields } from '@/components/shared'
import type { Contact } from '@/features/contacts/types'

export const contactFields = createEntityFields<Contact>()({
    display_id: { key: 'display_id', type: 'code', label: 'Código Interno' },
    email: { key: 'email', type: 'text', label: 'Email' },
    phone: { key: 'phone', type: 'text', label: 'Teléfono' },
    credit_limit: { 
        key: 'credit_limit', 
        type: 'currency', 
        label: 'Crédito', 
        get: (c) => Number(c.credit_limit || 0) > 0 ? Number(c.credit_limit) : null,
        suffix: (c) => Number(c.credit_limit || 0) > 0 ? ` (${c.credit_days}d)` : ''
    },
    activeRoles: {
        key: 'active_roles',
        type: 'chip-category',
        label: 'Roles',
        domain: 'contact_type',
        get: (c) => c.active_roles ?? [],
    },
    isDefaultCustomer: {
        key: 'is_default_customer',
        type: 'chip',
        label: '',
        get: (c) => c.is_default_customer ? 'Cliente' : null,
        intent: 'primary',
    },
    isDefaultVendor: {
        key: 'is_default_vendor',
        type: 'chip',
        label: '',
        get: (c) => c.is_default_vendor ? 'Proveedor' : null,
        intent: 'success',
    },
})
