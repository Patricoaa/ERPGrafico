"use client"

import { useState } from "react"
import { Task, completeTask } from "@/lib/workflow/api"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, Clock, User, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

interface TaskActionCardProps {
    task: Task
    onCompleted?: () => void
}

export function TaskActionCard({ task, onCompleted }: TaskActionCardProps) {
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
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <User className="h-3 w-3" />
                            <span>Asignado a: {task.assigned_to_data?.username || 'Sin asignar'}</span>
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
                <Button
                    size="sm"
                    onClick={handleComplete}
                    disabled={loading}
                    className="bg-primary hover:bg-primary/90"
                >
                    {loading ? "Completando..." : "Aprobar y Completar"}
                </Button>
            )}
        </div>
    )
}
