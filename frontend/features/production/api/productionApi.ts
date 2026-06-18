import api from '@/lib/api'

export const productionApi = {
    // ── Work Orders ──
    getWorkOrders: (params?: Record<string, unknown>) =>
        api.get('/production/orders/', { params }).then(r => r.data),
    getWorkOrder: (id: number) =>
        api.get(`/production/orders/${id}/`).then(r => r.data),
    createWorkOrder: (formData: FormData, headers?: Record<string, string>) =>
        api.post('/production/orders/', formData, { headers }).then(r => r.data),
    updateWorkOrder: (id: number, formData: FormData) =>
        api.put(`/production/orders/${id}/`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        }).then(r => r.data),
    patchWorkOrder: (id: number, formData: FormData) =>
        api.patch(`/production/orders/${id}/`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        }).then(r => r.data),
    deleteWorkOrder: (id: number) =>
        api.delete(`/production/orders/${id}/`).then(r => r.data),
    transitionWorkOrder: (id: number, data: Record<string, unknown>) =>
        api.post(`/production/orders/${id}/transition/`, data).then(r => r.data),
    rectifyWorkOrder: (id: number, data: Record<string, unknown>) =>
        api.post(`/production/orders/${id}/rectify/`, data).then(r => r.data),
    addMaterial: (id: number, data: Record<string, unknown>) =>
        api.post(`/production/orders/${id}/add_material/`, data).then(r => r.data),
    updateMaterial: (id: number, data: Record<string, unknown>) =>
        api.post(`/production/orders/${id}/update_material/`, data).then(r => r.data),
    removeMaterial: (id: number, data: Record<string, unknown>) =>
        api.post(`/production/orders/${id}/remove_material/`, data).then(r => r.data),
    annulWorkOrder: (id: number) =>
        api.post(`/production/orders/${id}/annul/`).then(r => r.data),
    duplicateWorkOrder: (id: number) =>
        api.post(`/production/orders/${id}/duplicate/`).then(r => r.data),
    uploadFinalPhoto: (id: number, formData: FormData) =>
        api.patch(`/production/orders/${id}/`, formData).then(r => r.data),
    getWorkOrderComments: (id: number) =>
        api.get(`/production/orders/${id}/comments/`).then(r => r.data),
    addWorkOrderComment: (id: number, data: Record<string, unknown>) =>
        api.post(`/production/orders/${id}/comments/`, data).then(r => r.data),
    bulkTransition: (data: Record<string, unknown>) =>
        api.post('/production/orders/bulk_transition/', data).then(r => r.data),
    bulkPrint: (data: Record<string, unknown>) =>
        api.post('/production/orders/bulk_print/', data, { responseType: 'blob' }).then(r => r.data),
    getProductionMetrics: () =>
        api.get('/production/orders/metrics/').then(r => r.data),
    restartWorkOrder: (id: number) =>
        api.post(`/production/orders/${id}/restart/`).then(r => r.data),
    updateSection: (id: number, section: string, payload: Record<string, unknown>) =>
        api.patch(`/production/orders/${id}/update_section/`, { section, payload }).then(r => r.data),

    // ── BOMs ──
    getBOMs: (params?: Record<string, unknown>) =>
        api.get('/production/boms/', { params }).then(r => r.data),
    getActiveBom: (productId: string | number) =>
        api.get('/production/boms/', { params: { product_id: productId } }).then(r => {
            const list = r.data
            return Array.isArray(list) ? list.find((b: { active?: boolean }) => b.active) || null : null
        }),
    createBom: (payload: Record<string, unknown>) =>
        api.post('/production/boms/', payload).then(r => r.data),
    updateBom: (id: number, payload: Record<string, unknown>) =>
        api.patch(`/production/boms/${id}/`, payload).then(r => r.data),
    deleteBom: (id: number) =>
        api.delete(`/production/boms/${id}/`).then(r => r.data),
    toggleBomActive: (id: number) =>
        api.patch(`/production/boms/${id}/`, { active: true } as Record<string, unknown>).then(r => r.data),

    // ── Inventory (cross-feature) ──
    getUoms: () =>
        api.get('/inventory/uoms/').then(r => r.data),
    getProduct: (id: string | number) =>
        api.get(`/inventory/products/${id}/`).then(r => r.data),
    getProductVariants: (parentId: string | number) =>
        api.get('/inventory/products/', {
            params: { parent_template: parentId, show_technical_variants: true }
        }).then(r => r.data),

    // ── Accounting / Core (cross-feature) ──
    getAccountingSettings: () =>
        api.get('/accounting/settings/current/').then(r => r.data),
    getCoreSettings: () =>
        api.get('/core/settings/').then(r => r.data),
}
