import api from '@/lib/api'
import { fetchBoundedList } from '@/lib/bounded-list'
import { toPage, type Page } from '@/lib/pagination'
import type {
    RcvApiKey,
    RcvApiKeyPayload,
    RcvDocument,
    RcvDocumentDetail,
    RcvDocumentFilters,
    RcvImport,
    RcvImportDetail,
    RcvImportFilters,
    RcvSettings,
    RcvSettingsPatch,
    StartRcvImportPayload,
} from '../types'

export const rcvApi = {
    getDocuments: async (filters: RcvDocumentFilters = {}, signal?: AbortSignal): Promise<Page<RcvDocument>> => {
        const response = await api.get('/accounting/rcv-documents/', { params: filters, signal })
        return toPage<RcvDocument>(response.data, Number(filters.page ?? 1), Number(filters.page_size ?? 50))
    },

    getDocument: async (id: number): Promise<RcvDocumentDetail> => {
        const { data } = await api.get<RcvDocumentDetail>(`/accounting/rcv-documents/${id}/`)
        return data
    },

    getImports: async (filters: RcvImportFilters = {}): Promise<Page<RcvImport>> => {
        const response = await api.get('/accounting/rcv-imports/', { params: filters })
        return toPage<RcvImport>(response.data, Number(filters.page ?? 1), Number(filters.page_size ?? 20))
    },

    getImport: async (id: number): Promise<RcvImportDetail> => {
        const { data } = await api.get<RcvImportDetail>(`/accounting/rcv-imports/${id}/`)
        return data
    },

    /** Encola una importación por dirección (202). `Idempotency-Key` obligatoria. */
    startImport: async (payload: StartRcvImportPayload, idempotencyKey: string): Promise<RcvImport[]> => {
        const { data } = await api.post<RcvImport[]>('/accounting/rcv-imports/start/', payload, {
            headers: { 'Idempotency-Key': idempotencyKey },
        })
        return data
    },

    getSettings: async (): Promise<RcvSettings> => {
        const { data } = await api.get<RcvSettings>('/accounting/rcv-settings/current/')
        return data
    },

    updateSettings: async (patch: RcvSettingsPatch): Promise<RcvSettings> => {
        const { data } = await api.patch<RcvSettings>('/accounting/rcv-settings/current/', patch)
        return data
    },

    getApiKeys: (): Promise<RcvApiKey[]> => fetchBoundedList<RcvApiKey>('/accounting/rcv-api-keys/'),

    createApiKey: async (payload: RcvApiKeyPayload): Promise<RcvApiKey> => {
        const { data } = await api.post<RcvApiKey>('/accounting/rcv-api-keys/', payload)
        return data
    },

    updateApiKey: async (id: number, payload: RcvApiKeyPayload): Promise<RcvApiKey> => {
        const { data } = await api.patch<RcvApiKey>(`/accounting/rcv-api-keys/${id}/`, payload)
        return data
    },

    deleteApiKey: async (id: number): Promise<void> => {
        await api.delete(`/accounting/rcv-api-keys/${id}/`)
    },
}
