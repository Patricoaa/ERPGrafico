import api from '@/lib/api'

export const ordersApi = {
    // ── Billing ──
    annulInvoice: (id: number, force: boolean, reason: string = '') =>
        api.post(`/billing/invoices/${id}/annul/`, { force, reason }).then(r => r.data),
    createInvoiceFromOrder: (data: Record<string, unknown>) =>
        api.post('/billing/invoices/create_from_order/', data).then(r => r.data),
    cancelInvoice: (id: number, reason: string = '') =>
        api.post(`/billing/invoices/${id}/cancel/`, { reason }).then(r => r.data),
    confirmInvoice: (id: number, formData: Record<string, unknown>) =>
        api.post(`/billing/invoices/${id}/confirm/`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        }).then(r => r.data),
    processLogistics: (id: number, data: Record<string, unknown>) =>
        api.post(`/billing/invoices/${id}/process_logistics/`, data).then(r => r.data),
    getInvoice: (id: number) =>
        api.get(`/billing/invoices/${id}/`).then(r => r.data),

    // ── Sales ──
    getSaleOrder: (id: string | number) =>
        api.get(`/sales/orders/${id}/`).then(r => r.data),
    searchSaleOrders: (params: { search?: string; limit?: string }) =>
        api.get('/sales/orders/', { params }).then(r => r.data),
    annulSaleOrder: (id: number, reason: string = '') =>
        api.post(`/sales/orders/${id}/annul/`, { force: false, reason }).then(r => r.data),
    cancelSaleOrder: (id: number, reason: string = '') =>
        api.post(`/sales/orders/${id}/cancel/`, { reason }).then(r => r.data),
    getCancelSaleImpact: (id: number) =>
        api.get(`/sales/orders/${id}/cancel_impact/`).then(r => r.data),
    deleteSaleOrder: (id: number) =>
        api.delete(`/sales/orders/${id}/`).then(r => r.data),
    annulSaleDelivery: (id: number, reason: string = '') =>
        api.post(`/sales/deliveries/${id}/annul/`, { reason }).then(r => r.data),
    annulSaleReturn: (id: number, reason: string = '') =>
        api.post(`/sales/returns/${id}/annul/`, { reason }).then(r => r.data),

    // ── Purchasing ──
    getPurchaseOrder: (id: string | number) =>
        api.get(`/purchasing/orders/${id}/`).then(r => r.data),
    annulPurchaseOrder: (id: number, reason: string = '') =>
        api.post(`/purchasing/orders/${id}/annul/`, { force: false, reason }).then(r => r.data),
    cancelPurchaseOrder: (id: number, reason: string = '') =>
        api.post(`/purchasing/orders/${id}/cancel/`, { reason }).then(r => r.data),
    getCancelPurchaseImpact: (id: number) =>
        api.get(`/purchasing/orders/${id}/cancel_impact/`).then(r => r.data),
    deletePurchaseOrder: (id: number) =>
        api.delete(`/purchasing/orders/${id}/`).then(r => r.data),
    annulPurchaseReceipt: (id: number, reason: string = '') =>
        api.post(`/purchasing/receipts/${id}/annul/`, { reason }).then(r => r.data),
    annulPurchaseReturn: (id: number, reason: string = '') =>
        api.post(`/purchasing/returns/${id}/annul/`, { reason }).then(r => r.data),

    // ── Treasury ──
    registerPaymentMovement: (data: Record<string, unknown>) =>
        api.post('/treasury/payments/register_movement/', data).then(r => r.data),
    cancelPayment: (id: number, reason: string = '') =>
        api.post(`/treasury/payments/${id}/cancel/`, { reason }).then(r => r.data),
    annulPayment: (id: number, reason: string = '') =>
        api.post(`/treasury/payments/${id}/annul/`, { reason }).then(r => r.data),

    // ── Production ──
    annulWorkOrder: (id: number, reason: string = '') =>
        api.post(`/production/orders/${id}/annul/`, { reason }).then(r => r.data),

    // ── Auth ──
    getCurrentUser: () =>
        api.get('/auth/user/').then(r => r.data),

    // ── Inventory ──
    getWarehouses: () =>
        api.get('/inventory/warehouses/').then(r => r.data),
}
