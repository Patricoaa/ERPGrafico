"use client"

import { useState } from "react"
import { Task, completeTask } from "@/lib/workflow/api"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, Clock, User, AlertCircle } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Paperclip, MessageSquare, Download } from "lucide-react"

interface TaskActionCardProps {
    task: Task
    onCompleted?: () => void
}

export function TaskActionCard({ task, onCompleted }: TaskActionCardProps) {
    const { user } = useAuth()
    const [loading, setLoading] = useState(false)
    const [notes, setNotes] = useState("")
    const [files, setFiles] = useState<File[]>([])

    const handleComplete = async () => {
        setLoading(true)
        try {
            await completeTask(task.id, notes, files)
            toast.success("Tarea completada")
            if (onCompleted) onCompleted()
        } catch (e) {
            toast.error("No se pudo completar la tarea")
        } finally {
            setLoading(false)
        }
    }

    const isPending = task.status === 'PENDING' || task.status === 'IN_PROGRESS'
    const isAssignedToMe = user && task.assigned_to === user.id
    const isInCandidateGroup = (user as any)?.groups?.some((g: any) =>
        (task.assigned_group_name && g === task.assigned_group_name) ||
        (task.data?.candidate_group && g === task.data.candidate_group)
    )
    const isAuthorized = isAssignedToMe || isInCandidateGroup || user?.is_superuser

    return (
        <div className={cn(
            "p-4 border rounded-xl flex flex-col transition-all gap-4",
            isPending ? "bg-amber-50/50 border-amber-200" : "bg-green-50/50 border-green-200"
        )}>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className={cn(
                        "p-2 rounded-full",
                        isPending ? "bg-amber-100 text-amber-600" : "bg-green-100 text-green-600"
                    )}>
                        {isPending ? <Clock className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
                    </div>
                    <div className="space-y-1">
                        <h4 className="text-sm font-semibold">{task.title}</h4>
                        <p className="text-xs text-muted-foreground">{task.description}</p>
                        <div className="flex items-center gap-3 mt-1">
                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-medium">
                                <User className="h-3 w-3 text-primary/70" />
                                {task.assigned_to_data ? (
                                    <span>Asignado a: <span className="text-foreground">{task.assigned_to_data.username}</span></span>
                                ) : task.assigned_group_name ? (
                                    <span>Grupo: <span className="text-foreground">{task.assigned_group_name}</span></span>
                                ) : task.data?.candidate_group ? (
                                    <span>Grupo: <span className="text-foreground">{task.data.candidate_group}</span></span>
                                ) : (
                                    <span>Sin asignar</span>
                                )}
                            </div>
                            <Badge variant={isPending ? "outline" : "default"} className={cn(
                                "text-[10px] h-4",
                                isPending ? "border-amber-500 text-amber-700 bg-amber-50" : "bg-green-500"
                            )}>
                                {isPending ? 'Pendiente' : 'Completada'}
                            </Badge>
                        </div>
                    </div>
                </div>

                {/* Completion details for history */}
                {!isPending && (
                    <div className="text-[10px] text-right text-muted-foreground">
                        <p>Aprobado por: <span className="font-bold">{task.completed_by_data?.username || 'Sistema'}</span></p>
                        <p>{task.completed_at ? new Date(task.completed_at).toLocaleString() : ''}</p>
                    </div>
                )}
            </div>

            {/* Note & File display when completed */}
            {!isPending && (task.notes || (task.attachments_data && task.attachments_data.length > 0)) && (
                <div className="bg-white/40 p-3 rounded-lg border-t border-green-100 space-y-2">
                    {task.notes && (
                        <div className="flex gap-2">
                            <MessageSquare className="h-3 w-3 text-green-600 shrink-0 mt-0.5" />
                            <p className="text-xs italic text-slate-700">{task.notes}</p>
                        </div>
                    )}
                    {task.attachments_data && task.attachments_data.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {task.attachments_data.map((att: any) => (
                                <a
                                    key={att.id}
                                    href={att.file}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1.5 px-2 py-1 bg-white border border-green-200 rounded text-[10px] text-green-700 hover:bg-green-50 transition-colors"
                                >
                                    <Paperclip className="h-3 w-3 text-green-600" />
                                    <span className="max-w-[150px] truncate font-medium">{att.original_filename}</span>
                                    <Download className="h-3 w-3 opacity-40 ml-0.5" />
                                </a>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {isPending && (
                <div className="space-y-3 pt-2 border-t border-amber-100">
                    {isAuthorized ? (
                        <>
                            <div className="space-y-1.5">
                                <Label className="text-[10px] uppercase font-bold text-amber-700">Notas de Aprobación (Opcional)</Label>
                                <Textarea
                                    placeholder="Agregue un comentario o registro de esta etapa..."
                                    className="text-xs min-h-[60px] bg-white border-amber-200"
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-[10px] uppercase font-bold text-amber-700">Adjuntos (Opcional)</Label>
                                <div className="flex gap-2">
                                    <Input
                                        type="file"
                                        multiple
                                        className="text-xs h-8 bg-white border-amber-200 file:text-[10px] file:uppercase file:font-bold file:bg-amber-100 file:border-0 file:rounded-sm hover:file:bg-amber-200 transition-colors"
                                        onChange={(e) => {
                                            if (e.target.files) setFiles(Array.from(e.target.files))
                                        }}
                                    />
                                    <Button
                                        size="sm"
                                        onClick={handleComplete}
                                        disabled={loading}
                                        className="bg-amber-600 hover:bg-amber-700 text-white shadow-sm h-8"
                                    >
                                        {loading ? "..." : "Aprobar"}
                                    </Button>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex items-center gap-1.5 text-[10px] bg-amber-100/50 px-2 py-2 rounded text-amber-800">
                            <AlertCircle className="h-3 w-3" />
                            Esta etapa debe ser aprobada por: {task.assigned_to_data?.username || task.assigned_group_name || task.data?.candidate_group || 'el responsable'}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
