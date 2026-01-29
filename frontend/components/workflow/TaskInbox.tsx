"use client"

import { useState, useEffect } from "react"
import { getTasks, completeTask, Task } from "@/lib/workflow/api"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { translateStatus } from "@/lib/utils"
import { Search, CheckCircle2, AlertCircle, Clock, Filter } from "lucide-react"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

export function TaskInbox() {
    const [tasks, setTasks] = useState<Task[]>([])
    const [loading, setLoading] = useState(true)
    const [filterStatus, setFilterStatus] = useState<string>("PENDING")
    const [search, setSearch] = useState("")
    const router = useRouter()

    const fetchTasks = async () => {
        setLoading(true)
        try {
            const params: any = {}
            if (filterStatus !== "ALL") params.status = filterStatus
            if (search) params.search = search

            const res = await getTasks(params)
            const list = Array.isArray(res) ? res : (res.results || [])
            setTasks(list)
        } catch (error) {
            toast.error("Error al cargar tareas")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchTasks()
    }, [filterStatus])

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault()
        fetchTasks()
    }

    const handleComplete = async (taskId: number) => {
        try {
            await completeTask(taskId)
            toast.success("Tarea completada")
            fetchTasks()
        } catch (error) {
            toast.error("Error al completar tarea")
        }
    }

    // If task has extra data with link, navigate. If GenericFK, we need to construct it
    const handleNavigation = (task: Task) => {
        // Simple logic for now, refine based on content_type
        // assuming data might have 'link' or we construct it
        // This is a placeholder since we don't return fully resolved content_type logic from serializer yet
        // Ideally serializer field 'resource_url'
        toast.info("Navegación a recurso aun no implementada")
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Bandeja de Tareas</h2>
                    <p className="text-muted-foreground">Gestiona tus asignaciones pendientes y flujo de trabajo.</p>
                </div>
                <form onSubmit={handleSearch} className="flex items-center gap-2 w-full md:w-auto">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar tarea..."
                            className="pl-9 w-[300px]"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </form>
            </div>

            <Tabs defaultValue="PENDING" onValueChange={setFilterStatus} className="w-full">
                <TabsList>
                    <TabsTrigger value="PENDING" className="gap-2">
                        <Clock className="h-4 w-4" /> Pendientes
                    </TabsTrigger>
                    <TabsTrigger value="IN_PROGRESS" className="gap-2">
                        <AlertCircle className="h-4 w-4" /> En Proceso
                    </TabsTrigger>
                    <TabsTrigger value="COMPLETED" className="gap-2">
                        <CheckCircle2 className="h-4 w-4" /> Completadas
                    </TabsTrigger>
                    <TabsTrigger value="ALL">Todas</TabsTrigger>
                </TabsList>
            </Tabs>

            {loading ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-40 rounded-xl bg-muted/20 animate-pulse" />
                    ))}
                </div>
            ) : tasks.length === 0 ? (
                <div className="text-center py-20 bg-muted/10 rounded-xl border border-dashed text-muted-foreground">
                    <CheckCircle2 className="h-10 w-10 mx-auto mb-4 opacity-20" />
                    <p>No tienes tareas en este estado.</p>
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {tasks.map((task) => (
                        <Card key={task.id} className="group hover:border-primary/50 transition-colors">
                            <CardHeader className="pb-3">
                                <div className="flex justify-between items-start gap-2">
                                    <div className="space-y-1">
                                        <CardTitle className="text-base font-semibold line-clamp-1">{task.title}</CardTitle>
                                        <CardDescription className="text-xs">{task.task_type}</CardDescription>
                                    </div>
                                    <Badge variant={task.priority === 'HIGH' || task.priority === 'CRITICAL' ? 'destructive' : 'secondary'} className="text-[10px] uppercase">
                                        {task.priority}
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-muted-foreground line-clamp-3 mb-4 h-[60px]">
                                    {task.description}
                                </p>

                                <div className="flex items-center justify-between mt-auto">
                                    <span className="text-xs text-muted-foreground">
                                        {new Date(task.created_at).toLocaleDateString()}
                                    </span>

                                    <div className="flex gap-2">
                                        {task.status !== 'COMPLETED' && (
                                            <Button size="sm" onClick={() => handleComplete(task.id)}>
                                                Completar
                                            </Button>
                                        )}
                                        <Button size="sm" variant="outline" onClick={() => handleNavigation(task)}>
                                            Ver
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    )
}
