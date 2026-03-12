import api from "@/lib/api"
import type { 
  Employee, 
  Payroll, 
  PayrollItem, 
  GlobalHRSettings, 
  AFP, 
  PayrollConcept,
  EmployeeConceptAmount,
  Absence
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
  const res = await api.get('/hr/afps/')
  return res.data.results ?? res.data
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
  const res = await api.get('/hr/concepts/', { params })
  return res.data.results ?? res.data
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
  const res = await api.get('/hr/employees/', { params })
  return res.data.results ?? res.data
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

export async function deleteEmployee(id: number): Promise<void> {
  await api.delete(`/hr/employees/${id}/`)
}

// ---- Absences ----
export async function getAbsences(params?: Record<string, string>): Promise<Absence[]> {
  const res = await api.get('/hr/absences/', { params })
  return res.data.results ?? res.data
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
  const res = await api.get('/hr/payrolls/', { params })
  return res.data.results ?? res.data
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
