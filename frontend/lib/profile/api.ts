import api from "@/lib/api"
import type { MyProfile, ChangePasswordPayload } from "@/types/profile"

export async function getMyProfile(): Promise<MyProfile> {
  const res = await api.get('/core/auth/my-profile/')
  return res.data
}

export async function getEmployeePayrollPreview(payrollId: number | string): Promise<any> {
    const res = await api.get(`/core/auth/my-profile/payrolls/${payrollId}/preview/`)
    return res.data
}

export async function changePassword(data: ChangePasswordPayload): Promise<{ detail: string }> {
  const res = await api.post('/core/auth/change-password/', data)
  return res.data
}

export function getPayrollPdfUrl(payrollId: number): string {
  const baseURL = api.defaults.baseURL || ''
  return `${baseURL}/hr/payrolls/${payrollId}/download_pdf/`
}

export async function downloadPayrollPdf(payrollId: number, filename?: string): Promise<void> {
  const res = await api.get(`/hr/payrolls/${payrollId}/download_pdf/`, {
    responseType: 'blob'
  })
  const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename || `Liquidacion_${payrollId}.pdf`
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}

export async function downloadMultiplePayrollPdfs(payrollIds: number[]): Promise<void> {
  // Download each PDF sequentially with a small delay to avoid overwhelming the server
  for (const id of payrollIds) {
    await downloadPayrollPdf(id)
    await new Promise(resolve => setTimeout(resolve, 300))
  }
}
