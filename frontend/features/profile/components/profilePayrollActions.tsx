import { DataCell, createEntityActions } from '@/components/shared'
import { Eye, FileDown } from 'lucide-react'

export interface ProfilePayrollActionsCtx {
    onViewDetail: (id: number) => void
    onDownloadPdf: (id: number) => void
}

export const profilePayrollActions = createEntityActions<unknown, ProfilePayrollActionsCtx>((item, ctx) => {
    const p = item as { id: number }
    return (
        <>
            <DataCell.Action
                icon={Eye}
                title="Ver detalle"
                onClick={(e) => {
                    e.stopPropagation()
                    ctx.onViewDetail(p.id)
                }}
            />
            <DataCell.Action
                icon={FileDown}
                title="Descargar PDF"
                onClick={async (e) => {
                    e.stopPropagation()
                    await ctx.onDownloadPdf(p.id)
                }}
            />
        </>
    )
})
