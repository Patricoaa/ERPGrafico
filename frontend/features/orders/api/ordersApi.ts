import api from '@/lib/api'

export const ordersApi = {
    // ── Billing ──
    annulInvoice: (id: number, force: boolean) =>
        api.post(`/billing/invoices/${id}/annul/`, { force }).then(r => r.data),
    createInvoiceFromOrder: (data: Record<string, unknown>) =>
        api.post('/billing/invoices/create_from_order/', data).then(r => r.data),
    deleteInvoice: (id: number) =>
        api.delete(`/billing/invoices/${id}/`).then(r => r.data),
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
        api.get('/sales/orders/', { params }).then(r => {
            const data = r.data
            return data.results || data
        }),
    annulSaleOrder: (id: number) =>
        api.post(`/sales/orders/${id}/annul/`, { force: false }).then(r => r.data),
    deleteSaleOrder: (id: number) =>
        api.delete(`/sales/orders/${id}/`).then(r => r.data),
    annulSaleDelivery: (id: number) =>
        api.post(`/sales/deliveries/${id}/annul/`).then(r => r.data),
    annulSaleReturn: (id: number) =>
        api.post(`/sales/returns/${id}/annul/`).then(r => r.data),

    // ── Purchasing ──
    getPurchaseOrder: (id: string | number) =>
        api.get(`/purchasing/orders/${id}/`).then(r => r.data),
    annulPurchaseOrder: (id: number) =>
        api.post(`/purchasing/orders/${id}/annul/`, { force: false }).then(r => r.data),
    deletePurchaseOrder: (id: number) =>
        api.delete(`/purchasing/orders/${id}/`).then(r => r.data),
    annulPurchaseReceipt: (id: number) =>
        api.post(`/purchasing/receipts/${id}/annul/`).then(r => r.data),
    annulPurchaseReturn: (id: number) =>
        api.post(`/purchasing/returns/${id}/annul/`).then(r => r.data),

    // ── Treasury ──
    registerPaymentMovement: (data: Record<string, unknown>) =>
        api.post('/treasury/payments/register_movement/', data).then(r => r.data),
    deletePayment: (id: number) =>
        api.delete(`/treasury/payments/${id}/`).then(r => r.data),
    annulPayment: (id: number) =>
        api.post(`/treasury/payments/${id}/annul/`).then(r => r.data),

    // ── Production ──
    annulWorkOrder: (id: number) =>
        api.post(`/production/orders/${id}/annul/`).then(r => r.data),

    // ── Auth ──
    getCurrentUser: () =>
        api.get('/auth/user/').then(r => r.data),

    // ── Inventory ──
    getWarehouses: () =>
        api.get('/inventory/warehouses/').then(r => {
            const data = r.data
            return data.results || data
        }),
}
