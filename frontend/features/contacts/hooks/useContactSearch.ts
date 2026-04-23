import { useState, useCallback } from "react"
import api from "@/lib/api"
import { showApiError } from "@/lib/errors"
import { Contact } from "@/types/entities"

interface ContactSearchParams {
    search?: string
    contactType?: 'CUSTOMER' | 'SUPPLIER' | 'BOTH' | 'NONE'
    isPartnerOnly?: boolean
    isCustomer?: boolean
    isVendor?: boolean
    limit?: number
    fetchSingleId?: string | number | null
}

interface UseContactSearchReturn {
    contacts: Contact[]
    singleContact: Contact | null
    loading: boolean
    fetchContacts: (params?: ContactSearchParams) => Promise<void>
    fetchSingleContact: (id: string | number) => Promise<void>
}

const globalCache: Record<string, Contact[]> = {}

export function useContactSearch(): UseContactSearchReturn {
    const [contacts, setContacts] = useState<Contact[]>([])
    const [singleContact, setSingleContact] = useState<Contact | null>(null)
    const [loading, setLoading] = useState(false)

    const fetchSingleContact = useCallback(async (id: string | number) => {
        try {
            const res = await api.get(`/contacts/${id}/`)
            setSingleContact(res.data)
        } catch (e) {
            console.error("Error fetching single contact", e)
        }
    }, [])

    const fetchContacts = useCallback(async (params: ContactSearchParams = {}) => {
        const { search = "", contactType, isCustomer, isVendor, limit = 50 } = params
        const cacheKey = JSON.stringify(params)
        
        if (globalCache[cacheKey]) {
            setContacts(globalCache[cacheKey])
            return
        }

        try {
            setLoading(true)
            const q = new URLSearchParams()
            if (search) q.append("search", search)
            if (params.contactType) q.append("type", params.contactType)
            if (isCustomer !== undefined && isCustomer) q.append("is_customer", "true")
            if (isVendor !== undefined && isVendor) q.append("is_vendor", "true")
            if (params.isPartnerOnly) q.append("is_partner", "true")
            
            const res = await api.get(`/contacts/?${q.toString()}`)
            const data = res.data.results || res.data
            
            globalCache[cacheKey] = data
            setContacts(data)
        } catch (err) {
            showApiError(err, "Error al buscar contactos")
            setContacts([])
        } finally {
            setLoading(false)
        }
    }, [])

    return { contacts, singleContact, loading, fetchContacts, fetchSingleContact }
}
