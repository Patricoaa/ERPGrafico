import { createEntityFields } from '@/components/shared'
import type { CreditContact } from './api/creditsApi'
export const creditContactFields = createEntityFields<CreditContact>()({
    name: {
        order: 10,
        key: 'name',
        type: 'text',
        label: 'Cliente',
        tableOptions: { align: 'left' },
    },
    creditRiskLevel: {
        order: 20,
        key: 'credit_risk_level',
        type: 'status',
        label: 'Riesgo',
        getLabel: (c) => {
            const r = c.credit_risk_level;
            return r === 'LOW' ? 'Bajo' : r === 'MEDIUM' ? 'Medio' : r === 'HIGH' ? 'Alto' : 'Crítico'
        },
    },
    creditLimit: {
        order: 30,
        key: 'credit_limit',
        type: 'currency',
        label: 'Límite',
    },
    creditBalanceUsed: {
        order: 40,
        key: 'credit_balance_used',
        type: 'currency',
        label: 'Utilizado',
    },
    currentAging: {
        order: 50,
        key: 'current',
        type: 'currency',
        label: 'Vigente',
        get: (c) => c.credit_aging?.current || 0,
    },
    overdueAging: {
        order: 60,
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
        order: 70,
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
        order: 80,
        key: 'credit_last_evaluated',
        type: 'date',
        label: 'Bloqueado desde',
    },
})
