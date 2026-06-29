"use client"

import { useBackgroundJobs, type BackgroundJob } from "@/features/settings"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { Download, AlertCircle, Loader2, RefreshCw } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"

export default function JobsPageClient() {
    const { jobs, isLoading, error, refetch } = useBackgroundJobs()

    const getStatusColor = (status: BackgroundJob['status']) => {
        switch (status) {
            case "COMPLETED": return "bg-success/10 text-success"
            case "FAILED": return "bg-destructive/10 text-destructive"
            case "PROCESSING": return "bg-primary/10 text-primary"
            case "PENDING": return "bg-warning/10 text-warning"
            default: return "bg-muted text-muted-foreground"
        }
    }

    if (isLoading) {
        return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
    }

    if (error) {
        return (
            <Alert variant="destructive">
                <AlertCircle className="w-4 h-4" />
                <AlertDescription>Error al cargar el historial de procesos asíncronos.</AlertDescription>
            </Alert>
        )
    }

    if (jobs.length === 0) {
        return (
            <Card className="border-dashed shadow-none bg-muted/20">
                <CardContent className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
                    <RefreshCw className="w-12 h-12 mb-4 opacity-20" />
                    <p className="font-semibold text-lg">No hay procesos recientes</p>
                    <p className="text-sm mt-2 max-w-md">
                        Las exportaciones, importaciones masivas o reportes pesados aparecerán aquí para que no tengas que esperar bloqueando la pantalla.
                    </p>
                </CardContent>
            </Card>
        )
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={() => refetch()}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Actualizar
                </Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {jobs.map((job) => (
                    <Card key={job.id} className="card-interactive card-accent-cmyk relative overflow-hidden">
                        {job.status === "PROCESSING" && (
                            <Progress 
                                value={job.progress_percent} 
                                className="h-1 absolute top-0 left-0 right-0 rounded-none bg-primary/10" 
                            />
                        )}
                        <CardHeader className="pb-3">
                            <div className="flex justify-between items-start mb-2">
                                <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                                    {job.job_type_display}
                                </Badge>
                                <Badge variant="secondary" className={`border-none ${getStatusColor(job.status)}`}>
                                    {job.status === "PROCESSING" && <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />}
                                    {job.status_display}
                                </Badge>
                            </div>
                            <CardTitle className="text-base leading-tight">{job.title}</CardTitle>
                            <CardDescription className="text-xs">
                                Iniciado: {format(new Date(job.created_at), "d MMM, HH:mm", { locale: es })}
                            </CardDescription>
                        </CardHeader>
                        
                        <CardContent>
                            {job.status === "FAILED" && job.error_message && (
                                <div className="mt-2 text-xs text-destructive bg-destructive/10 p-2 rounded-md border border-destructive/20 line-clamp-3">
                                    {job.error_message}
                                </div>
                            )}
                            
                            {job.status === "PROCESSING" && (
                                <div className="mt-2 flex justify-between items-center text-xs text-muted-foreground">
                                    <span>Procesando...</span>
                                    <span className="font-mono">{job.progress_percent}%</span>
                                </div>
                            )}

                            {job.status === "COMPLETED" && job.result_file_url && (
                                <Button 
                                    className="w-full mt-4" 
                                    variant="default"
                                    onClick={() => window.open(job.result_file_url!, '_blank')}
                                >
                                    <Download className="w-4 h-4 mr-2" />
                                    Descargar Archivo
                                </Button>
                            )}
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    )
}
