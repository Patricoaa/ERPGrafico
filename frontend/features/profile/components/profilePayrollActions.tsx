import { createEntityActions } from '@/components/shared'
import { Download } from 'lucide-react'

export interface ProfilePayrollActionsCtx {
    onViewDetail: (id: number) => void
    onDownloadPdf: (id: number) => void
}

export const profilePayrollActions = createEntityActions<unknown, ProfilePayrollActionsCtx>((item, ctx) => {
    const p = item as { id: number }
    return [
        {
            action: "detail",
            label: "Ver detalle",
            onClick: (e) => {
                e.stopPropagation()
                ctx.onViewDetail(p.id)
            },
        },
        {
            action: "download",
            icon: Download,
            label: "Descargar PDF",
            onClick: async (e) => {
                e.stopPropagation()
                await ctx.onDownloadPdf(p.id)
            },
        },
    ]
})
