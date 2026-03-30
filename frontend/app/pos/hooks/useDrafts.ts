// useDrafts Hook
// Manages draft carts (save/load/delete) with lock integration

import { useState, useEffect, useCallback } from 'react'
import { usePOS } from '../contexts/POSContext'
import type { CartItem, DraftCart } from '@/types/pos'
import api from '@/lib/api'
import { toast } from 'sonner'

interface UseDraftsOptions {
    /** Browser session key for lock operations */
    browserSessionKey?: string
    /** Callback to acquire lock before loading a draft */
    acquireLock?: (draftId: number) => Promise<{ acquired: boolean, error?: string, locked_by_name?: string }>
    /** Callback to release lock when done with a draft */
    releaseLock?: (draftId?: number) => Promise<void>
    /** Force sync after mutations */
    forceSync?: () => void
}

export function useDrafts(options: UseDraftsOptions = {}) {
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
    }, [currentSession?.id, currentDraftId, setCurrentDraftId, setWizardState])

    // Save current cart as draft
    const saveDraft = useCallback(async (name?: string, silent = false) => {
        if (items.length === 0 || isLoading || isSaving) {
            return
        }

        setIsSaving(true)
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
                wizard_state: wizardState,
                session_key: options.browserSessionKey || '',
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
                        if (options.acquireLock) await options.acquireLock(res.data.id)
                        if (!silent) {
                            toast.success("Borrador guardado (nuevo)")
                        }
                    } else {
                        throw err
                    }
                }
            } else {
                // Create new
                res = await api.post('/sales/pos-drafts/', draftData)
                setCurrentDraftId(res.data.id)
                if (options.acquireLock) await options.acquireLock(res.data.id)
                if (!silent) {
                    toast.success("Borrador guardado")
                }
            }

            setLastSaved(new Date())

            // Notify sync to pick up changes
            options.forceSync?.()

            // Refresh drafts list without full loading indicator
            api.get(`/sales/pos-drafts/?pos_session_id=${currentSession?.id}`).then(r => {
                setDrafts(r.data.results || r.data)
            })

            return res.data
        } catch (error: any) {
            console.error("Error saving draft:", error)
            if (!silent) {
                toast.error(error.response?.data?.error || "Error al guardar borrador")
            }
        } finally {
            setIsSaving(false)
        }
    }, [items, selectedCustomerId, wizardState, currentSession, currentDraftId, setCurrentDraftId, isLoading, options.browserSessionKey, options.forceSync])

    // Load a draft into cart (with lock acquisition)
    const loadDraft = useCallback(async (draftId: number) => {
        if (!currentSession?.id) return
        
        // Try to acquire lock before loading
        if (options.acquireLock) {
            const lockResult = await options.acquireLock(draftId)
            if (!lockResult.acquired) {
                const errorMsg = lockResult.locked_by_name 
                    ? `Este borrador está siendo editado por ${lockResult.locked_by_name}`
                    : (lockResult.error || 'No se pudo bloquear el borrador')
                toast.error(errorMsg, {
                    description: 'Espere a que el otro usuario termine de editarlo.',
                    duration: 5000,
                })
                throw new Error(errorMsg)
            }
        }

        setIsLoading(true)
        try {
            // Release lock on previous draft if any
            if (currentDraftId && currentDraftId !== draftId && options.releaseLock) {
                await options.releaseLock(currentDraftId)
            }

            const res = await api.get(`/sales/pos-drafts/${draftId}/?pos_session_id=${currentSession.id}`)
            const draft = res.data

            // Reconstruct cart items from draft
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

            // Set or clear customer - Robustly handle ID or Object
            const rawCustomer = draft.customer
            const targetCustomerId = (typeof rawCustomer === 'object' && rawCustomer !== null) 
                ? (rawCustomer as any).id 
                : rawCustomer
            setSelectedCustomerId(targetCustomerId)

            toast.success(`Borrador cargado: ${draft.name}`)
        } catch (error: any) {
            console.error("Error loading draft:", error)
            if (error.response?.status === 404) {
                toast.error("El borrador ya no existe en el servidor o no pertenece a esta sesión")
                setCurrentDraftId(null)
                setWizardState(null)
                fetchDrafts() // Refresh list
            } else if (!error.message?.includes('siendo editado')) {
                toast.error("Error al cargar borrador")
            }
            // Release the lock we acquired if loading failed
            if (options.releaseLock) {
                await options.releaseLock(draftId)
            }
            throw error
        } finally {
            setIsLoading(false)
        }
    }, [setItems, setSelectedCustomerId, setCurrentDraftId, setWizardState, currentSession, currentDraftId, fetchDrafts, options.acquireLock, options.releaseLock])

    // Delete a draft
    const deleteDraft = useCallback(async (draftId: number) => {
        if (!currentSession?.id) return
        try {
            await api.delete(`/sales/pos-drafts/${draftId}/?pos_session_id=${currentSession.id}`)
            toast.success("Borrador eliminado")
            await fetchDrafts()
            options.forceSync?.()
        } catch (error) {
            console.error("Error deleting draft:", error)
            toast.error("Error al eliminar borrador")
        }
    }, [fetchDrafts, currentSession?.id, options.forceSync])

    // Release lock on current draft (used when clearing cart or completing sale)
    const releaseCurrentLock = useCallback(async () => {
        if (currentDraftId && options.releaseLock) {
            await options.releaseLock(currentDraftId)
        }
    }, [currentDraftId, options.releaseLock])

    // Auto-save (optional, can be triggered manually)
    const autoSave = useCallback(async () => {
        if (items.length === 0) return
        await saveDraft(`Auto-guardado ${new Date().toLocaleTimeString()}`)
    }, [items, saveDraft])

    // Fetch drafts when session becomes available (and on mount)
    useEffect(() => {
        fetchDrafts()
    }, [currentSession?.id]) // eslint-disable-line react-hooks/exhaustive-deps

    return {
        drafts,
        lastSaved,
        isSaving,
        isLoading,
        saveDraft,
        loadDraft,
        deleteDraft,
        fetchDrafts,
        autoSave,
        releaseCurrentLock,
    }
}
