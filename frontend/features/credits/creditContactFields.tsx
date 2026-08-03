import { createEntityFields, DataCell } from '@/components/shared'
import { AlertCircle } from 'lucide-react'
import type { CreditContact } from './api/creditsApi'

const RISK_STATUS: Record<CreditContact['credit_risk_level'], string> = {
    LOW: 'RISK_LOW',
    MEDIUM: 'RISK_MEDIUM',
    HIGH: 'RISK_HIGH',
    CRITICAL: 'RISK_CRITICAL',
}

const RISK_LABEL: Record<CreditContact['credit_risk_level'], string> = {
    LOW: 'Bajo',
    MEDIUM: 'Medio',
    HIGH: 'Alto',
    CRITICAL: 'Crítico',
}

export const creditContactFields = createEntityFields<CreditContact>()({
    name: {
        key: 'name',
        type: 'computed',
        label: 'Cliente',
        tableOptions: { align: 'center' },
        render: (c) => (
            <DataCell.ContactLink contactId={c.id}>
                {c.name}
                {c.credit_auto_blocked && <AlertCircle className="h-3 w-3 text-warning ml-2" />}
            </DataCell.ContactLink>
        ),
    },
    creditRiskLevel: {
        key: 'credit_risk_level',
        type: 'status',
        label: 'Riesgo',
        get: (c) => RISK_STATUS[c.credit_risk_level],
        getLabel: (c) => RISK_LABEL[c.credit_risk_level],
    },
    creditLimit: {
        key: 'credit_limit',
        type: 'currency',
        label: 'Límite',
    },
    creditBalanceUsed: {
        key: 'credit_balance_used',
        type: 'currency',
        label: 'Utilizado',
    },
    currentAging: {
        key: 'current',
        type: 'currency',
        label: 'Vigente',
        get: (c) => c.credit_aging?.current || 0,
    },
    overdueAging: {
        key: 'overdue',
        type: 'currency',
        label: 'En Mora',
        get: (c) => {
            const aging = c.credit_aging;
            if (!aging) return 0;
            return Number(aging.overdue_30) + Number(aging.overdue_60) + Number(aging.overdue_90) + Number(aging.overdue_90plus);
        },
        showZeroAsDash: true,
    },
    status: {
        key: 'status',
        type: 'status',
        label: 'Estado',
        get: (c) => {
            const totalDebt = Number(c.credit_balance_used)
            const aging = c.credit_aging
            const hasOverdue = aging ? Number(aging.overdue_30) + Number(aging.overdue_60) + Number(aging.overdue_90) + Number(aging.overdue_90plus) > 0 : false
            if (c.credit_blocked) return "ERROR"
            if (c.credit_auto_blocked) return "WARNING"
            if (hasOverdue) return "WARNING"
            if (totalDebt > 0) return "INFO"
            return "SUCCESS"
        },
        getLabel: (c) => {
            const totalDebt = Number(c.credit_balance_used)
            const aging = c.credit_aging
            const hasOverdue = aging ? Number(aging.overdue_30) + Number(aging.overdue_60) + Number(aging.overdue_90) + Number(aging.overdue_90plus) > 0 : false
            if (c.credit_blocked) return "Bloqueado"
            if (c.credit_auto_blocked) return "Auto-Bloqueo"
            if (hasOverdue) return "En mora"
            if (totalDebt > 0) return "Activo"
            return "Al día"
        }
    },
    creditLastEvaluated: {
        key: 'credit_last_evaluated',
        type: 'dateTime',
        label: 'Bloqueado desde',
    },
})
