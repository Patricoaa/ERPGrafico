"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { BaseModal } from "@/components/shared/BaseModal"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, Loader2, XCircle, Zap } from "lucide-react"
import { cn } from "@/lib/utils"
import api from "@/lib/api"
import { toast } from "sonner"
import { showApiError } from "@/lib/errors"

// ─── Types ─────────────────────────────────────────────────────────────────

type TaskStatus = 'idle' | 'PENDING' | 'PROGRESS' | 'SUCCESS' | 'FAILURE'

interface ProgressData {
    status: TaskStatus
    processed: number
    total: number
    matched: number
    matched_count?: number
    total_unreconciled?: number
    percent: number
    error?: string
}

interface AutoMatchProgressModalProps {
    open: boolean
    statementId: number
    confidenceThreshold: number
    onOpenChange: (open: boolean) => void
    onSuccess: (matchedCount: number, totalUnreconciled: number) => void
}

// ─── Component ─────────────────────────────────────────────────────────────

export function AutoMatchProgressModal({
    open,
    statementId,
    confidenceThreshold,
    onOpenChange,
    onSuccess,
}: AutoMatchProgressModalProps) {
    const [taskId, setTaskId] = useState<string | null>(null)
    const [progress, setProgress] = useState<ProgressData>({
        status: 'idle',
        processed: 0,
        total: 0,
        matched: 0,
        percent: 0,
    })
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const startedRef = useRef(false)

    const stopPolling = useCallback(() => {
        if (pollRef.current) {
            clearInterval(pollRef.current)
            pollRef.current = null
        }
    }, [])

    const startPolling = useCallback((id: string) => {
        stopPolling()
        pollRef.current = setInterval(async () => {
            try {
                const res = await api.get(
                    `/treasury/statements/${statementId}/auto_match_status/`,
                    { params: { task_id: id } }
                )
                const data: ProgressData = res.data
                setProgress(data)

                if (data.status === 'SUCCESS') {
                    stopPolling()
                    const matched = data.matched_count ?? data.matched
                    const total = data.total_unreconciled ?? data.total
                    toast.success(`Auto-match finalizado`, {
                        description: `${matched} de ${total} líneas conciliadas.`
                    })
                    onSuccess(matched, total)
                }

                if (data.status === 'FAILURE') {
                    stopPolling()
                    toast.error("Error en auto-match", {
                        description: data.error || "Ocurrió un error inesperado."
                    })
                }
            } catch {
                // silently ignore transient network errors during polling
            }
        }, 1000)
    }, [statementId, stopPolling, onSuccess])

    // Start the task when the modal opens
    useEffect(() => {
        if (!open || startedRef.current) return
        startedRef.current = true

        const launchTask = async () => {
            try {
                setProgress({ status: 'PENDING', processed: 0, total: 0, matched: 0, percent: 0 })
                const res = await api.post(`/treasury/statements/${statementId}/auto_match/`, {
                    confidence_threshold: confidenceThreshold,
                })
                const id: string = res.data.task_id
                setTaskId(id)
                startPolling(id)
            } catch (err) {
                showApiError(err, "Error al iniciar auto-match")
                onOpenChange(false)
            }
        }

        launchTask()
    }, [open, statementId, confidenceThreshold, startPolling, onOpenChange])

    // Cleanup on unmount
    useEffect(() => {
        return () => stopPolling()
    }, [stopPolling])

    // Reset when closed
    const handleClose = useCallback((val: boolean) => {
        if (!val) {
            stopPolling()
            startedRef.current = false
            setTaskId(null)
            setProgress({ status: 'idle', processed: 0, total: 0, matched: 0, percent: 0 })
        }
        onOpenChange(val)
    }, [stopPolling, onOpenChange])

    const isDone = progress.status === 'SUCCESS' || progress.status === 'FAILURE'
    const isRunning = progress.status === 'PENDING' || progress.status === 'PROGRESS'

    return (
        <BaseModal
            open={open}
            onOpenChange={handleClose}
            title="Auto-Match Inteligente"
            description="El sistema está analizando y conciliando líneas de cartola automáticamente."
            footer={
                <div className="flex justify-end w-full">
                    {isDone ? (
                        <Button onClick={() => handleClose(false)}>
                            Cerrar
                        </Button>
                    ) : (
                        <Button
                            variant="outline"
                            onClick={() => handleClose(false)}
                            className="text-muted-foreground"
                        >
                            Cancelar
                        </Button>
                    )}
                </div>
            }
        >
            <div className="space-y-6 py-4">
                {/* Status Icon */}
                <div className="flex flex-col items-center gap-3">
                    {progress.status === 'SUCCESS' && (
                        <div className="rounded-full bg-success/10 p-4">
                            <CheckCircle2 className="h-10 w-10 text-success" />
                        </div>
                    )}
                    {progress.status === 'FAILURE' && (
                        <div className="rounded-full bg-destructive/10 p-4">
                            <XCircle className="h-10 w-10 text-destructive" />
                        </div>
                    )}
                    {isRunning && (
                        <div className="rounded-full bg-primary/10 p-4">
                            <Zap className="h-10 w-10 text-primary animate-pulse" />
                        </div>
                    )}
                    {progress.status === 'idle' && (
                        <div className="rounded-full bg-muted p-4">
                            <Loader2 className="h-10 w-10 text-muted-foreground animate-spin" />
                        </div>
                    )}

                    {/* Status Badge */}
                    <Badge
                        variant="outline"
                        className={cn(
                            "font-black uppercase text-xs tracking-widest px-3 py-1",
                            progress.status === 'SUCCESS' && "border-success/30 bg-success/10 text-success",
                            progress.status === 'FAILURE' && "border-destructive/30 bg-destructive/10 text-destructive",
                            isRunning && "border-primary/30 bg-primary/10 text-primary",
                        )}
                    >
                        {progress.status === 'idle' && "Iniciando..."}
                        {progress.status === 'PENDING' && "En Cola..."}
                        {progress.status === 'PROGRESS' && "Procesando..."}
                        {progress.status === 'SUCCESS' && "Completado"}
                        {progress.status === 'FAILURE' && "Error"}
                    </Badge>
                </div>

                {/* Progress Bar */}
                <div className="space-y-2">
                    <div className="flex justify-between text-xs font-bold text-muted-foreground uppercase tracking-wider">
                        <span>Progreso</span>
                        <span className="font-mono">{progress.percent}%</span>
                    </div>
                    <Progress
                        value={progress.percent}
                        className={cn(
                            "h-3 transition-all duration-300",
                            progress.status === 'SUCCESS' && "[&>div]:bg-success",
                            progress.status === 'FAILURE' && "[&>div]:bg-destructive",
                        )}
                    />
                </div>

                {/* Stats Grid */}
                {(progress.status === 'PROGRESS' || progress.status === 'SUCCESS') && (
                    <div className="grid grid-cols-3 gap-3">
                        <div className="rounded-lg bg-muted/50 border p-3 text-center">
                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">
                                Procesadas
                            </p>
                            <p className="text-2xl font-black font-mono text-foreground">
                                {progress.status === 'SUCCESS'
                                    ? (progress.total_unreconciled ?? progress.total)
                                    : progress.processed}
                            </p>
                            <p className="text-[10px] text-muted-foreground font-medium">
                                de {progress.total_unreconciled ?? progress.total}
                            </p>
                        </div>
                        <div className="rounded-lg bg-success/5 border border-success/20 p-3 text-center">
                            <p className="text-[10px] font-black uppercase tracking-widest text-success/70 mb-1">
                                Conciliadas
                            </p>
                            <p className="text-2xl font-black font-mono text-success">
                                {progress.matched_count ?? progress.matched}
                            </p>
                            <p className="text-[10px] text-success/70 font-medium">matches</p>
                        </div>
                        <div className="rounded-lg bg-warning/5 border border-warning/20 p-3 text-center">
                            <p className="text-[10px] font-black uppercase tracking-widest text-warning/70 mb-1">
                                Sin Conciliar
                            </p>
                            <p className="text-2xl font-black font-mono text-warning">
                                {(progress.total_unreconciled ?? progress.total) - (progress.matched_count ?? progress.matched)}
                            </p>
                            <p className="text-[10px] text-warning/70 font-medium">sin match</p>
                        </div>
                    </div>
                )}

                {/* Error message */}
                {progress.status === 'FAILURE' && progress.error && (
                    <div className="rounded-lg bg-destructive/5 border border-destructive/20 p-3">
                        <p className="text-xs font-medium text-destructive">{progress.error}</p>
                    </div>
                )}

                {/* Pending message */}
                {progress.status === 'PENDING' && (
                    <p className="text-center text-sm text-muted-foreground">
                        Esperando que un worker Celery procese la tarea...
                    </p>
                )}
            </div>
        </BaseModal>
    )
}
