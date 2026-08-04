import { createEntityActions } from '@/components/shared'
import { Gavel } from 'lucide-react'
import type { CreditContact } from './api/creditsApi'

export interface PortfolioActionsCtx {
    onEdit: (id: number) => void
    onWriteOff: (contact: CreditContact) => void
    canWriteOff: (contact: CreditContact) => boolean
}

export const portfolioActions = createEntityActions<
    CreditContact,
    PortfolioActionsCtx
>((contact, ctx) => [
    { action: "edit", onClick: () => ctx.onEdit(contact.id) },
    {
        action: "delete",
        icon: Gavel,
        label: "Castigar Deuda",
        iconColor: "text-destructive",
        visible: ctx.canWriteOff(contact),
        onClick: () => ctx.onWriteOff(contact),
    },
])
