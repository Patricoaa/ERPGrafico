import { createEntityActions } from '@/components/shared'
import type { POSSession } from './components/POSSessionsClientView'
import { Download, Eye, Lock } from "lucide-react"

export interface POSSessionActionsCtx {
    onOpen: (session: POSSession) => void
    onDownloadReport: (session: POSSession, type: 'X' | 'Z') => void
    onCloseRegister: (session: POSSession) => void
    canClose: (session: POSSession) => boolean
}

export const posSessionActions = createEntityActions<
    POSSession,
    POSSessionActionsCtx
>((item, ctx) => {
    const isOpen = item.status === 'OPEN'

    return [
        {
            action: "view",
            icon: Eye,
            label: "Ver sesión",
            onClick: () => ctx.onOpen(item),
        },
        { separator: true },
        {
            action: "report",
            icon: Download,
            label: "Descargar reporte X",
            className: "text-info",
            onClick: () => ctx.onDownloadReport(item, 'X'),
            visible: isOpen,
        },
        {
            action: "report",
            icon: Download,
            label: "Descargar reporte Z",
            className: "text-success",
            onClick: () => ctx.onDownloadReport(item, 'Z'),
            visible: !isOpen,
        },
        {
            action: "lock",
            icon: Lock,
            label: "Cerrar sesión de POS",
            className: "text-destructive",
            onClick: () => ctx.onCloseRegister(item),
            visible: isOpen && ctx.canClose(item),
        },
    ]
})
