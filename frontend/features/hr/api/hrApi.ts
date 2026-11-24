import api from "@/lib/api"
import { generateUuidV4 } from "@/lib/uuid"
import { fetchBoundedList } from "@/lib/bounded-list"
import type { 
  Employee, 
  Payroll, 
  PayrollItem, 
  GlobalHRSettings, 
  AFP, 
  PayrollConcept,
  Absence,
  PayrollPayment,
  EmployeeMovement,
  LoanSchedulePreviewRequest,
  LoanSchedulePreviewRow,
} from "@/types/hr"

// ---- Global HR Settings (Singleton) ----
export async function getGlobalHRSettings(): Promise<GlobalHRSettings> {
  const res = await api.get('/hr/global-settings/current/')
  return res.data
}

export async function updateGlobalHRSettings(data: Partial<GlobalHRSettings>): Promise<GlobalHRSettings> {
  const res = await api.patch('/hr/global-settings/current/', data)
  return res.data
}

// ---- AFPs ----
export async function getAFPs(): Promise<AFP[]> {
  const res = await api.get<AFP[]>('/hr/afps/')
  // eslint-disable-next-line pagination/no-raw-response-data -- master data, no pagination
  return res.data
}

export async function createAFP(data: Partial<AFP>): Promise<AFP> {
  const res = await api.post('/hr/afps/', data)
  return res.data
}

export async function updateAFP(id: number, data: Partial<AFP>): Promise<AFP> {
  const res = await api.patch(`/hr/afps/${id}/`, data)
  return res.data
}

export async function deleteAFP(id: number): Promise<void> {
  await api.delete(`/hr/afps/${id}/`)
}

// ---- Payroll Concepts ----
export async function getPayrollConcepts(params?: Record<string, string>): Promise<PayrollConcept[]> {
  const res = await api.get<PayrollConcept[]>('/hr/concepts/', { params })
  // eslint-disable-next-line pagination/no-raw-response-data -- master data, no pagination
  return res.data
}

export async function createPayrollConcept(data: Partial<PayrollConcept>): Promise<PayrollConcept> {
  const res = await api.post('/hr/concepts/', data)
  return res.data
}

export async function updatePayrollConcept(id: number, data: Partial<PayrollConcept>): Promise<PayrollConcept> {
  const res = await api.patch(`/hr/concepts/${id}/`, data)
  return res.data
}

export async function deletePayrollConcept(id: number): Promise<void> {
  await api.delete(`/hr/concepts/${id}/`)
}

// ---- Employees ----
export async function getEmployees(params?: Record<string, string>): Promise<Employee[]> {
  return fetchBoundedList<Employee>('/hr/employees/', params)
}

export async function getEmployee(id: number): Promise<Employee> {
  const res = await api.get(`/hr/employees/${id}/`)
  return res.data
}

export async function createEmployee(data: Partial<Employee>): Promise<Employee> {
  const res = await api.post('/hr/employees/', data)
  return res.data
}

export async function updateEmployee(id: number, data: Partial<Employee>): Promise<Employee> {
  const res = await api.patch(`/hr/employees/${id}/`, data)
  return res.data
}

/** Archivo pattern: `is_active=false` (hard DELETE is blocked server-side with 405). */
export async function archiveEmployee(id: number, is_active: boolean, end_date?: string): Promise<Employee> {
  const res = await api.patch(`/hr/employees/${id}/`, end_date ? { is_active, end_date } : { is_active })
  return res.data
}

// ---- Absences ----
export async function getAbsences(params?: Record<string, string>): Promise<Absence[]> {
  const res = await api.get<{ results: Absence[] }>('/hr/absences/', { params })
  return res.data.results
}

export async function createAbsence(data: Partial<Absence>): Promise<Absence> {
  const res = await api.post('/hr/absences/', data)
  return res.data
}

export async function updateAbsence(id: number, data: Partial<Absence>): Promise<Absence> {
  const res = await api.patch(`/hr/absences/${id}/`, data)
  return res.data
}

export async function deleteAbsence(id: number): Promise<void> {
  await api.delete(`/hr/absences/${id}/`)
}

// ---- Payrolls ----
export async function getPayrolls(params?: Record<string, string>): Promise<Payroll[]> {
  const res = await api.get<{ results: Payroll[] }>('/hr/payrolls/', { params })
  return res.data.results
}

export async function getPayroll(id: number): Promise<Payroll> {
  const res = await api.get(`/hr/payrolls/${id}/`)
  return res.data
}

export async function createPayroll(data: Partial<Payroll>): Promise<Payroll> {
  const res = await api.post('/hr/payrolls/', data)
  return res.data
}

export async function updatePayroll(id: number, data: Partial<Payroll>): Promise<Payroll> {
  const res = await api.patch(`/hr/payrolls/${id}/`, data)
  return res.data
}

export async function deletePayroll(id: number): Promise<void> {
  await api.delete(`/hr/payrolls/${id}/`)
}

