import api from '@/lib/api'
import type { IdentifyOperatorPayload, OperatorPassResponse, PosOperator, POSSession, POSSessionMode } from '../types'

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
    /**
     * Libera el bloqueo al cerrar la pestaña. `navigator.sendBeacon` no puede enviar
     * `Authorization` (la API usa Bearer), así que siempre recibía 401; `fetch` con
     * `keepalive` sobrevive a la descarga de la página y conserva el header.
     */
    unlockDraftOnUnload: (id: number, payload: Record<string, unknown>): void => {
        let token: string | null = null
        try {
            token = localStorage.getItem('access_token')
        } catch {}
        if (!token) return
        const rawBase = process.env.NEXT_PUBLIC_API_URL || ''
        const base = rawBase.endsWith('/') ? rawBase : `${rawBase}/`
        fetch(`${base}sales/pos-drafts/${id}/unlock/`, {
            method: 'POST',
            keepalive: true,
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(payload),
        }).catch(() => undefined)
    },
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

    /** El dispositivo se une a una sesión abierta con su propio modo de caja. */
    joinSession: (sessionId: number, mode: POSSessionMode) =>
        api.post<POSSession>(`/treasury/pos-sessions/${sessionId}/join_session/`, { mode }).then(r => r.data),

    // ── Operador de caja multiusuario ──
    listOperators: (sessionId: number) =>
        api.get<PosOperator[]>(`/treasury/pos-sessions/${sessionId}/operators/`).then(r => r.data),
    identifyOperator: (sessionId: number, payload: IdentifyOperatorPayload) =>
        api.post<OperatorPassResponse>(`/treasury/pos-sessions/${sessionId}/identify_operator/`, payload).then(r => r.data),
    releaseOperator: (sessionId: number) =>
        api.post(`/treasury/pos-sessions/${sessionId}/release_operator/`).then(() => undefined),

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
