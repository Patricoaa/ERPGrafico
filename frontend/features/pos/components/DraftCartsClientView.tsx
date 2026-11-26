"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { Button } from "@/components/ui/button"

import { TooltipProvider } from "@/components/ui/tooltip"

import { cn, formatDateWith } from "@/lib/utils"
import { toast } from "sonner"
import { posApi } from "../api/posApi"
import {
    Archive,
    Trash2,
    ChevronRight,
    Lock,
} from "lucide-react"
import { ActionConfirmModal, DangerButton, BaseModal } from "@/components/shared"
import { Collection, useEntityCollection } from "@/components/entity-view"
import { draftCartEntity, draftCartViews, type DraftCartRow } from "../entity-view/draftCart.entity"
import type { SyncDraft } from '@/features/pos/hooks/useDraftSync'

export interface DraftCart {
    id: number
    session_local_id: number
    name: string
    notes: string
    customer: number | null
    customer_name: string | null
    items: Array<Record<string, unknown>>
    total_net: number
    total_gross: number
    item_count: number
    created_by_full_name: string | null
    last_modified_by_full_name: string | null
    created_at: string
    updated_at: string
    pos_session: number
    is_locked?: boolean
    locked_by_name?: string | null
    locked_by?: number | null
    wizard_state?: {
        step: number
        dteData: Record<string, unknown>
        paymentData: Record<string, unknown>
        deliveryData: Record<string, unknown>
        approvalTaskId?: number | null
        isWaitingApproval?: boolean
        isApproved?: boolean
        isWaitingPayment?: boolean
    } | null
}

interface LockInfo {
    isLocked: boolean
    lockedByName: string | null
    isOwnLock: boolean
}

interface DraftCartsClientViewProps {
    posSessionId: number | null
    currentDraftId?: number | null
    onLoadDraft: (draft: DraftCart | SyncDraft) => void
    onDraftDeleted?: () => void
    open?: boolean
    onOpenChange?: (open: boolean) => void
    showTrigger?: boolean
    /** Real-time sync data for lock indicators */
    syncDrafts?: SyncDraft[]
    /** Function to get lock info for a draft */
    getLockInfo?: (draftId: number) => LockInfo
}

