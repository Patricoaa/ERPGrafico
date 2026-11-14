"use client"

import { useState, type ReactNode } from "react"
import { FileText } from "lucide-react"
import { Banner, Drawer, DrawerLayout, EmptyState, Section, SkeletonShell, StatusBadge } from "@/components/shared"
import { Collection, formatDate, useEntityCollection } from "@/components/entity-view"
import { useDrawerIdentity, useDrawerMode, type DrawerMode } from "@/features/_shared"
import { formDrawerWidth } from "@/lib/form-widths"
import { useRcvImport } from "../../hooks/useRcvImports"
import {
    RCV_DIRECTION_LABELS,
    RCV_TRIGGER_LABELS,
    formatRcvDuration,
    formatRcvPeriod,
    rcvImportAttemptEntity,
    rcvImportAttemptViews,
    rcvImportStatus,
    rcvImportSummaryEntity,
    rcvImportSummaryViews,
} from "../../entity-view/rcvImport.entity"
import type { RcvImportAttempt, RcvImportDetail, RcvImportSummary } from "../../types"

export interface RcvImportDrawerProps {
    id: number | null
    open: boolean
    onOpenChange: (open: boolean) => void
    /** Solo lectura: el historial no se edita, el modo efectivo siempre es `view`. */
    mode?: DrawerMode
}

/**
 * Ficha de solo lectura de una importación del RCV (`accounting.rcvimport`), cargada por id.
 * Se refresca sola mientras la importación está en cola o corriendo (el hook hace el polling).
 */
export function RcvImportDrawer({ id, open, onOpenChange, mode: modeProp }: RcvImportDrawerProps) {
    const { mode } = useDrawerMode({ mode: modeProp, initialData: id ? { id } : undefined, defaultMode: "view" })
    const { rcvImport, isLoading, isError } = useRcvImport(id)
    const identity = useDrawerIdentity("accounting.rcvimport", mode, rcvImport, {
        overrideTitle: rcvImport ? `Importación ${formatRcvPeriod(rcvImport.year, rcvImport.month)}` : "Importación RCV",
        overrideSubtitle: rcvImport ? RCV_DIRECTION_LABELS[rcvImport.direction] : undefined,
    })

    const detail = isError ? (
        <EmptyState context="generic" title="No se pudo cargar la importación" description="Revisa tu conexión e intenta nuevamente." variant="compact" />
    ) : (
        <SkeletonShell isLoading={isLoading || !rcvImport} ariaLabel="Cargando importación RCV">
            {rcvImport && <RcvImportDetailBody rcvImport={rcvImport} />}
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

function RcvImportDetailBody({ rcvImport }: { rcvImport: RcvImportDetail }) {
    const [rawOpen, setRawOpen] = useState(false)
    const status = rcvImportStatus(rcvImport)

    return (
        <div className="space-y-6">
            <Section title="Importación">
                <Stat title="Estado" value={<StatusBadge status={status.status} label={status.label} intent={status.intent} size="sm" />} />
                <Stat title="Período" value={formatRcvPeriod(rcvImport.year, rcvImport.month)} plain />
                <Stat title="Dirección" value={RCV_DIRECTION_LABELS[rcvImport.direction]} plain />
                <Stat title="Origen" value={RCV_TRIGGER_LABELS[rcvImport.trigger]} plain />
                <Stat title="Usuario" value={rcvImport.triggered_by_name} plain />
                <Stat title="Inicio" value={rcvImport.started_at ? formatDate(rcvImport.started_at, true) : null} plain />
                <Stat title="Fin" value={rcvImport.finished_at ? formatDate(rcvImport.finished_at, true) : null} plain />
                <Stat title="Duración" value={formatRcvDuration(rcvImport.started_at, rcvImport.finished_at)} />
                <Stat title="API key" value={rcvImport.masked_key} />
            </Section>

            {rcvImport.error_message && (
                <Banner tone="destructive" live="alert" title="La importación falló">
                    {rcvImport.error_message}
                </Banner>
            )}
            {rcvImport.warnings.length > 0 && (
                <Banner tone="warning" title={rcvImport.warnings.length === 1 ? "Aviso" : `${rcvImport.warnings.length} avisos`}>
                    <ul className="list-disc space-y-1 pl-4">
                        {rcvImport.warnings.map((warning, i) => (
                            <li key={`${i}-${warning}`}>{warning}</li>
                        ))}
                    </ul>
                </Banner>
            )}

            <RcvImportSummaries summaries={rcvImport.summaries} />

            <Section title="Conteos">
                <Stat title="Recibidos" value={rcvImport.received_count} />
                <Stat title="Nuevos" value={rcvImport.created_count} />
                <Stat title="Actualizados" value={rcvImport.updated_count} />
                <Stat title="Faltantes" value={rcvImport.missing_count} />
            </Section>

            <RcvImportAttempts attempts={rcvImport.attempts} />

            <Section title="Respuesta original">
                <Section.Row
                    title="Copia cruda de la respuesta del SII"
                    expand={{
                        label: rawOpen ? "Ocultar" : "Mostrar",
                        expanded: rawOpen,
                        onToggle: () => setRawOpen((v) => !v),
                        content: (
                            <pre className="max-h-96 overflow-auto rounded-md border bg-muted/40 p-3 font-mono text-2xs text-muted-foreground whitespace-pre">
                                {JSON.stringify(rcvImport.raw_response, null, 2)}
                            </pre>
                        ),
                    }}
                />
            </Section>
        </div>
    )
}

/** Key–value row; empty values show a dash so every field stays visible. */
function Stat({ title, value, plain }: { title: string; value: ReactNode; plain?: boolean }) {
    const empty = value === null || value === undefined || value === ""
    return <Section.Row variant="stat" title={title} value={empty ? "—" : value} plain={plain} />
}

function RcvImportSummaries({ summaries }: { summaries: RcvImportSummary[] }) {
    const collection = useEntityCollection(rcvImportSummaryEntity, { rows: summaries }, { pagination: { mode: "none" } })
    return (
        <Section.Scope>
            <Section.Header title="Resumen del SII" />
            <Collection.Root collection={collection} label="Resumen del SII">
                <Collection.View table={rcvImportSummaryViews.table} emptyTitle="Sin resumen" emptyDescription="El SII no informó un resumen para esta importación." />
            </Collection.Root>
        </Section.Scope>
    )
}

function RcvImportAttempts({ attempts }: { attempts: RcvImportAttempt[] }) {
    const collection = useEntityCollection(rcvImportAttemptEntity, { rows: attempts }, { pagination: { mode: "none" } })
    return (
        <Section.Scope>
            <Section.Header title="Intentos" />
            <Collection.Root collection={collection} label="Intentos de la importación">
                <Collection.View table={rcvImportAttemptViews.table} emptyTitle="Sin intentos" emptyDescription="Aún no se hizo ninguna consulta al SII." />
            </Collection.Root>
        </Section.Scope>
    )
}

export default RcvImportDrawer
