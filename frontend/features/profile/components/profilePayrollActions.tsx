import { createEntityActions } from '@/components/shared'
import type { Payroll } from '@/types/hr'
import { Download } from 'lucide-react'

export interface ProfilePayrollActionsCtx {
    onViewDetail: (id: number) => void
    onViewPayments: (payroll: Payroll) => void
    onDownloadPdf: (id: number) => void
}

export const profilePayrollActions = createEntityActions<Payroll, ProfilePayrollActionsCtx>((payroll, ctx) => [
    {
        action: "detail",
        label: "Ver detalle",
        onClick: (e) => {
            e.stopPropagation()
            ctx.onViewDetail(payroll.id)
        },
    },
    {
        action: "history",
        label: "Ver pagos",
        onClick: (e) => {
            e.stopPropagation()
            ctx.onViewPayments(payroll)
        },
    },
    {
        action: "download",
        icon: Download,
        label: "Descargar PDF",
        onClick: async (e) => {
            e.stopPropagation()
            await ctx.onDownloadPdf(payroll.id)
        },
    },
])
