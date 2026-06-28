"use client"
import { formatCurrency } from "@/lib/money"

import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"

import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"

import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { posApi } from "../api/posApi"
import {
    Archive,
    Trash2,
    Loader2,
    ClipboardCheck,
    ShoppingCart,
    User,
    ChevronRight,
    Lock,
    Wallet,
} from "lucide-react"
import { ActionConfirmModal, BaseModal, DataTable } from '@/components/shared'
import type { ColumnDef } from "@tanstack/react-table"
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
    const [prevDraftIds, setPrevDraftIds] = useState<Set<number>>(new Set())

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
        // Check lock before even trying
        if (getLockInfo) {
            const lock = getLockInfo(draft.id)
            if (lock.isLocked && !lock.isOwnLock) {
                toast.error(`Borrador en uso por ${lock.lockedByName}`, {
                    description: 'Espere a que el otro usuario termine de editarlo.',
                    duration: 5000,
                })
                return
            }
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

        // Prevent deleting locked drafts
        if (getLockInfo) {
            const lock = getLockInfo(draftId)
            if (lock.isLocked && !lock.isOwnLock) {
                toast.error(`No se puede eliminar: en uso por ${lock.lockedByName}`)
                return
            }
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
            return new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: '2-digit' }).format(new Date(dateString))
        } catch { return dateString }
    }

    const draftColumns = useMemo<ColumnDef<DraftCart>[]>(() => [
        {
            id: 'id',
            header: '#',
            cell: ({ row }) => {
                const lockInfo = getLockInfo?.(row.original.id)
                const lockedByOther = lockInfo?.isLocked && !lockInfo?.isOwnLock
                return (
                    <span className={cn(
                        "text-center text-[11px] font-mono font-bold",
                        lockedByOther ? "text-destructive/60" : "text-primary/70"
                    )}>
                        {row.original.session_local_id}
                    </span>
                )
            },
        },
        {
            id: 'name',
            header: 'Nombre / Cliente',
            cell: ({ row }) => {
                const draft = row.original
                const lockInfo = getLockInfo?.(draft.id)
                const lockedByOther = lockInfo?.isLocked && !lockInfo?.isOwnLock

                return (
                    <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm font-medium truncate leading-tight">
                                {draft.name || `Borrador #${draft.session_local_id}`}
                            </span>
                            {lockedByOther && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <span className="h-4 px-1.5 text-[9px] font-bold uppercase rounded-full border bg-destructive/10 text-destructive border-destructive/30 gap-1 flex items-center shrink-0 cursor-help">
                                            <Lock className="h-2.5 w-2.5" />
                                            {lockInfo?.lockedByName || 'En uso'}
                                        </span>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="max-w-[200px] text-xs">
                                        Este borrador está siendo editado por <strong>{lockInfo?.lockedByName}</strong>.
                                        No se puede cargar hasta que termine.
                                    </TooltipContent>
                                </Tooltip>
                            )}
                            {lockInfo?.isOwnLock && (
                                <span className="h-4 px-1.5 text-[9px] font-bold uppercase rounded-full border bg-primary/10 text-primary border-primary/30 gap-1 flex items-center shrink-0">
                                    <Lock className="h-2.5 w-2.5" />
                                    Tú
                                </span>
                            )}
                            {draft.wizard_state?.isWaitingPayment && !lockedByOther && (
                                <span className="h-4 px-1.5 text-[9px] font-bold uppercase rounded-full border bg-warning/10 text-warning border-warning/20 gap-1 flex items-center shrink-0 shadow-card">
                                    <Wallet className="h-2.5 w-2.5" />
                                    Por Pagar
                                </span>
                            )}
                            {draft.wizard_state?.step && !draft.wizard_state?.isWaitingPayment && !lockedByOther && (
                                <span className="h-4 px-1.5 text-[9px] font-bold uppercase rounded-full border bg-warning/10 text-warning border-warning/20 gap-1 flex items-center shrink-0">
                                    <ClipboardCheck className="h-2.5 w-2.5" />
                                    P{draft.wizard_state.step}
                                </span>
                            )}
                            {draft.wizard_state?.isWaitingApproval && (
                                <span className="h-4 px-1.5 text-[9px] font-bold uppercase rounded-full border bg-primary/10 text-primary border-primary/20 gap-1 flex items-center shrink-0">
                                    <Loader2 className="h-2.5 w-2.5 animate-spin" />
                                    Auth
                                </span>
                            )}
                            {draft.wizard_state?.isApproved && (
                                <span className="h-4 px-1.5 text-[9px] font-bold uppercase rounded-full border bg-success/10 text-success border-success/20 gap-1 flex items-center shrink-0">
                                    <ClipboardCheck className="h-2.5 w-2.5" />
                                    OK
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                            {draft.customer_name && (
                                <span className="flex items-center gap-0.5 truncate max-w-[140px]">
                                    <User className="h-2.5 w-2.5 shrink-0" />
                                    {draft.customer_name}
                                </span>
                            )}
                            <span className="shrink-0">{formatRelative(draft.updated_at)}</span>
                        </div>
                    </div>
                )
            },
        },
        {
            id: 'items',
            header: 'Ítems',
            cell: ({ row }) => (
                <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground justify-center">
                    <ShoppingCart className="h-3 w-3" />
                    {row.original.item_count}
                </span>
            ),
        },
        {
            id: 'total',
            header: 'Total',
            cell: ({ row }) => (
                <span className="text-sm font-semibold text-right tabular-nums">
                    {formatCurrency(row.original.total_gross)}
                </span>
            ),
        },
    ], [getLockInfo, formatRelative])

    return (
        <>
            {showTrigger && (
                <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
                    <Archive className="h-4 w-4 mr-2" />
                    Ver Borradores
                    {drafts.length > 0 && (
                        <span className="ml-2 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full border border-muted-foreground/20 bg-muted/30 text-muted-foreground">
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
                            <span className="text-[10px] h-4 px-1.5 font-bold bg-muted text-muted-foreground rounded-full border border-muted-foreground/20 leading-none flex items-center">
                                {drafts.length}
                            </span>
                        )}
                    </div>
                }
            >
                <TooltipProvider delayDuration={200}>
                    <div className="py-1">
                        <DataTable
                            variant="compact"
                            gridTemplate="grid-cols-[2rem_1fr_auto_auto_auto]"
                            columns={draftColumns}
                            data={drafts}
                            isLoading={loading}
                            onRowClick={(draft) => handleLoadDraft(draft as DraftCart)}
                            renderRowActions={(draft) => {
                                const d = draft as DraftCart
                                const lockInfo = getLockInfo?.(d.id)
                                const lockedByOther = lockInfo?.isLocked && !lockInfo?.isOwnLock
                                return (
                                    <>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className={cn(
                                                "h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10",
                                                lockedByOther && "!opacity-0 pointer-events-none"
                                            )}
                                            disabled={deletingId === d.id || !!lockedByOther}
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                setConfirmDeleteId(d.id)
                                                setConfirmDeleteName(d.name)
                                            }}
                                        >
                                            {deletingId === d.id
                                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                : <Trash2 className="h-3.5 w-3.5" />}
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className={cn(
                                                "h-7 px-2 text-[11px] font-medium gap-0.5",
                                                lockedByOther
                                                    ? "text-muted-foreground cursor-not-allowed"
                                                    : "hover:bg-primary/10 hover:text-primary"
                                            )}
                                            disabled={!!lockedByOther}
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                handleLoadDraft(d)
                                            }}
                                        >
                                            {lockedByOther ? (
                                                <>
                                                    <Lock className="h-3 w-3" />
                                                    En uso
                                                </>
                                            ) : (
                                                <>
                                                    Cargar
                                                    <ChevronRight className="h-3 w-3" />
                                                </>
                                            )}
                                        </Button>
                                    </>
                                )
                            }}
                            emptyState={{
                                context: "generic",
                                title: "No hay borradores en esta sesión",
                                icon: Archive,
                            }}
                        />
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
