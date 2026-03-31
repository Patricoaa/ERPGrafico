"use client"

import { Task } from "@/lib/workflow/api"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { CheckCircle2, Circle, Clock, User, Paperclip, MessageSquare, Download, AlertCircle, ChevronDown, ChevronUp } from "lucide-react"
import { cn } from "@/lib/utils"
import { useState } from "react"
import { Button } from "@/components/ui/button"

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
    const [isExpanded, setIsExpanded] = useState(false)

    return (
        <div className={cn(
            "p-3 border rounded-lg flex flex-col transition-all gap-2",
            isPending ? "bg-amber-50/30 border-amber-200" : "bg-green-50/30 border-green-200 opacity-80"
        )}>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className={cn(
                        "flex items-center justify-center rounded-full shrink-0",
                        isPending ? "text-amber-500" : "text-emerald-700 bg-emerald-100 p-0.5"
                    )}>
                        {isPending ? <Circle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                    </div>
                    <div className="space-y-0.5">
                        <h4 className="text-sm font-semibold flex items-center gap-2">
                            {task.title}
                            {!isPending && (
                                <span className="text-[10px] font-normal text-muted-foreground bg-white px-1.5 py-0.5 rounded border">
                                    ✓ {task.completed_by_data?.username || 'Sistema'}
                                </span>
                            )}
                        </h4>
                        <p className="text-xs text-muted-foreground">{task.description}</p>
                    </div>
                </div>

                <div className="flex flex-col items-end gap-1 shrink-0">
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-medium">
                        <User className="h-3 w-3 text-primary/60" />
                        {task.assigned_to_data ? (
                            <span><span className="text-foreground">{task.assigned_to_data.username}</span></span>
                        ) : task.assigned_group_name ? (
                            <span><span className="text-foreground">{task.assigned_group_name}</span></span>
                        ) : task.data?.candidate_group ? (
                            <span><span className="text-foreground">{task.data.candidate_group}</span></span>
                        ) : (
                            <span>Sin asignar</span>
                        )}
                    </div>
                    
                    {isPending && canComplete && (
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-6 text-[10px] px-2 text-muted-foreground hover:text-primary"
                            onClick={() => setIsExpanded(!isExpanded)}
                        >
                            {isExpanded ? "Ocultar detalles" : "Añadir Evidencia"}
                            {isExpanded ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />}
                        </Button>
                    )}
                </div>
            </div>

            {/* Note & File display when completed */}
            {!isPending && (task.notes || (task.attachments_data && task.attachments_data.length > 0)) && (
                <div className="bg-white/60 p-2.5 rounded border border-green-100/50 mt-1 ml-7 space-y-2">
                    {task.notes && (
                        <div className="flex gap-2">
                            <MessageSquare className="h-3 w-3 text-emerald-700 shrink-0 mt-0.5" />
                            <p className="text-xs italic text-foreground">{task.notes}</p>
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
                                    className="flex items-center gap-1.5 px-2 py-1 bg-white border border-green-200 rounded text-[10px] text-emerald-700 hover:bg-green-50 transition-colors"
                                >
                                    <Paperclip className="h-3 w-3 text-emerald-700" />
                                    <span className="max-w-[150px] truncate font-medium">{att.original_filename}</span>
                                    <Download className="h-3 w-3 opacity-40 ml-0.5" />
                                </a>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Action Area for Pending Tasks */}
            {isPending && isExpanded && (
                <div className="mt-2 ml-7">
                    {canComplete ? (
                        <div className="bg-white p-3 rounded border border-amber-100 space-y-3 animate-in fade-in slide-in-from-top-1">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-muted-foreground">Comentarios (Opcional)</label>
                                    <Textarea
                                        placeholder="Agregar notas u observaciones técnicas..."
                                        className="h-16 text-xs resize-none bg-background focus-visible:ring-1"
                                        value={notesValue}
                                        onChange={(e) => onNotesChange?.(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-1.5 flex flex-col justify-between">
                                    <div>
                                        <label className="text-xs font-semibold text-muted-foreground">Adjuntar Evidencia (Opcional)</label>
                                        <Input
                                            type="file"
                                            className="text-xs h-8 mt-1.5"
                                            onChange={(e) => onFileChange?.(e.target.files ? e.target.files[0] : null)}
                                        />
                                    </div>
                                    <p className="text-[10px] text-amber-600/80 italic leading-tight">
                                        * Al avanzar a la siguiente etapa, esta validación se marcará como completada automáticamente.
                                    </p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-1.5 text-[10px] bg-red-100/50 px-3 py-2 rounded text-red-800 border bg-red-50/50 border-red-100">
                            <AlertCircle className="h-3 w-3 shrink-0" />
                            Requiere validación por: {task.assigned_to_data?.username || task.assigned_group_name || task.data?.candidate_group}
                        </div>
                    )}
                </div>
            )}
            
            {/* Show permission warning even if not expanded if user can't complete */}
            {isPending && !canComplete && !isExpanded && (
               <div className="ml-7 flex items-center gap-1.5 text-[10px] bg-red-100/50 px-2.5 py-1.5 rounded text-red-800 border bg-red-50/50 border-red-100 w-fit mt-1">
                   <AlertCircle className="h-3 w-3 shrink-0" />
                   Requiere validación por: {task.assigned_to_data?.username || task.assigned_group_name || task.data?.candidate_group}
               </div> 
            )}
        </div>
    )
}
