"use client"

import { defineEntity, registerValueKind, type ValueRenderProps } from "@/components/entity-view"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"

// ─── jobTimestamp: compact "d MMM, HH:mm" format ─────────────────────────────

declare module "@/components/entity-view/core/value-kinds" {
    interface ValueKinds {
        jobTimestamp: { value: string | null | undefined; options: Record<never, never> }
    }
}

function JobTimestampCell({ value }: ValueRenderProps<"jobTimestamp">) {
    if (!value) return null
    return (
        <span className="text-xs text-muted-foreground">
            {format(new Date(value), "d MMM, HH:mm", { locale: es })}
        </span>
    )
}

registerValueKind("jobTimestamp", {
    format: (v) => (v ? format(new Date(v), "d MMM, HH:mm", { locale: es }) : ""),
    render: JobTimestampCell,
})

// ─── jobProgress: conditional progress bar + percentage ──────────────────────

export interface JobProgressValue { percent: number; status: string }

declare module "@/components/entity-view/core/value-kinds" {
    interface ValueKinds {
        jobProgress: { value: JobProgressValue | null; options: Record<never, never> }
    }
}

function JobProgressCell({ value }: ValueRenderProps<"jobProgress">) {
    if (!value) return null
    const { percent, status } = value
    if (status === "PROCESSING") {
        return (
            <div className="w-[100px] flex items-center gap-2">
                <Progress value={percent} className="h-2 w-12" />
                <span className="text-xs font-mono">{percent}%</span>
            </div>
        )
    }
    return <span className="text-xs text-muted-foreground font-mono">{percent}%</span>
}

registerValueKind("jobProgress", {
    format: (v) => (v ? `${v.percent}%` : ""),
    render: JobProgressCell,
})

// ─── jobActions: download button or error message ────────────────────────────

export interface JobActionsValue { status: string; resultFileUrl: string | null; errorMessage: string }

declare module "@/components/entity-view/core/value-kinds" {
    interface ValueKinds {
        jobActions: { value: JobActionsValue | null; options: Record<never, never> }
    }
}

function JobActionsCell({ value }: ValueRenderProps<"jobActions">) {
    if (!value) return null
    if (value.status === "COMPLETED" && value.resultFileUrl) {
        return (
            <Button size="sm" variant="outline" className="h-8 py-1"
                onClick={() => window.open(value.resultFileUrl ?? "", "_blank")}>
                <Download className="w-3.5 h-3.5 mr-1" />
                Descargar
            </Button>
        )
    }
    if (value.status === "FAILED" && value.errorMessage) {
        return (
            <span className="text-2xs text-destructive max-w-[150px] line-clamp-1 truncate block" title={value.errorMessage}>
                {value.errorMessage}
            </span>
        )
    }
    return null
}

registerValueKind("jobActions", {
    format: (v) => (v?.status === "COMPLETED" ? "Descargar" : v?.status === "FAILED" ? v.errorMessage : ""),
    render: JobActionsCell,
})

// ─── JobCardBody: custom card section for conditional card content ────────────

export interface BackgroundJobRow {
    id: number
    job_type: string
    job_type_display: string
    status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "CANCELLED"
    status_display: string
    title: string
    progress_percent: number
    result_file_url: string | null
    error_message: string
    completed_at: string | null
    created_at: string
}

export function JobCardBody({ row }: { row: BackgroundJobRow }) {
    return (
        <>
            {row.status === "FAILED" && row.error_message && (
                <div className="mt-2 text-xs text-destructive bg-destructive/10 p-2 rounded-md border border-destructive/20 line-clamp-3">
                    {row.error_message}
                </div>
            )}
            {row.status === "PROCESSING" && (
                <div className="mt-2 flex justify-between items-center text-xs text-muted-foreground">
                    <span>Procesando...</span>
                    <span className="font-mono">{row.progress_percent}%</span>
                </div>
            )}
            {row.status === "COMPLETED" && row.result_file_url && (
                <Button className="w-full mt-4" variant="default"
                    onClick={() => window.open(row.result_file_url ?? "", "_blank")}>
                    <Download className="w-4 h-4 mr-2" />
                    Descargar Archivo
                </Button>
            )}
        </>
    )
}

// ─── Entity ──────────────────────────────────────────────────────────────────

const fixed = { sortable: false } as const

export const backgroundJobEntity = defineEntity<BackgroundJobRow>()((f) => ({
    label: "core.backgroundjob",
    fields: {
        jobType: f.tags((r) => [r.job_type_display], { ...fixed, label: "Tipo" }),
        title: f.text("title", { ...fixed, label: "Título" }),
        status: f.status((r) => ({ status: r.status, label: r.status_display }), { ...fixed, label: "Estado" }),
        progress: f.value("jobProgress", (r) => ({ percent: r.progress_percent, status: r.status }), { ...fixed, label: "Progreso" }),
        createdAt: f.value("jobTimestamp", (r) => r.created_at, { ...fixed, label: "Iniciado" }),
        actions: f.value("jobActions", (r) => ({ status: r.status, resultFileUrl: r.result_file_url, errorMessage: r.error_message }), { ...fixed, label: "" }),
    },
}))

export const backgroundJobViews = backgroundJobEntity.views({
    table: { columns: ["jobType", "title", "status", "progress", "createdAt", "actions"] },
    card: {
        title: "title",
        meta: ["jobType"],
        trailing: ["status"],
        subtitle: ["createdAt"],
        body: { kind: "custom", component: JobCardBody },
    },
})
