import { useQuery } from '@tanstack/react-query'
import { getPayrolls, getPayroll, getPayrollConcepts, getPayrollPayments } from '../api/hrApi'
import { getEmployeePayrollPreview } from '@/features/profile/api/profileApi'
import type {Payroll, PayrollConcept} from '@/types/hr'
import type { FilterState } from '@/components/shared'

export const PAYROLLS_QUERY_KEY = ['hr', 'payrolls'] as const

export function usePayrolls(filters?: FilterState) {
    const { data, isLoading, refetch } = useQuery({
        queryKey: [...PAYROLLS_QUERY_KEY, filters],
        queryFn: (): Promise<Payroll[]> => {
            const params: Record<string, string> = {}
            if (filters?.search) params.search = filters.search
            if (filters?.status) params.status = filters.status
            if (filters?.period_year) params.period_year = filters.period_year
            return getPayrolls(Object.keys(params).length ? params : undefined)
        },
        staleTime: 2 * 60 * 1000,
    })

    return {
        payrolls: data ?? [],
        isLoading,
        refetch,
    }
}

export type EmployeeBasic = {
    id: number
    contact_detail?: { name?: string; tax_id?: string }
    position?: string
    department?: string
}

export function usePayrollDetail(payrollId: number, viewMode: 'admin' | 'employee' = 'admin', employee?: EmployeeBasic) {
    return useQuery({
        queryKey: [...PAYROLLS_QUERY_KEY, 'detail', payrollId, viewMode],
        queryFn: async () => {
            if (viewMode === 'employee') {
                const pData = await getEmployeePayrollPreview(payrollId)
                if (employee && pData) {
                    pData.employee_detail = pData.employee_detail || {
                        contact_detail: employee.contact_detail,
                        position: employee.position,
                        department: employee.department
                    }
                }
                return { payroll: pData, concepts: [] as PayrollConcept[], payments: pData.payments || [] }
            } else {
                const [pData, cData, pmtData] = await Promise.all([
                    getPayroll(payrollId),
                    getPayrollConcepts(),
                    getPayrollPayments({ payroll: String(payrollId) })
                ])
                return { payroll: pData, concepts: cData, payments: pmtData }
            }
        },
        enabled: !!payrollId,
    })
}
