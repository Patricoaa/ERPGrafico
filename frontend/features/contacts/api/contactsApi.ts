import api from '@/lib/api'
import type { Contact, ContactFilters, ContactPayload, InsightsData } from '../types'

/**
 * Centralized API service for contacts operations
 */
export const contactsApi = {
    /**
     * Fetch all contacts with optional filtering
     */
    getContacts: async (filters?: ContactFilters): Promise<Contact[]> => {
        const params = new URLSearchParams()
        if (filters?.name) params.append('name', filters.name)
        if (filters?.tax_id) params.append('tax_id', filters.tax_id)
        if (filters?.contact_type) params.append('contact_type', filters.contact_type)
        if (filters?.is_default_customer !== undefined) params.append('is_default_customer', String(filters.is_default_customer))
        if (filters?.is_default_vendor !== undefined) params.append('is_default_vendor', String(filters.is_default_vendor))

        const { data } = await api.get<{ results: Contact[] }>('/contacts/', { params })
        return data.results || data
    },

    /**
     * Fetch a single contact by ID
     */
    getContact: async (id: number): Promise<Contact> => {
        const { data } = await api.get<Contact>(`/contacts/${id}/`)
        return data
    },

    /**
     * Create a new contact
     */
    createContact: async (payload: ContactPayload): Promise<Contact> => {
        const { data } = await api.post<Contact>('/contacts/', payload)
        return data
    },

    /**
     * Update an existing contact
     */
    updateContact: async (id: number, payload: Partial<ContactPayload>): Promise<Contact> => {
        const { data } = await api.patch<Contact>(`/contacts/${id}/`, payload)
        return data
    },

    /**
     * Delete a contact
     */
    deleteContact: async (id: number): Promise<void> => {
        await api.delete(`/contacts/${id}/`)
    },

    /**
     * Fetch insights for a contact
     */
    getInsights: async (id: number): Promise<InsightsData> => {
        const { data } = await api.get<InsightsData>(`/contacts/${id}/insights/`)
        return data
    }
}
