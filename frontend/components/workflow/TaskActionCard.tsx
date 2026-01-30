"use client"

import { Task } from "@/lib/workflow/api"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, Clock, User, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"

import { Paperclip, MessageSquare, Download } from "lucide-react"

interface TaskActionCardProps {
    task: Task
}

export function TaskActionCard({ task }: TaskActionCardProps) {
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

            {/* Pending tasks show who's responsible */}
            {isPending && (
                <div className="flex items-center gap-1.5 text-[10px] bg-amber-100/50 px-3 py-2 rounded text-amber-800 border-t border-amber-100">
                    <AlertCircle className="h-3 w-3 shrink-0" />
                    Esta aprobación debe ser completada por: {task.assigned_to_data?.username || task.assigned_group_name || task.data?.candidate_group || 'el responsable asignado'}
                </div>
            )}
        </div>
    )
}