export async function postPayroll(id: number): Promise<Payroll> {
  const res = await api.post(`/hr/payrolls/${id}/post_payroll/`)
  return res.data
}

export async function recalculatePayroll(id: number): Promise<Payroll> {
  const res = await api.post(`/hr/payrolls/${id}/recalculate/`)
  return res.data
}

export async function generateProformaPayroll(data: { employee: number; period_year: number; period_month: number }): Promise<Payroll> {
  const res = await api.post('/hr/payrolls/generate_proforma/', data)
  return res.data
}

export async function triggerDraftPayrolls(): Promise<{ detail: string; task_id: string }> {
  const idempotencyKey = generateUuidV4()
  const res = await api.post('/hr/payrolls/create_draft_payrolls/', undefined, {
    headers: { 'Idempotency-Key': idempotencyKey },
  })
  return res.data
}

// ---- Payroll Items ----
export async function createPayrollItem(payrollId: number, data: Partial<PayrollItem>): Promise<PayrollItem> {
  const res = await api.post(`/hr/payrolls/${payrollId}/items/`, data)
  return res.data
}

export async function updatePayrollItem(payrollId: number, itemId: number, data: Partial<PayrollItem>): Promise<PayrollItem> {
  const res = await api.patch(`/hr/payrolls/${payrollId}/items/${itemId}/`, data)
  return res.data
}

export async function deletePayrollItem(payrollId: number, itemId: number): Promise<void> {
  await api.delete(`/hr/payrolls/${payrollId}/items/${itemId}/`)
}

// ---- Payroll Actions ----
export async function payPrevired(payrollId: number, data: Record<string, unknown>): Promise<PayrollPayment> {
  const res = await api.post(`/hr/payrolls/${payrollId}/pay_previred/`, data)
  return res.data
}

export async function paySalary(payrollId: number, data: Record<string, unknown>): Promise<PayrollPayment> {
  const res = await api.post(`/hr/payrolls/${payrollId}/pay_salary/`, data)
  return res.data
}

export async function getPayrollPayments(params?: Record<string, string>): Promise<PayrollPayment[]> {
  const res = await api.get<{ results: PayrollPayment[] }>('/hr/payroll-payments/', { params })
  return res.data.results
}

export async function annulPayrollPayment(id: number, reason: string): Promise<PayrollPayment> {
  const res = await api.post<PayrollPayment>(`/hr/payroll-payments/${id}/annul/`, { reason })
  return res.data
}


// ---- Employee movements (pagos, anticipos y préstamos — ADR-0156) ----
const MOVEMENTS_URL = '/hr/employee-movements/'

export async function getEmployeeMovements(params?: Record<string, string>): Promise<EmployeeMovement[]> {
  const res = await api.get<{ results: EmployeeMovement[] }>(MOVEMENTS_URL, { params })
  return res.data.results
}

export async function getEmployeeMovement(id: number): Promise<EmployeeMovement> {
  const res = await api.get<EmployeeMovement>(`${MOVEMENTS_URL}${id}/`)
  return res.data
}

export async function createEmployeeMovement(payload: Record<string, unknown>): Promise<EmployeeMovement> {
  const res = await api.post<EmployeeMovement>(MOVEMENTS_URL, payload)
  return res.data
}

export async function updateEmployeeMovement(id: number, payload: Record<string, unknown>): Promise<EmployeeMovement> {
  const res = await api.patch<EmployeeMovement>(`${MOVEMENTS_URL}${id}/`, payload)
  return res.data
}

export async function deleteEmployeeMovement(id: number): Promise<void> {
  await api.delete(`${MOVEMENTS_URL}${id}/`)
}

export async function annulEmployeeMovement(id: number, reason: string): Promise<EmployeeMovement> {
  const res = await api.post<EmployeeMovement>(`${MOVEMENTS_URL}${id}/annul/`, { reason })
  return res.data
}

export async function allocateMovement(id: number, body: { payroll: number; amount?: string }): Promise<EmployeeMovement> {
  const res = await api.post<EmployeeMovement>(`${MOVEMENTS_URL}${id}/allocate/`, body)
  return res.data
}

export async function deallocateMovement(id: number, allocationId: number): Promise<EmployeeMovement> {
  const res = await api.post<EmployeeMovement>(`${MOVEMENTS_URL}${id}/deallocate/`, { allocation: allocationId })
  return res.data
}

export async function previewLoanSchedule(body: LoanSchedulePreviewRequest): Promise<LoanSchedulePreviewRow[]> {
  const res = await api.post<LoanSchedulePreviewRow[]>(`${MOVEMENTS_URL}preview-schedule/`, body)
  return res.data
}

export async function getEmployeeMovementHistory(employeeId: number): Promise<EmployeeMovement[]> {
  const res = await api.get<{ results: EmployeeMovement[] }>(`/hr/employees/${employeeId}/movements/`)
  return res.data.results
}
