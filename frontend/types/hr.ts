// HR TypeScript types

export type EmployeeStatus = 'ACTIVE' | 'INACTIVE'
export type PayrollStatus = 'DRAFT' | 'POSTED'
export type ContractType = 'INDEFINIDO' | 'PLAZO_FIJO'
export type SaludType = 'FONASA' | 'ISAPRE'

export type ConceptCategory = 
  | 'HABER_IMPONIBLE' 
  | 'HABER_NO_IMPONIBLE' 
  | 'DESCUENTO_LEGAL_TRABAJADOR' 
  | 'DESCUENTO_LEGAL_EMPLEADOR'
  | 'OTRO_DESCUENTO'

export type FormulaType = 'FIXED' | 'PERCENTAGE' | 'EMPLOYEE_SPECIFIC' | 'FORMULA' | 'CHILEAN_LAW'
export type AbsenceType = 'AUSENTISMO' | 'LICENCIA' | 'PERMISO_SIN_GOCE' | 'AUSENCIA_HORAS'

export interface GlobalHRSettings {
  id: number
  uf_current_value: string
  utm_current_value: string
  account_remuneraciones_por_pagar: number | null
  account_previred_por_pagar: number | null
  account_anticipos: number | null
}

export interface AFP {
  id: number
  name: string
  slug: string
  percentage: string
  account: number | null
  is_active: boolean
}

export interface PayrollConcept {
  id: number
  name: string
  category: ConceptCategory
  category_display: string
  account: number
  account_code?: string
  account_name?: string
  formula_type: FormulaType
  formula_type_display: string
  formula: string
  default_amount: string
  is_system: boolean
}

export interface EmployeeConceptAmount {
  id: number
  employee: number
  concept: number
  concept_name?: string
  amount: string
}

export interface ContactMini {
  id: number
  name: string
  tax_id: string
  display_id: string
  phone: string
  email: string
  is_partner?: boolean
}

export interface Employee {
  id: number
  code: string
  display_id: string
  contact: number
  contact_detail: ContactMini
  position: string
  department: string
  start_date: string | null
  end_date: string | null
  status: EmployeeStatus
  status_display: string
  contract_type: ContractType
  contract_type_display: string
  base_salary: string
  afp: number | null
  afp_detail?: AFP
  salud_type: SaludType
  salud_type_display: string
  isapre_amount_uf: string
  jornada_type_display?: string
  asignacion_familiar_display?: string
  concept_amounts?: EmployeeConceptAmount[]
  created_at: string
  updated_at: string
}

export interface Absence {
  id: number
  employee: number
  employee_name?: string
  absence_type: AbsenceType
  absence_type_display: string
  start_date: string
  end_date: string
  days: number
  notes: string
  created_at: string
  updated_at: string
}

export interface PayrollItem {
  id: number
  payroll: number
  concept: number
  concept_detail?: PayrollConcept
  description: string
  amount: string
  is_previred: boolean
}

export interface Payroll {
  id: number
  number: string
  display_id: string
  employee: number
  employee_name?: string
  employee_display_id?: string
  employee_detail?: Employee
  period_year: number
  period_month: number
  period_label: string
  status: PayrollStatus
  status_display: string
  agreed_days: number
  absent_days: number
  worked_days: number
  base_salary: string
  total_haberes: string
  total_descuentos: string
  net_salary: string
  journal_entry: number | null
  previred_journal_entry: number | null
  items?: PayrollItem[]
  advances?: SalaryAdvance[]
  payments?: PayrollPayment[]
  notes: string
  created_at: string
  updated_at: string
}

export interface SalaryAdvance {
  id: number
  employee: number
  employee_name?: string
  employee_display_id?: string
  payroll: number | null
  payroll_display_id?: string
  amount: string
  date: string
  notes: string
  is_discounted: boolean
  journal_entry: number | null
  payment_method_name?: string | null
  created_at: string
  updated_at: string
}

export type PaymentType = 'SALARIO' | 'PREVIRED'

export interface PayrollPayment {
  id: number
  payroll: number
  payroll_display_id?: string
  employee_name?: string
  payment_type: PaymentType
  payment_type_display?: string
  amount: string
  date: string
  notes: string
  journal_entry: number | null
  created_at: string
  updated_at: string
}

// Legacy support or constants if needed
export const CATEGORY_LABELS: Record<ConceptCategory, string> = {
  HABER_IMPONIBLE: 'Haber Imponible',
  HABER_NO_IMPONIBLE: 'Haber No Imponible',
  DESCUENTO_LEGAL_TRABAJADOR: 'Desc. Legal (Trabajador)',
  DESCUENTO_LEGAL_EMPLEADOR: 'Aporte del Empleador',
  OTRO_DESCUENTO: 'Otro Descuento',
}
