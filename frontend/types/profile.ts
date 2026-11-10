import type { ContactMini, Employee, Payroll, SalaryAdvance, PayrollPayment } from "@/types/hr"
import type { AppGroup } from "@/types/entities"

export interface ProfileUser {
  id: number
  username: string
  email: string
  first_name: string
  last_name: string
  is_active: boolean
  is_superuser: boolean
  groups: AppGroup[]
  permissions: string[]
  contact: number | null
  theme: 'light' | 'dark' | 'system'
}

export interface MyProfile {
  user: ProfileUser
  contact_detail: ContactMini | null
  employee: Employee | null
  payrolls: Payroll[]
  advances: SalaryAdvance[]
  payments: PayrollPayment[]
}

export interface ChangePasswordPayload {
  current_password: string
  new_password: string
}
