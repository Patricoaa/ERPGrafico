import api from '@/lib/api'

export interface ChecklistItem {
    id: number
    fiscal_year: number
    code: string
    name: string
    description: string
    category: string
    category_display: string
    is_required: boolean
    order: number
    is_completed: boolean
    completed_at: string | null
    completed_by: number | null
    completed_by_username: string | null
    notes: string
}

export async function fetchChecklist(year: number): Promise<ChecklistItem[]> {
    const res = await api.get<ChecklistItem[]>(`/accounting/fiscal-years/${year}/checklist/`)
    return res.data
}

export async function updateChecklistItem(year: number, itemId: number, data: { is_completed: boolean; notes?: string }): Promise<ChecklistItem> {
    const res = await api.patch<ChecklistItem>(`/accounting/fiscal-years/${year}/checklist/${itemId}/`, data)
    return res.data
}
