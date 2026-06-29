import { DataCell, createEntityActions } from '@/components/shared'
import type { POSSession } from './components/POSSessionsClientView'
import { FileText, Lock } from "lucide-react"

export interface POSSessionActionsCtx {
    onReport: (session: POSSession, type: 'X' | 'Z') => void
    onCloseRegister: (session: POSSession) => void
}

export const posSessionActions = createEntityActions<
    POSSession,
    POSSessionActionsCtx
>((item, ctx) => (
    <>
        {item.status === 'OPEN' ? (
            <>
                <DataCell.Action
                    icon={FileText}
                    title="Reporte X"
                    className="text-info"
                    onClick={() => ctx.onReport(item, 'X')}
                />
                <DataCell.Action
                    icon={Lock}
                    title="Cerrar Caja"
                    className="text-destructive"
                    onClick={() => ctx.onCloseRegister(item)}
                />
            </>
        ) : (
            <DataCell.Action
                icon={FileText}
                title="Reporte Z"
                className="text-success"
                onClick={() => ctx.onReport(item, 'Z')}
            />
        )}
    </>
))
