"use client"

import { useState } from "react"
import { Task, completeTask } from "@/lib/workflow/api"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, Clock, User, AlertCircle } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

interface TaskActionCardProps {
    task: Task
    onCompleted?: () => void
}

export function TaskActionCard({ task, onCompleted }: TaskActionCardProps) {
    const { user } = useAuth()
    const [loading, setLoading] = useState(false)

    const handleComplete = async () => {
        setLoading(true)
        try {
            await completeTask(task.id)
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
    const isInCandidateGroup = user && task.data?.candidate_group && user.groups?.includes(task.data.candidate_group)
    const isAuthorized = isAssignedToMe || isInCandidateGroup || user?.is_superuser

    return (
        <div className={cn(
            "p-4 border rounded-xl flex items-center justify-between transition-all",
            isPending ? "bg-amber-50/50 border-amber-200" : "bg-green-50/50 border-green-200"
        )}>
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

            {isPending && (
                <div className="flex flex-col items-end gap-2">
                    {isAuthorized ? (
                        <Button
                            size="sm"
                            onClick={handleComplete}
                            disabled={loading}
                            className="bg-primary hover:bg-primary/90 shadow-sm"
                        >
                            {loading ? "Completando..." : "Aprobar y Completar"}
                        </Button>
                    ) : (
                        <div className="flex items-center gap-1.5 text-[10px] bg-muted px-2 py-1 rounded text-muted-foreground">
                            <AlertCircle className="h-3 w-3" />
                            Solo responsables pueden aprobar
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
