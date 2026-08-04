import { createEntityFields } from '@/components/shared'
import { DataCell } from '@/components/shared'
import type { Contact } from '@/features/contacts/types'
import { formatRUT } from '@/lib/utils/format'
import { Building2, User as UserIcon } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

function ContactRoleIcons({ contact }: { contact: Contact }) {
    const hasCustomer = contact.is_default_customer
    const hasVendor = contact.is_default_vendor
    if (!hasCustomer && !hasVendor) return null

    return (
        <div className="flex items-center gap-1 shrink-0">
            {hasCustomer && (
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 text-primary">
                                <UserIcon className="h-3 w-3" />
                            </span>
                        </TooltipTrigger>
                        <TooltipContent className="rounded-sm">Cliente por defecto</TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            )}
            {hasVendor && (
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-success/15 text-success">
                                <Building2 className="h-3 w-3" />
                            </span>
                        </TooltipTrigger>
                        <TooltipContent className="rounded-sm">Proveedor por defecto</TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            )}
        </div>
    )
}

export const contactFields = createEntityFields<Contact>()({
    name: {
        key: 'name',
        type: 'computed',
        label: 'Nombre',
        render: (c) => (
            <div className="flex items-center justify-center gap-2 w-full">
                <ContactRoleIcons contact={c} />
                <DataCell.Text>{c.name}</DataCell.Text>
            </div>
        ),
    },
    tax_id: {
        key: 'tax_id',
        type: 'text',
        label: 'RUT / Identificación',
        tableOptions: { align: 'center' },
        get: (c) => c.tax_id ? formatRUT(c.tax_id) : 'S/Rut',
    },
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
