import api from '@/lib/api'

export const posApi = {
    // ── Drafts ──
    getDrafts: async (params?: Record<string, unknown>) => {
        const { data } = await api.get<{ results: Record<string, unknown>[] }>('/sales/pos-drafts/', { params })
        return data.results
    },
    getDraft: (id: number, params?: Record<string, unknown>) =>
        api.get(`/sales/pos-drafts/${id}/`, { params }).then(r => r.data),
    createDraft: (payload: Record<string, unknown>) =>
        api.post('/sales/pos-drafts/', payload).then(r => r.data),
    updateDraft: (id: number, payload: Record<string, unknown>) =>
        api.put(`/sales/pos-drafts/${id}/`, payload).then(r => r.data),
    deleteDraft: (id: number, params?: Record<string, unknown>) =>
        api.delete(`/sales/pos-drafts/${id}/`, { params }).then(r => r.data),
    syncDrafts: (params?: Record<string, unknown>) =>
        api.get('/sales/pos-drafts/sync/', { params }).then(r => r.data),
    lockDraft: (id: number, payload?: Record<string, unknown>) =>
        api.post(`/sales/pos-drafts/${id}/lock/`, payload).then(r => r.data),
    unlockDraft: (id: number, payload?: Record<string, unknown>) =>
        api.post(`/sales/pos-drafts/${id}/unlock/`, payload).then(r => r.data),
    withdrawDraft: (id: number, payload?: Record<string, unknown>) =>
        api.post(`/sales/pos-drafts/${id}/withdraw/`, payload).then(r => r.data),

    // ── Pricing ──
    getEffectiveSalePrice: (params?: Record<string, unknown>) =>
        api.get('/sales/pricing/effective-sale-price/', { params }).then(r => r.data),

    // ── Inventory ──
    getProduct: (id: number) =>
        api.get(`/inventory/products/${id}/`).then(r => r.data),
    toggleFavorite: (productId: number) =>
        api.post(`/inventory/products/${productId}/toggle_favorite/`).then(r => r.data),

    // ── UoMs ──
    getUoms: (params?: Record<string, unknown>) =>
        api.get('/inventory/uoms/', { params }).then(r => r.data),

    // ── POS Sessions ──
    getSessions: async (params?: Record<string, unknown>) => {
        const { data } = await api.get<{ results: Record<string, unknown>[] }>('/treasury/pos-sessions/', { params })
        return data.results
    },
    getCurrentSession: () =>
        api.get('/treasury/pos-sessions/current/').then(r => r.data),
    getSession: (id: number) =>
        api.get(`/treasury/pos-sessions/${id}/`).then(r => r.data),
    getSessionSummary: (id: number) =>
        api.get(`/treasury/pos-sessions/${id}/summary/`).then(r => r.data),
    getSessionPdf: (id: number, type: "X" | "Z") =>
        api.get(`/treasury/pos-sessions/${id}/pdf/`, {
            params: { type },
            responseType: 'blob',
        }).then(r => r.data),
    openSession: (payload: Record<string, unknown>) =>
        api.post('/treasury/pos-sessions/open_session/', payload).then(r => r.data),
    closeSession: (id: number, payload: Record<string, unknown>) =>
        api.post(`/treasury/pos-sessions/${id}/close_session/`, payload).then(r => r.data),
    registerManualMovement: (id: number, payload: Record<string, unknown>) =>
        api.post(`/treasury/pos-sessions/${id}/register_manual_movement/`, payload).then(r => r.data),

    // ── Terminals ──
    getTerminals: () =>
        api.get('/treasury/pos-terminals/').then(r => r.data),

    // ── Treasury Accounts ──
    getTreasuryAccount: (id: number) =>
        api.get(`/treasury/accounts/${id}/`).then(r => r.data),

    // ── Accounting Settings ──
    getAccountingSettings: () =>
        api.get('/accounting/settings/current/').then(r => r.data),

    // ── Contacts ──
    getDefaultCustomer: () =>
        api.get<{ results: Array<{ is_default_customer: boolean }> }>('/contacts/?is_default_customer=true').then(r => {
            const data = r.data
            const results = Array.isArray(data) ? data : (data?.results ?? [])
            return results.find((c) => c.is_default_customer) ?? null
        }),
    getContact: (id: number) =>
        api.get(`/contacts/${id}/`).then(r => r.data),

    // ── BOM ──
    getActiveBOM: (productId: number) =>
        api.get<{ results: Record<string, unknown>[] }>(`/production/boms/?product_id=${productId}&active=true`).then(r =>
            r.data.results.find((b: Record<string, unknown>) => b.active) ?? null
        ),

    // ── Inventory ──
    getProductName: (productId: number) =>
        api.get(`/inventory/products/${productId}/`).then(r => r.data.name as string),
}
