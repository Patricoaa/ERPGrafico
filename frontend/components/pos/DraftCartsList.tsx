"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BaseModal } from "@/components/shared/BaseModal"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { formatCurrency } from "@/lib/utils"
import { toast } from "sonner"
import api from "@/lib/api"
import {
    Archive,
    Calendar,
    User,
    ShoppingCart,
    Trash2,
    Loader2,
    RefreshCw,
    ClipboardCheck,
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
    } | null
}

interface DraftCartsListProps {
    posSessionId: number | null
    onLoadDraft: (draft: DraftCart) => void
    onDraftDeleted?: () => void
    open?: boolean
    onOpenChange?: (open: boolean) => void
    showTrigger?: boolean
}

export function DraftCartsList({
    posSessionId,
    onLoadDraft,
    onDraftDeleted,
    open: externalOpen,
    onOpenChange: setExternalOpen,
    showTrigger = true
}: DraftCartsListProps) {
    const [drafts, setDrafts] = useState<DraftCart[]>([])
    const [loading, setLoading] = useState(false)
    const [internalOpen, setInternalOpen] = useState(false)
    const [deletingId, setDeletingId] = useState<number | null>(null)
    const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
    const [confirmDeleteName, setConfirmDeleteName] = useState("")

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
            setDrafts(Array.isArray(data) ? data : [])
        } catch (error: any) {
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

    const handleLoadDraft = async (draft: DraftCart) => {
        try {
            await onLoadDraft(draft)
            setOpen(false)
        } catch (error) {
            // Already handled
        }
    }

    const handleDeleteDraft = async (draftId: number, draftName: string) => {
        if (!posSessionId) return

        setDeletingId(draftId)
        try {
            await api.delete(`/sales/pos-drafts/${draftId}/?pos_session_id=${posSessionId}`)
            toast.success(`Borrador "${draftName}" eliminado`)
            await fetchDrafts()
            onDraftDeleted?.()
        } catch (error: any) {
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

    const formatDate = (dateString: string) => {
        try {
            const date = new Date(dateString)
            return new Intl.DateTimeFormat('es-CL', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            }).format(date)
        } catch (e) {
            return dateString
        }
    }

    return (
        <>
            {showTrigger && (
                <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
                    <Archive className="h-4 w-4 mr-2" />
                    Ver Borradores
                    {drafts.length > 0 && (
                        <Badge variant="secondary" className="ml-2">
                            {drafts.length}
                        </Badge>
                    )}
                </Button>
            )}

            <BaseModal
                open={open}
                onOpenChange={setOpen}
                size="lg"
                title={
                    <div className="flex items-center justify-between w-full pr-8">
                        <span>Borradores de Carrito</span>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={fetchDrafts}
                            disabled={loading}
                        >
                            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        </Button>
                    </div>
                }
            >
                <div className="py-2">
                    <ScrollArea className="h-[60vh] pr-4">
                        {loading ? (
                            <div className="flex items-center justify-center h-full min-h-[200px]">
                                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                            </div>
                        ) : drafts.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-muted-foreground">
                                <Archive className="h-12 w-12 mb-4 opacity-50" />
                                <p>No hay borradores guardados en esta sesión</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {drafts.map((draft) => (
                                    <Card key={draft.id} className="hover:border-primary/50 transition-colors">
                                        <CardHeader className="pb-3">
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1">
                                                    <CardTitle className="text-base font-semibold mb-1">
                                                        {draft.name || `Borrador #${draft.id}`}
                                                    </CardTitle>
                                                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                                                        <div className="flex items-center gap-1">
                                                            <Calendar className="h-3 w-3" />
                                                            {formatDate(draft.updated_at)}
                                                        </div>
                                                        {draft.last_modified_by_full_name && (
                                                            <div className="flex items-center gap-1">
                                                                <User className="h-3 w-3" />
                                                                {draft.last_modified_by_full_name}
                                                            </div>
                                                        )}
                                                        <div className="flex items-center gap-1">
                                                            <ShoppingCart className="h-3 w-3" />
                                                            {draft.item_count} item{draft.item_count !== 1 ? 's' : ''}
                                                        </div>
                                                    </div>
                                                </div>
                                                <Badge variant="secondary" className="ml-2">
                                                    {formatCurrency(draft.total_gross)}
                                                </Badge>
                                            </div>
                                            <div className="mt-2 flex flex-wrap gap-2">
                                                {draft.wizard_state && (
                                                    <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200 gap-1 text-[10px] items-center h-5">
                                                        <ClipboardCheck className="h-3 w-3" />
                                                        Venta en curso (Paso {draft.wizard_state.step})
                                                    </Badge>
                                                )}
                                            </div>
                                        </CardHeader>
                                        <CardContent className="pt-0">
                                            {draft.customer_name && (
                                                <p className="text-sm text-muted-foreground mb-2">
                                                    Cliente: <span className="font-medium text-foreground">{draft.customer_name}</span>
                                                </p>
                                            )}
                                            {draft.notes && (
                                                <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                                                    {draft.notes}
                                                </p>
                                            )}
                                            <Separator className="my-3" />
                                            <div className="flex gap-2">
                                                <Button
                                                    onClick={() => handleLoadDraft(draft)}
                                                    size="sm"
                                                    className="flex-1"
                                                >
                                                    Cargar
                                                </Button>
                                                <Button
                                                    onClick={() => {
                                                        setConfirmDeleteId(draft.id)
                                                        setConfirmDeleteName(draft.name)
                                                    }}
                                                    size="sm"
                                                    variant="destructive"
                                                    disabled={deletingId === draft.id}
                                                >
                                                    {deletingId === draft.id ? (
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                    ) : (
                                                        <Trash2 className="h-4 w-4" />
                                                    )}
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </ScrollArea>
                </div>
            </BaseModal>

            <AlertDialog open={!!confirmDeleteId} onOpenChange={(o) => !o && setConfirmDeleteId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Está seguro de eliminar el borrador?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción eliminará permanentemente el borrador "{confirmDeleteName}" y no se podrá deshacer.
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
