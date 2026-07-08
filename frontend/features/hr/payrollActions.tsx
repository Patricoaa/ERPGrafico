import { DataCell, createEntityActions } from '@/components/shared'
import { Eye, Wallet, Coins, CreditCard, Trash2 } from 'lucide-react'
import type { Payroll } from '@/types/hr'

export interface PayrollActionsCtx {
    onViewDetail: (id: number) => void
    onRegisterAdvance: (payroll: Payroll) => void
    onPaySalary: (payroll: Payroll) => void
    onPayPrevired: (payroll: Payroll) => void
    onDeleteDraft: (id: number) => void
}

export const payrollActions = createEntityActions<
    Payroll,
    PayrollActionsCtx
>((item, ctx) => (
    <>
        <DataCell.Action icon={Eye} title="Ver Detalle" onClick={() => ctx.onViewDetail(item.id)} />
        {item.status === 'DRAFT' && (
            <DataCell.Action icon={Wallet} title="Registrar Anticipo" className="text-primary hover:text-primary" onClick={() => ctx.onRegisterAdvance(item)} />
        )}
        {item.status === 'POSTED' && (item as Payroll & Record<string, string>).remuneration_paid_status !== 'PAID' && (
            <DataCell.Action icon={Coins} title="Registrar Pago Sueldo" className="text-success hover:text-success" onClick={() => ctx.onPaySalary(item)} />
        )}
        {item.status === 'POSTED' && (item as Payroll & Record<string, string>).previred_paid_status !== 'PAID' && (
            <DataCell.Action icon={CreditCard} title="Pagar Previred" className="text-warning hover:text-warning" onClick={() => ctx.onPayPrevired(item)} />
        )}
        {item.status === 'DRAFT' && (
            <DataCell.Action icon={Trash2} title="Eliminar borrador" className="text-destructive hover:text-destructive" onClick={() => ctx.onDeleteDraft(item.id)} />
        )}
    </>
))
