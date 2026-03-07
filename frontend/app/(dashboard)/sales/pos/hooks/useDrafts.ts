// useDrafts Hook
// Manages draft carts (save/load/delete)

import { useState, useEffect, useCallback } from 'react'
import { usePOS } from '../contexts/POSContext'
import type { CartItem, DraftCart } from '@/types/pos'
import api from '@/lib/api'
import { toast } from 'sonner'

export function useDrafts() {
    const {
        items,
        setItems,
        selectedCustomerId,
        setSelectedCustomerId,
        currentSession,
        currentDraftId,
        setCurrentDraftId,
        wizardState,
        setWizardState
    } = usePOS()

    const [drafts, setDrafts] = useState<DraftCart[]>([])
    const [lastSaved, setLastSaved] = useState<Date | null>(null)
    const [isSaving, setIsSaving] = useState(false)
    const [isLoading, setIsLoading] = useState(false)

    // Fetch all drafts
    const fetchDrafts = useCallback(async () => {
        if (!currentSession?.id) return
        setIsLoading(true)
        try {
            const res = await api.get(`/sales/pos-drafts/?pos_session_id=${currentSession.id}`)
            const list = res.data.results || res.data
            setDrafts(list)

            // Sync currentDraftId: if it's set but not in the list, it's stale
            if (currentDraftId && !list.find((d: any) => d.id === currentDraftId)) {
                console.warn(`Current draft ${currentDraftId} not found in list, clearing state`)
                setCurrentDraftId(null)
                setWizardState(null)
            }
        } catch (error) {
            console.error("Error fetching drafts:", error)
            toast.error("Error al cargar borradores")
        } finally {
            setIsLoading(false)
        }
    }, [])

    // Save current cart as draft
    const saveDraft = useCallback(async (name?: string) => {
        if (items.length === 0 || isLoading || isSaving) {
            return
        }

        try {
            const draftData: any = {
                pos_session_id: currentSession?.id,
                name: name || (currentDraftId ? undefined : `Borrador ${new Date().toLocaleString()}`),
                    items: items.map(item => ({
                    product_id: item.id,
                    quantity: item.qty,
                    uom_id: item.uom,
                    unit_price_net: item.unit_price_net,
                    unit_price_gross: item.unit_price_gross,
                    total_net: (item.qty || 0) * (item.unit_price_net || 0),
                    total_gross: (item.qty || 0) * (item.unit_price_gross || 0),
                    manufacturing_data: item.manufacturing_data
                })),
            customer_id: selectedCustomerId,
            wizard_state: wizardState
        }

            let res;
            if (currentDraftId) {
                // Update existing
                try {
                    res = await api.put(`/sales/pos-drafts/${currentDraftId}/`, draftData)
                } catch (err: any) {
                    if (err.response?.status === 404) {
                        console.warn("Draft not found on server, falling back to new draft")
                        setCurrentDraftId(null)
                        // Retry as post
                        res = await api.post('/sales/pos-drafts/', draftData)
                        setCurrentDraftId(res.data.id)
                        toast.success("Borrador guardado (nuevo)")
                    } else {
                        throw err
                    }
                }
            } else {
                // Create new
                res = await api.post('/sales/pos-drafts/', draftData)
                setCurrentDraftId(res.data.id)
                toast.success("Borrador guardado")
            }

            setLastSaved(new Date())

            // Refresh drafts list without full loading indicator
            api.get(`/sales/pos-drafts/?pos_session_id=${currentSession?.id}`).then(r => {
                setDrafts(r.data.results || r.data)
            })

            return res.data
        } catch (error: any) {
            console.error("Error saving draft:", error)
            toast.error(error.response?.data?.error || "Error al guardar borrador")
        } finally {
            setIsSaving(false)
        }
    }, [items, selectedCustomerId, wizardState, currentSession, currentDraftId, setCurrentDraftId, isLoading])

    // Load a draft into cart
    const loadDraft = useCallback(async (draftId: number) => {
        if (!currentSession?.id) return
        setIsLoading(true)
        try {
            const res = await api.get(`/sales/pos-drafts/${draftId}/?pos_session_id=${currentSession.id}`)
            const draft = res.data

            // Reconstruct cart items from draft
            // This requires fetching full product data
            const itemPromises = draft.items.map(async (draftItem: any) => {
                try {
                    const productRes = await api.get(`/inventory/products/${draftItem.product_id}/`)
                    const product = productRes.data

                    return {
                        ...product,
                        cartItemId: Math.random().toString(36).substring(2, 9),
                        qty: draftItem.quantity,
                        uom: draftItem.uom_id,
                        unit_price_net: draftItem.unit_price_net,
                        unit_price_gross: draftItem.unit_price_gross,
                        total_net: draftItem.quantity * draftItem.unit_price_net,
                        total_gross: Math.round(draftItem.quantity * draftItem.unit_price_gross),
                        manufacturing_data: draftItem.manufacturing_data
                    } as CartItem
                } catch (error) {
                    console.error(`Error loading product ${draftItem.product_id}:`, error)
                    return null
                }
            })

            const loadedItems = (await Promise.all(itemPromises)).filter(Boolean) as CartItem[]

            setItems(loadedItems)
            setCurrentDraftId(draft.id)
            setWizardState(draft.wizard_state)

            // Set or clear customer
            setSelectedCustomerId(draft.customer_id)

            toast.success(`Borrador cargado: ${draft.name}`)
        } catch (error: any) {
            console.error("Error loading draft:", error)
            if (error.response?.status === 404) {
                toast.error("El borrador ya no existe en el servidor o no pertenece a esta sesión")
                setCurrentDraftId(null)
                setWizardState(null)
                fetchDrafts() // Refresh list
            } else {
                toast.error("Error al cargar borrador")
            }
            throw error // Re-throw so caller (DraftCartsList) doesn't show success
        } finally {
            setIsLoading(false)
        }
    }, [setItems, setSelectedCustomerId, setCurrentDraftId, setWizardState, currentSession, fetchDrafts])

    // Delete a draft
    const deleteDraft = useCallback(async (draftId: number) => {
        if (!currentSession?.id) return
        try {
            await api.delete(`/sales/pos-drafts/${draftId}/?pos_session_id=${currentSession.id}`)
            toast.success("Borrador eliminado")
            await fetchDrafts()
        } catch (error) {
            console.error("Error deleting draft:", error)
            toast.error("Error al eliminar borrador")
        }
    }, [fetchDrafts])

    // Auto-save (optional, can be triggered manually)
    const autoSave = useCallback(async () => {
        if (items.length === 0) return

        await saveDraft(`Auto-guardado ${new Date().toLocaleTimeString()}`)
    }, [items, saveDraft])

    // Fetch drafts on mount
    useEffect(() => {
        fetchDrafts()
    }, [fetchDrafts])

    return {
        drafts,
        lastSaved,
        isSaving,
        isLoading,
        saveDraft,
        loadDraft,
        deleteDraft,
        fetchDrafts,
        autoSave
    }
}
