import api from '@/lib/api'

export const taxApi = {
    /* Periods */
    getPeriods: () =>
        api.get('/tax/periods/', { params: { page_size: 100 } }).then(r => r.data),
    getPeriod: (id: number | string) =>
        api.get(`/tax/periods/${id}/`).then(r => r.data),
    closePeriod: (id: number) =>
        api.post(`/tax/periods/${id}/close/`).then(r => r.data),
    checkPeriodClosed: (date: string) =>
        api.get(`tax/periods/check_closed/?date=${date}`).then(r => r.data),

    /* F29 Declarations */
    getDeclarations: (params: Record<string, unknown>) =>
        api.get('/tax/declarations/', { params }).then(r => r.data),
    createDeclaration: (data: Record<string, unknown>) =>
        api.post('/tax/declarations/', data).then(r => r.data),
    calculateDeclaration: (data: { year: number; month: number }) =>
        api.post('/tax/declarations/calculate/', data).then(r => r.data),
    registerDeclaration: (id: number, data: { declaration_date: string }) =>
        api.post(`/tax/declarations/${id}/register/`, data).then(r => r.data),
    getF29Detail: (id: number | string) =>
        api.get(`/tax/f29/${id}/`).then(r => r.data),

    /* Payments */
    createPayment: (data: Record<string, unknown>) =>
        api.post('/tax/payments/', data).then(r => r.data),
}
