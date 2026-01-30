"use client"

import { Task } from "@/lib/workflow/api"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { CheckCircle2, Clock, User, Paperclip, MessageSquare, Download, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"

interface TaskActionCardProps {
    task: Task
    canComplete?: boolean
    onNotesChange?: (val: string) => void
    onFileChange?: (file: File | null) => void
    notesValue?: string
}

export function TaskActionCard({
    task,
    canComplete = false,
    onNotesChange,
    onFileChange,
    notesValue = ""
}: TaskActionCardProps) {
    const isPending = task.status === 'PENDING' || task.status === 'IN_PROGRESS'

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

            {/* Action Area for Pending Tasks - Now just Inputs, no button */}
            {isPending && (
                <div className="space-y-3 pt-2">
                    {canComplete ? (
                        <div className="bg-white p-3 rounded-lg border border-amber-100 space-y-3 animate-in fade-in slide-in-from-top-1">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-muted-foreground">Comentarios (Opcional)</label>
                                    <Textarea
                                        placeholder="Agregar notas sobre esta aprobación..."
                                        className="h-20 text-xs resize-none bg-background"
                                        value={notesValue}
                                        onChange={(e) => onNotesChange?.(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-muted-foreground">Adjuntar Archivo (Opcional)</label>
                                    <Input
                                        type="file"
                                        className="text-xs h-8"
                                        onChange={(e) => onFileChange?.(e.target.files ? e.target.files[0] : null)}
                                    />
                                    <p className="text-[10px] text-muted-foreground italic">
                                        * Al avanzar a la siguiente etapa, esta tarea se marcará como aprobada automáticamente.
                                    </p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-1.5 text-[10px] bg-red-100/50 px-3 py-2 rounded text-red-800 border-t border-red-100">
                            <AlertCircle className="h-3 w-3 shrink-0" />
                            No tienes permisos para aprobar esta tarea. Asignado a: {task.assigned_to_data?.username || task.assigned_group_name || task.data?.candidate_group || 'Otro usuario'}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