export function DraftCartsClientView({
    posSessionId,
    currentDraftId,
    onLoadDraft,
    onDraftDeleted,
    open: externalOpen,
    onOpenChange: setExternalOpen,
    showTrigger = true,
    syncDrafts,
    getLockInfo,
}: DraftCartsClientViewProps) {
    const [drafts, setDrafts] = useState<DraftCart[]>([])
    const [loading, setLoading] = useState(false)
    const [internalOpen, setInternalOpen] = useState(false)
    const [deletingId, setDeletingId] = useState<number | null>(null)
    const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
    const [confirmDeleteName, setConfirmDeleteName] = useState("")
    const [, setPrevDraftIds] = useState<Set<number>>(new Set())


    // Lock info from syncDrafts (WebSocket, real-time) + fallback to HTTP drafts data
    const resolveLockInfo = useCallback((draftId: number): LockInfo => {
        if (getLockInfo) {
            const syncLock = getLockInfo(draftId)
            if (syncLock.isLocked) return syncLock
        }
        const draft = drafts.find(d => d.id === draftId)
        if (draft?.is_locked) {
            return {
                isLocked: true,
                lockedByName: draft.locked_by_name ?? null,
                isOwnLock: false,
            }
        }
        return { isLocked: false, lockedByName: null, isOwnLock: false }
    }, [getLockInfo, drafts])

    const isControlled = externalOpen !== undefined
    const open = isControlled ? externalOpen : internalOpen
    const setOpen: (open: boolean) => void = isControlled ? (setExternalOpen as (open: boolean) => void) : setInternalOpen

    const fetchDrafts = async () => {
        if (!posSessionId) {
            toast.error("No hay sesión activa")
            return
        }
        setLoading(true)
        try {
            const draftsData = await posApi.getDrafts({ pos_session_id: posSessionId }) as { results?: DraftCart[] } | DraftCart[]
            const data = Array.isArray(draftsData) ? draftsData : (draftsData.results ?? [])
            const newDrafts = Array.isArray(data) ? data : []
            setDrafts(newDrafts)
            setPrevDraftIds(new Set(newDrafts.map((d: DraftCart) => d.id)))
        } catch (error) {
            console.error("Error al cargar borradores:", error)
            toast.error("Error al cargar los borradores")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (open && posSessionId) {
            requestAnimationFrame(() => fetchDrafts())
        }
    }, [open, posSessionId])

    // Auto-refresh drafts when syncDrafts changes (new/deleted drafts)
    useEffect(() => {
        if (!open || !syncDrafts) return
        const syncIds = new Set(syncDrafts.map(d => d.id))
        const localIds = new Set(drafts.map(d => d.id))

        // Check if there are differences
        let hasDiff = syncIds.size !== localIds.size
        if (!hasDiff) {
            for (const id of syncIds) {
                if (!localIds.has(id)) { hasDiff = true; break }
            }
        }

        if (hasDiff) {
            requestAnimationFrame(() => fetchDrafts())
        }
    }, [syncDrafts, open])

    const handleLoadDraft = async (draft: DraftCart) => {
        // Already the current draft — just close modal
        if (draft.id === currentDraftId) {
            setOpen(false)
            return
        }

        const lock = resolveLockInfo(draft.id)
        if (lock.isLocked && !lock.isOwnLock) {
            toast.error(`Borrador en uso por ${lock.lockedByName}`, {
                description: 'Espere a que el otro usuario termine de editarlo.',
                duration: 5000,
            })
            return
        }

        try {
            await onLoadDraft(draft)
            setOpen(false)
        } catch {
            // Already handled in useDrafts
        }
    }

    const handleDeleteDraft = async (draftId: number, draftName: string) => {
        if (!posSessionId) return

        if (draftId === currentDraftId) {
            toast.error("No se puede eliminar el borrador que está actualmente seleccionado")
            return
        }

        const lock = resolveLockInfo(draftId)
        if (lock.isLocked) {
            const msg = lock.isOwnLock
                ? "No se puede eliminar el borrador que está actualmente seleccionado"
                : `No se puede eliminar: en uso por ${lock.lockedByName}`
            toast.error(msg)
            return
        }

        setDeletingId(draftId)
        try {
            await posApi.deleteDraft(draftId, { pos_session_id: posSessionId })
            toast.success(`Borrador "${draftName}" eliminado`)
            await fetchDrafts()
            onDraftDeleted?.()
        } catch (error) {
            console.error("Error al eliminar borrador:", error)
            const err = error as { response?: { status?: number } }
            if (err.response?.status === 404) {
                toast.info("El borrador ya no existía en el servidor")
                await fetchDrafts()
                onDraftDeleted?.()
            } else {
                toast.error("Error al eliminar el borrador")
            }
        } finally {
            setDeletingId(null)
        }
    }

    const [now, setNow] = useState(() => Date.now())

    useEffect(() => {
        const interval = setInterval(() => setNow(Date.now()), 60000)
        return () => clearInterval(interval)
    }, [])

    const formatRelative = (dateString: string) => {
        try {
            const diff = now - new Date(dateString).getTime()
            const mins = Math.floor(diff / 60000)
            if (mins < 1) return "Ahora"
            if (mins < 60) return `Hace ${mins}m`
            const hrs = Math.floor(mins / 60)
            if (hrs < 24) return `Hace ${hrs}h`
            return formatDateWith(dateString, { day: '2-digit', month: '2-digit' })
        } catch { return dateString }
    }

    // The lock (real-time sync) and the relative age change without a new fetch: derived per render
    // and handed on the row, so the entity's fields stay pure (draftCart.entity.tsx).
    const rows = useMemo<DraftCartRow[]>(
        () => drafts.map((d) => ({ ...d, lock: resolveLockInfo(d.id), isCurrent: d.id === currentDraftId, updatedLabel: formatRelative(d.updated_at) })),
        // eslint-disable-next-line react-hooks/exhaustive-deps -- `now` ticks the relative age
        [drafts, resolveLockInfo, currentDraftId, now],
    )
    const collection = useEntityCollection(draftCartEntity, { rows, isLoading: loading }, { pagination: { mode: "none" } })

    return (
        <>
            {showTrigger && (
                <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
                    <Archive className="h-4 w-4 mr-2" />
                    Ver Borradores
                    {drafts.length > 0 && (
                        <span className="ml-2 text-4xs font-medium uppercase px-1.5 py-0.5 rounded-full border border-muted-foreground/20 bg-muted/30 text-muted-foreground">
                            {drafts.length}
                        </span>
                    )}
                </Button>
            )}

            <BaseModal
                open={open}
                onOpenChange={setOpen}
                size="lg"
                title={
                    <div className="flex items-center gap-2">
                        <Archive className="h-4 w-4 text-muted-foreground" />
                        <span>Borradores</span>
                        {drafts.length > 0 && (
                            <span className="text-3xs h-4 px-1.5 font-bold bg-muted text-muted-foreground rounded-full border border-muted-foreground/20 leading-none flex items-center">
                                {drafts.length}
                            </span>
                        )}
                    </div>
                }
            >
                <TooltipProvider delayDuration={200}>
                    <div className="py-1">
                        <Collection.Root
                            collection={collection}
                            onOpen={(draft) => void handleLoadDraft(draft)}
                            label="Borradores"
                            actions={(d) => {
                                const lockedByOther = d.lock.isLocked && !d.lock.isOwnLock
                                const blocked = lockedByOther || d.isCurrent
                                return (
                                    <div className="flex items-center justify-end gap-1">
                                        <DangerButton
                                            variant="destructive"
                                            className={cn(
                                                "h-control-xs w-7 p-0 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100",
                                                blocked && "pointer-events-none !opacity-0"
                                            )}
                                            loading={deletingId === d.id}
                                            disabled={blocked}
                                            aria-label={`Eliminar ${d.name || "borrador"}`}
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                setConfirmDeleteId(d.id)
                                                setConfirmDeleteName(d.name)
                                            }}
                                            icon={Trash2}
                                        >{null}</DangerButton>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className={cn(
                                                "h-control-xs gap-0.5 px-2 text-2xs font-medium",
                                                blocked ? "cursor-not-allowed text-muted-foreground" : "hover:bg-primary/10 hover:text-primary"
                                            )}
                                            disabled={blocked}
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                void handleLoadDraft(d)
                                            }}
                                        >
                                            {blocked ? (
                                                <>
                                                    <Lock className="h-3 w-3" />
                                                    {d.isCurrent ? "Actual" : "En uso"}
                                                </>
                                            ) : (
                                                <>
                                                    Cargar
                                                    <ChevronRight className="h-3 w-3" />
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                )
                            }}
                        >
                            <Collection.View table={draftCartViews.table} empty="message" emptyTitle="No hay borradores en esta sesión" />
                        </Collection.Root>
                    </div>
                </TooltipProvider>
            </BaseModal>

            <ActionConfirmModal
                open={!!confirmDeleteId}
                onOpenChange={(o) => !o && setConfirmDeleteId(null)}
                onConfirm={() => {
                    if (confirmDeleteId) {
                        handleDeleteDraft(confirmDeleteId, confirmDeleteName)
                        setConfirmDeleteId(null)
                    }
                }}
                title="¿Eliminar borrador?"
                description={
                    <p className="text-sm leading-relaxed">
                        Se eliminará permanentemente <strong>&quot;{confirmDeleteName}&quot;</strong>. Esta acción no se puede deshacer.
                    </p>
                }
                variant="destructive"
                confirmText="Eliminar"
            />
        </>
    )
}
