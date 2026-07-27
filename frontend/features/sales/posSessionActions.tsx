import { createEntityActions } from '@/components/shared'
import type { POSSession } from './components/POSSessionsClientView'
import { FileText, Lock } from "lucide-react"

export interface POSSessionActionsCtx {
    onReport: (session: POSSession, type: 'X' | 'Z') => void
    onCloseRegister: (session: POSSession) => void
}

export const posSessionActions = createEntityActions<
    POSSession,
    POSSessionActionsCtx
>((item, ctx) => {
    const isOpen = item.status === 'OPEN'

    return [
        {
            action: "report",
            icon: FileText,
            label: "Reporte X",
            className: "text-info",
            onClick: () => ctx.onReport(item, 'X'),
            visible: isOpen,
        },
        {
            action: "lock",
            icon: Lock,
            label: "Cerrar Sesión",
            className: "text-destructive",
            onClick: () => ctx.onCloseRegister(item),
            visible: isOpen,
        },
        {
            action: "report",
            icon: FileText,
            label: "Reporte Z",
            className: "text-success",
            onClick: () => ctx.onReport(item, 'Z'),
            visible: !isOpen,
        },
    ]
})
