import api from '@/lib/api'
import { toPage, type Page } from '@/lib/pagination'

export const taxApi = {
    /* Periods */
    getPeriods: async (): Promise<Page<unknown>> => {
        const res = await api.get('/tax/periods/', { params: { page_size: 100 } })
        return toPage(res.data, 1, 100)
    },
    getPeriod: (id: number | string) =>
        api.get(`/tax/periods/${id}/`).then(r => r.data),
    closePeriod: (id: number, idempotencyKey?: string) =>
        api.post(`/tax/periods/${id}/close/`, undefined, {
            headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
        }).then(r => r.data),
    reopenPeriod: (params: { id: number; reason?: string }) =>
        api.post(`/tax/periods/${params.id}/reopen/`, { reason: params.reason }).then(r => r.data),
    checkPeriodClosed: (date: string) =>
        api.get(`tax/periods/check_closed/?date=${date}`).then(r => r.data),

    /* F29 Declarations */
    getDeclarations: async (params: Record<string, unknown>): Promise<Page<unknown>> => {
        const res = await api.get('/tax/declarations/', { params })
        return toPage(res.data, (params.page as number) ?? 1, (params.page_size as number) ?? 50)
    },
    createDeclaration: (data: Record<string, unknown>) =>
        api.post('/tax/declarations/', data).then(r => r.data),
    calculateDeclaration: (data: { year: number; month: number }) =>
        api.post('/tax/declarations/calculate/', data).then(r => r.data),
    registerDeclaration: (id: number, data: { declaration_date: string }, idempotencyKey?: string) =>
        api.post(`/tax/declarations/${id}/register/`, data, {
            headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
        }).then(r => r.data),
    getF29Detail: (id: number | string) =>
        api.get(`/tax/f29/${id}/`).then(r => r.data),

    /* Payments */
    createPayment: (data: Record<string, unknown>) =>
        api.post('/tax/payments/', data).then(r => r.data),

    /* Documents */
    attachDeclarationDocument: (declarationId: number, file: File) => {
        const formData = new FormData()
        formData.append('document', file)
        return api.post(`/tax/f29-declarations/${declarationId}/attach_document/`, formData, {
            headers: { 'Content-Type': undefined },
        }).then(r => r.data)
    },
}
