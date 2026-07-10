"use client"

import { useMemo } from "react"
import { type ColumnDef } from "@tanstack/react-table"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { Download, AlertCircle, RefreshCw } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { 
    DataTableView, 
    DataTableColumnHeader, 
    DataCell, 
    UnifiedSearchBar,
    useUnifiedSearch,
    StatusBadge 
} from "@/components/shared"
import { useBackgroundJobs, type BackgroundJob, jobUnifiedSearchDef } from "@/features/settings"

export default function JobsView() {
    const { jobs, isLoading, isError, refetch } = useBackgroundJobs()

    const search = useUnifiedSearch(jobUnifiedSearchDef)

    // Filter jobs client-side based on both search input and status tabs
    const filteredJobs = useMemo(() => {
        let result = search.filterFn(jobs)
        if (search.filters.status) {
            result = result.filter(j => j.status === search.filters.status)
        }
        if (search.filters.job_type) {
            result = result.filter(j => j.job_type === search.filters.job_type)
        }
        return result
    }, [jobs, search])

    // Table Columns definition for List view
    const columns = useMemo((): ColumnDef<BackgroundJob>[] => [
        {
            accessorKey: "job_type_display",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Tipo" />
            ),
            cell: ({ row }) => (
                <DataCell.Text className="font-semibold uppercase text-xs">
                    {row.getValue("job_type_display")}
                </DataCell.Text>
            ),
        },
        {
            accessorKey: "title",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Título" />
            ),
            cell: ({ row }) => (
                <DataCell.Text className="font-bold">
                    {row.getValue("title")}
                </DataCell.Text>
            ),
        },
        {
            accessorKey: "status",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Estado" />
            ),
            cell: ({ row }) => (
                <StatusBadge 
                    status={row.original.status} 
                    label={row.original.status_display} 
                    size="xs" 
                />
            ),
        },
        {
            accessorKey: "progress_percent",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Progreso" />
            ),
            cell: ({ row }) => {
                const percent = row.getValue("progress_percent") as number
                const status = row.original.status
                if (status === "PROCESSING") {
                    return (
                        <div className="w-[100px] flex items-center gap-2">
                            <Progress value={percent} className="h-2 w-12" />
                            <span className="text-xs font-mono">{percent}%</span>
                        </div>
                    )
                }
                return <span className="text-xs text-muted-foreground font-mono">{percent}%</span>
            },
        },
        {
            accessorKey: "created_at",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Iniciado" />
            ),
            cell: ({ row }) => {
                const dateStr = row.getValue("created_at") as string
                return (
                    <span className="text-xs text-muted-foreground">
                        {format(new Date(dateStr), "d MMM, HH:mm", { locale: es })}
                    </span>
                )
            },
        },
        {
            id: "actions",
            header: "",
            cell: ({ row }) => {
                const job = row.original
                if (job.status === "COMPLETED" && job.result_file_url) {
                    return (
                        <Button 
                            size="sm" 
                            variant="outline" 
                            className="h-8 py-1"
                            onClick={() => window.open(job.result_file_url ?? '', '_blank')}
                        >
                            <Download className="w-3.5 h-3.5 mr-1" />
                            Descargar
                        </Button>
                    )
                }
                if (job.status === "FAILED" && job.error_message) {
                    return (
                        <span className="text-[11px] text-destructive max-w-[150px] line-clamp-1 truncate block" title={job.error_message}>
                            {job.error_message}
                        </span>
                    )
                }
                return null
            },
        },
    ], [])

    const toolbarActions = useMemo(() => [
        {
            key: "refresh",
            label: "Actualizar",
            icon: RefreshCw,
            onClick: () => refetch(),
        }
    ], [refetch])

    if (isError) {
        return (
            <Alert variant="destructive">
                <AlertCircle className="w-4 h-4" />
                <AlertDescription>Error al cargar el historial de procesos asíncronos.</AlertDescription>
            </Alert>
        )
    }

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <DataTableView
                columns={columns}
                data={filteredJobs}
                isLoading={isLoading}
                entityLabel="core.backgroundjob"
                variant="embedded"
                defaultPageSize={20}
                unifiedSearch={<UnifiedSearchBar
                    config={jobUnifiedSearchDef}
                    chips={search.chips}
                    isFiltered={search.isFiltered}
                    inputValue={search.inputValue}
                    onInputChange={search.setInputValue}
                    onApply={search.applyFilter}
                    onRemove={search.removeFilter}
                    onClearAll={search.clearAll}
                    groupBy={search.groupBy}
                    onGroupBySelect={search.setGroupBy}
                    paramValues={search.paramValues}
                    placeholder="Buscar por título, tipo o error..."
                />}
                showReset={search.isFiltered}
                onReset={search.clearAll}
                isFiltered={search.isFiltered}
                toolbarActions={toolbarActions}
                emptyState={{
                    context: "generic",
                    title: "No se encontraron procesos",
                    description: "No hay registros que coincidan con los criterios de búsqueda o filtros seleccionados.",
                    action: (
                        <Button variant="outline" size="sm" onClick={() => refetch()}>
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Actualizar
                        </Button>
                    ),
                }}
                renderCard={(job: BackgroundJob) => (
                    <Card key={job.id} className="card-base relative overflow-hidden h-full flex flex-col justify-between">
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
                                <StatusBadge status={job.status} label={job.status_display} size="xs" />
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
                                    onClick={() => window.open(job.result_file_url ?? '', '_blank')}
                                >
                                    <Download className="w-4 h-4 mr-2" />
                                    Descargar Archivo
                                </Button>
                            )}
                        </CardContent>
                    </Card>
                )}
            />
        </div>
    )
}
