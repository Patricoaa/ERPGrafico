import { createEntityActions } from '@/components/shared'
import { Wallet, Coins, CreditCard } from 'lucide-react'
import type { Payroll } from '@/types/hr'

export interface PayrollActionsCtx {
    onViewDetail: (id: number) => void
    onAssignDeductions: (payroll: Payroll) => void
    onPaySalary: (payroll: Payroll) => void
    onPayPrevired: (payroll: Payroll) => void
    onDeleteDraft: (id: number) => void
}

export const payrollActions = createEntityActions<
    Payroll,
    PayrollActionsCtx
>((item, ctx) => [
    { action: "detail", label: "Ver Detalle", onClick: () => ctx.onViewDetail(item.id) },
    {
        action: "detail",
        icon: Wallet,
        label: "Asignar anticipos y préstamos",
        className: "text-primary hover:text-primary",
        onClick: () => ctx.onAssignDeductions(item),
        visible: item.status === 'DRAFT',
    },
    {
        action: "pay",
        icon: Coins,
        label: "Registrar Pago Sueldo",
        className: "text-success-text hover:text-success-text",
        onClick: () => ctx.onPaySalary(item),
        visible: item.status === 'POSTED' && (item as Payroll & Record<string, string>).remuneration_paid_status !== 'PAID',
    },
    {
        action: "pay",
        icon: CreditCard,
        label: "Pagar Previred",
        className: "text-warning-text hover:text-warning-text",
        onClick: () => ctx.onPayPrevired(item),
        visible: item.status === 'POSTED' && (item as Payroll & Record<string, string>).previred_paid_status !== 'PAID',
    },
    {
        action: "delete",
        label: "Eliminar borrador",
        className: "text-destructive hover:text-destructive",
        onClick: () => ctx.onDeleteDraft(item.id),
        visible: item.status === 'DRAFT',
    },
])
