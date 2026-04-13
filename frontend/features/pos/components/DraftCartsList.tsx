"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { BaseModal } from "@/components/shared/BaseModal"
import { ScrollArea } from "@/components/ui/scroll-area"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"
import { formatCurrency } from "@/lib/utils"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import api from "@/lib/api"
import {
    Archive,
    Trash2,
    Loader2,
    RefreshCw,
    ClipboardCheck,
    ShoppingCart,
    User,
    ChevronRight,
    Lock,
    Wallet,
} from "lucide-react"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import type { SyncDraft } from '@/features/pos/hooks/useDraftSync'

interface DraftCart {
    id: number
    name: string
    notes: string
    customer: number | null
    customer_name: string | null
    items: any[]
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
        dteData: any
        paymentData: any
        deliveryData: any
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

interface DraftCartsListProps {
    posSessionId: number | null
    onLoadDraft: (draft: DraftCart) => void
    onDraftDeleted?: () => void
    open?: boolean
    onOpenChange?: (open: boolean) => void
    showTrigger?: boolean
    /** Real-time sync data for lock indicators */
    syncDrafts?: SyncDraft[]
    /** Function to get lock info for a draft */
    getLockInfo?: (draftId: number) => LockInfo
}

export function DraftCartsList({
    posSessionId,
    onLoadDraft,
    onDraftDeleted,
    open: externalOpen,
    onOpenChange: setExternalOpen,
    showTrigger = true,
    syncDrafts,
    getLockInfo,
}: DraftCartsListProps) {
    const [drafts, setDrafts] = useState<DraftCart[]>([])
    const [loading, setLoading] = useState(false)
    const [internalOpen, setInternalOpen] = useState(false)
    const [deletingId, setDeletingId] = useState<number | null>(null)
    const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
    const [confirmDeleteName, setConfirmDeleteName] = useState("")
    const [prevDraftIds, setPrevDraftIds] = useState<Set<number>>(new Set())

    const isControlled = externalOpen !== undefined
    const open = isControlled ? externalOpen : internalOpen
    const setOpen = isControlled ? setExternalOpen! : setInternalOpen

    const fetchDrafts = async () => {
        if (!posSessionId) {
            toast.error("No hay sesión activa")
            return
        }
        setLoading(true)
        try {
            const response = await api.get(`/sales/pos-drafts/?pos_session_id=${posSessionId}`)
            const data = response.data.results || response.data
            const newDrafts = Array.isArray(data) ? data : []
            setDrafts(newDrafts)
            setPrevDraftIds(new Set(newDrafts.map((d: DraftCart) => d.id)))
        } catch (error: unknown) {
            console.error("Error al cargar borradores:", error)
            toast.error("Error al cargar los borradores")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (open && posSessionId) {
            fetchDrafts()
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
            fetchDrafts()
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
        } catch (error) {
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
            await api.delete(`/sales/pos-drafts/${draftId}/?pos_session_id=${posSessionId}`)
            toast.success(`Borrador "${draftName}" eliminado`)
            await fetchDrafts()
            onDraftDeleted?.()
        } catch (error: unknown) {
            console.error("Error al eliminar borrador:", error)
            if (error.response?.status === 404) {
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

    const formatRelative = (dateString: string) => {
        try {
            const diff = Date.now() - new Date(dateString).getTime()
            const mins = Math.floor(diff / 60000)
            if (mins < 1) return "Ahora"
            if (mins < 60) return `Hace ${mins}m`
            const hrs = Math.floor(mins / 60)
            if (hrs < 24) return `Hace ${hrs}h`
            return new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: '2-digit' }).format(new Date(dateString))
        } catch { return dateString }
    }

    return (
        <>
            {showTrigger && (
                <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
                    <Archive className="h-4 w-4 mr-2" />
                    Ver Borradores
                    {drafts.length > 0 && (
                        <span className="ml-2 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border border-muted-foreground/20 bg-muted/30 text-muted-foreground">
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
                    <div className="flex items-center justify-between w-full pr-8">
                        <div className="flex items-center gap-2">
                            <Archive className="h-4 w-4 text-muted-foreground" />
                            <span>Borradores</span>
                            {drafts.length > 0 && (
                                <span className="text-[10px] h-4 px-1.5 font-bold bg-muted text-muted-foreground rounded border border-muted-foreground/20 leading-none flex items-center">
                                    {drafts.length}
                                </span>
                            )}
                        </div>
                        <Button variant="ghost" size="sm" onClick={fetchDrafts} disabled={loading}>
                            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
                        </Button>
                    </div>
                }
            >
                <div className="py-1">
                    {loading ? (
                        <div className="flex items-center justify-center py-12 text-muted-foreground">
                            <Loader2 className="h-6 w-6 animate-spin mr-2" />
                            <span className="text-sm">Cargando...</span>
                        </div>
                    ) : drafts.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                            <Archive className="h-10 w-10 mb-3 opacity-30" />
                            <p className="text-sm">No hay borradores en esta sesión</p>
                        </div>
                    ) : (
                        <TooltipProvider delayDuration={200}>
                        <ScrollArea className="max-h-[65vh]">
                            {/* Column headers */}
                            <div className="grid grid-cols-[2rem_1fr_auto_auto_auto] gap-x-3 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-b">
                                <span className="text-center">#</span>
                                <span>Nombre / Cliente</span>
                                <span className="text-center">Ítems</span>
                                <span className="text-right">Total</span>
                                <span />
                            </div>

                            <div className="divide-y divide-border/60">
                                {drafts.map((draft) => {
                                    const lockInfo = getLockInfo?.(draft.id)
                                    const lockedByOther = lockInfo?.isLocked && !lockInfo?.isOwnLock
                                    
                                    return (
                                    <div
                                        key={draft.id}
                                        className={cn(
                                            "grid grid-cols-[2rem_1fr_auto_auto_auto] gap-x-3 items-center px-3 py-2.5 hover:bg-muted/40 transition-all group animate-in fade-in duration-300",
                                            lockedByOther && "bg-destructive/[0.03] hover:bg-destructive/[0.06]"
                                        )}
                                    >
                                        {/* ID */}
                                        <span className={cn(
                                            "text-center text-[11px] font-mono font-bold",
                                            lockedByOther ? "text-destructive/60" : "text-primary/70"
                                        )}>
                                            {draft.id}
                                        </span>

                                        {/* Name + meta */}
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <span className="text-sm font-medium truncate leading-tight">
                                                    {draft.name || `Borrador #${draft.id}`}
                                                </span>
                                                {/* Lock indicator */}
                                                {lockedByOther && (
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <span className="h-4 px-1.5 text-[9px] font-bold uppercase rounded border bg-destructive/10 text-destructive border-destructive/30 gap-1 flex items-center shrink-0 cursor-help">
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
                                                    <span className="h-4 px-1.5 text-[9px] font-bold uppercase rounded border bg-primary/10 text-primary border-primary/30 gap-1 flex items-center shrink-0">
                                                        <Lock className="h-2.5 w-2.5" />
                                                        Tú
                                                    </span>
                                                )}
                                                {draft.wizard_state?.isWaitingPayment && !lockedByOther && (
                                                    <span className="h-4 px-1.5 text-[9px] font-bold uppercase rounded border bg-warning/10 text-warning border-warning/20 gap-1 flex items-center shrink-0 shadow-sm">
                                                        <Wallet className="h-2.5 w-2.5" />
                                                        Por Pagar
                                                    </span>
                                                )}
                                                {draft.wizard_state?.step && !draft.wizard_state?.isWaitingPayment && !lockedByOther && (
                                                    <span className="h-4 px-1.5 text-[9px] font-bold uppercase rounded border bg-warning/10 text-warning border-warning/20 gap-1 flex items-center shrink-0">
                                                        <ClipboardCheck className="h-2.5 w-2.5" />
                                                        P{draft.wizard_state.step}
                                                    </span>
                                                )}
                                                {draft.wizard_state?.isWaitingApproval && (
                                                    <span className="h-4 px-1.5 text-[9px] font-bold uppercase rounded border bg-primary/10 text-primary border-primary/20 gap-1 flex items-center shrink-0">
                                                        <Loader2 className="h-2.5 w-2.5 animate-spin" />
                                                        Auth
                                                    </span>
                                                )}
                                                {draft.wizard_state?.isApproved && (
                                                    <span className="h-4 px-1.5 text-[9px] font-bold uppercase rounded border bg-success/10 text-success border-success/20 gap-1 flex items-center shrink-0">
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

                                        {/* Item count */}
                                        <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground justify-center">
                                            <ShoppingCart className="h-3 w-3" />
                                            {draft.item_count}
                                        </span>

                                        {/* Total */}
                                        <span className="text-sm font-semibold text-right tabular-nums">
                                            {formatCurrency(draft.total_gross)}
                                        </span>

                                        {/* Actions */}
                                        <div className="flex items-center gap-1 justify-end">
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className={cn(
                                                    "h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10",
                                                    lockedByOther && "!opacity-0 pointer-events-none"
                                                )}
                                                disabled={deletingId === draft.id || !!lockedByOther}
                                                onClick={() => {
                                                    setConfirmDeleteId(draft.id)
                                                    setConfirmDeleteName(draft.name)
                                                }}
                                            >
                                                {deletingId === draft.id
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
                                                onClick={() => handleLoadDraft(draft)}
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
                                        </div>
                                    </div>
                                    )
                                })}
                            </div>
                        </ScrollArea>
                        </TooltipProvider>
                    )}
                </div>
            </BaseModal>

            <AlertDialog open={!!confirmDeleteId} onOpenChange={(o) => !o && setConfirmDeleteId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar borrador?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Se eliminará permanentemente <strong>"{confirmDeleteName}"</strong>. Esta acción no se puede deshacer.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                if (confirmDeleteId) {
                                    handleDeleteDraft(confirmDeleteId, confirmDeleteName)
                                    setConfirmDeleteId(null)
                                }
                            }}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Eliminar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
