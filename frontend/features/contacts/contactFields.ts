import { createEntityFields } from '@/components/shared'
import type { Contact } from '@/features/contacts/types'

export const contactFields = createEntityFields<Contact>()({
    name: { key: 'name', type: 'text', label: 'Nombre' },
    tax_id: { key: 'tax_id', type: 'code', label: 'RUT', tableOptions: { align: 'center' } },
    display_id: { key: 'display_id', type: 'code', label: 'Código Interno' },
    email: { key: 'email', type: 'text', label: 'Email' },
    phone: { key: 'phone', type: 'text', label: 'Teléfono' },
    activeRoles: {
        key: 'active_roles',
        type: 'chip-category',
        label: 'Roles',
        domain: 'contact_type',
        get: (c) => c.active_roles ?? [],
    },
})
