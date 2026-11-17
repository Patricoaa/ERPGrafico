"use client"

import type { ReactNode } from "react"
import { FileText } from "lucide-react"
import { Banner, Drawer, DrawerLayout, EmptyState, Section, SkeletonShell, StatusBadge } from "@/components/shared"
import { formatDate } from "@/components/entity-view"
import { useDrawerIdentity, useDrawerMode, type DrawerMode } from "@/features/_shared"
import { formDrawerWidth } from "@/lib/form-widths"
import { useTerminalSyncRun } from "../hooks/useTerminalSync"
import {
    TERMINAL_SYNC_TRIGGER_LABELS,
    formatTerminalSyncDuration,
    terminalSyncRunStatus,
} from "../entity-view/terminalSyncRun.entity"
import type { TerminalSyncRun } from "../types"

export interface TerminalSyncRunDrawerProps {
    id: number | null
    open: boolean
    onOpenChange: (open: boolean) => void
    /** Solo lectura: el historial no se edita, el modo efectivo siempre es `view`. */
    mode?: DrawerMode
}

/**
 * Ficha de solo lectura de una importación de ventas TUU (`treasury.terminalsyncrun`), cargada por id.
 * Se refresca sola mientras la ejecución está en curso (el hook hace el polling).
 */
export function TerminalSyncRunDrawer({ id, open, onOpenChange, mode: modeProp }: TerminalSyncRunDrawerProps) {
    const { mode } = useDrawerMode({ mode: modeProp, initialData: id ? { id } : undefined, defaultMode: "view" })
    const { run, isLoading, isError } = useTerminalSyncRun(id)
    const identity = useDrawerIdentity("treasury.terminalsyncrun", mode, run, {
        overrideTitle: run ? `Importación ${formatDate(run.start_date)} – ${formatDate(run.end_date)}` : "Importación de ventas",
        overrideSubtitle: run?.provider_name,
    })

    const detail = isError ? (
        <EmptyState context="generic" title="No se pudo cargar la importación" description="Revisa tu conexión e intenta nuevamente." variant="compact" />
    ) : (
        <SkeletonShell isLoading={isLoading || !run} ariaLabel="Cargando importación de ventas">
            {run && <TerminalSyncRunDetailBody run={run} />}
        </SkeletonShell>
    )

    return (
        <Drawer
            fillContent
            contentClassName="p-0"
            open={open}
            onOpenChange={onOpenChange}
            side="left"
            defaultSize={formDrawerWidth("complex", false)}
            mode="view"
            icon={identity.icon}
            title={identity.title}
            subtitle={identity.subtitle}
        >
            <DrawerLayout
                className="min-w-0 h-full overflow-hidden"
                tabs={[{ value: "detail", label: "Detalle", icon: FileText, content: detail }]}
            />
        </Drawer>
    )
}

function TerminalSyncRunDetailBody({ run }: { run: TerminalSyncRun }) {
    const status = terminalSyncRunStatus(run.status)

    return (
        <div className="space-y-6">
            <Section title="Importación">
                <Stat title="Estado" value={<StatusBadge status={status.status} label={status.label} intent={status.intent} size="sm" />} />
                <Stat title="Proveedor" value={run.provider_name} plain />
                <Stat title="Rango" value={`${formatDate(run.start_date)} – ${formatDate(run.end_date)}`} plain />
                <Stat title="Origen" value={TERMINAL_SYNC_TRIGGER_LABELS[run.trigger]} plain />
                <Stat title="Usuario" value={run.triggered_by_name} plain />
                <Stat title="Inicio" value={formatDate(run.started_at, true)} plain />
                <Stat title="Fin" value={run.finished_at ? formatDate(run.finished_at, true) : null} plain />
                <Stat title="Duración" value={formatTerminalSyncDuration(run.started_at, run.finished_at)} />
                <Stat title="Intentos" value={run.attempts} />
            </Section>

            {run.error_message && (
                <Banner tone="destructive" live="alert" title="La importación falló">
                    {run.error_message}
                </Banner>
            )}
            {run.warnings.length > 0 && (
                <Banner tone="warning" title={run.warnings.length === 1 ? "Aviso" : `${run.warnings.length} avisos`}>
                    <ul className="list-disc space-y-1 pl-4">
                        {run.warnings.map((warning, i) => (
                            <li key={`${i}-${warning}`}>{warning}</li>
                        ))}
                    </ul>
                </Banner>
            )}

            <Section title="Conteos">
                <Stat title="Traídas" value={run.fetched_count} />
                <Stat title="Nuevas" value={run.created_count} />
                <Stat title="Actualizadas" value={run.updated_count} />
            </Section>
        </div>
    )
}

/** Key–value row; empty values show a dash so every field stays visible. */
function Stat({ title, value, plain }: { title: string; value: ReactNode; plain?: boolean }) {
    const empty = value === null || value === undefined || value === ""
    return <Section.Row variant="stat" title={title} value={empty ? "—" : value} plain={plain} />
}

export default TerminalSyncRunDrawer
