import { useState, useCallback } from "react"
import api from "@/lib/api"
import { toast } from "sonner"
import { showApiError } from "@/lib/errors"
import type { BankStatement, ReconciliationRule, TreasuryAccount } from "../types"

export function useReconciliation() {
    const [loading, setLoading] = useState(false)

    const fetchStatements = useCallback(async () => {
        setLoading(true)
        try {
            const res = await api.get('/treasury/statements/')
            return res.data
        } catch (error) {
            console.error('Error fetching statements:', error)
            showApiError(error, 'Error al cargar cartolas')
            return []
        } finally {
            setLoading(false)
        }
    }, [])

    const fetchAccounts = useCallback(async () => {
        try {
            const res = await api.get('/treasury/accounts/')
            return res.data as TreasuryAccount[]
        } catch (error) {
            console.error('Error fetching accounts:', error)
            showApiError(error, 'Error al cargar cuentas')
            return []
        }
    }, [])

    const fetchRules = useCallback(async () => {
        setLoading(true)
        try {
            const res = await api.get('/treasury/reconciliation-rules/')
            return res.data as ReconciliationRule[]
        } catch (error) {
            console.error('Error fetching rules:', error)
            showApiError(error, 'Error al cargar reglas')
            return []
        } finally {
            setLoading(false)
        }
    }, [])

    const saveRule = useCallback(async (rule: Partial<ReconciliationRule>) => {
        try {
            const payload = { ...rule, treasury_account: rule.treasury_account?.id || null }
            if (rule.id) {
                await api.patch(`/treasury/reconciliation-rules/${rule.id}/`, payload)
                toast.success('Regla actualizada')
            } else {
                await api.post('/treasury/reconciliation-rules/', payload)
                toast.success('Regla creada')
            }
            return true
        } catch (error) {
            showApiError(error, 'Error al guardar regla')
            return false
        }
    }, [])

    const createDefaultRules = useCallback(async (accountId: number) => {
        try {
            await api.post('/treasury/reconciliation-rules/create_defaults/', { treasury_account_id: accountId })
            toast.success('Reglas predeterminadas creadas')
            return true
        } catch (error) {
            showApiError(error, 'Error al crear reglas predeterminadas')
            return false
        }
    }, [])

    const fetchDashboardData = useCallback(async (selectedAccount: string = 'all') => {
        setLoading(true)
        try {
            const params = selectedAccount !== 'all' ? { treasury_account: selectedAccount } : {}
            const [kpiRes, trendRes, pendingRes] = await Promise.all([
                api.get('/treasury/reconciliation-reports/dashboard/', { params }),
                api.get('/treasury/reconciliation-reports/history/', { params }),
                api.get('/treasury/reconciliation-reports/pending/', { params })
            ])
            return {
                stats: kpiRes.data,
                trend: trendRes.data,
                pending: pendingRes.data
            }
        } catch (error) {
            console.error("Error loading dashboard", error)
            return null
        } finally {
            setLoading(false)
        }
    }, [])

    return {
        loading,
        fetchStatements,
        fetchAccounts,
        fetchRules,
        saveRule,
        createDefaultRules,
        fetchDashboardData
    }
}
