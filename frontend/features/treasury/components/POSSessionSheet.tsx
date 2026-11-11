"use client"

import { useEffect, useState } from "react"
import { Activity, Banknote, ClipboardCheck, Download, FileText, Link2, Monitor, ShoppingCart } from "lucide-react"
import { toast } from "sonner"
import { useGlobalModals } from "@/components/providers/GlobalModalProvider"
import {
    DocumentActionsMenu,
    DocumentDrawerShell,
    StatusBadge,
    type DocumentActionItem,
    type DocumentSheetTab,
} from "@/components/shared"
import { useDrawerIdentity } from "@/features/_shared"
import { DocumentRelationsTab, useDocumentRelations, type DocumentDomain } from "@/features/documents"
import { useDownloadPOSReportPDF, usePOSSessionRealtime } from "@/features/pos"
import { usePOSSession } from "../hooks/usePOSSession"
import { usePOSSessionOverview } from "../hooks/usePOSSessionDetail"
import { ActivityTab } from "./pos-session/ActivityTab"
import { CashTab } from "./pos-session/CashTab"
import { ClosingTab } from "./pos-session/ClosingTab"
import { SalesTab } from "./pos-session/SalesTab"
import type { SessionTab } from "./pos-session/shared"
import { SummaryTab } from "./pos-session/SummaryTab"

const LABEL = "treasury.possession"

export interface POSSessionSheetProps {
    id: number | null
    open: boolean
    onOpenChange: (open: boolean) => void
    embedded?: boolean
}

/**
 * Ficha de la sesión POS (única superficie de la sesión: lista de sesiones, relaciones de la
 * Caja POS y `openEntity`). El Resumen permite entender la sesión de un vistazo; las demás
 * pestañas explican el detalle: Ventas (actividad comercial), Tesorería (efectivo), Cierre
 * (contraste de resultados) y Actividad (trazabilidad). Relaciones enlaza la caja y las ventas.
 */
export function POSSessionSheet({ id, open, onOpenChange, embedded = false }: POSSessionSheetProps) {
    const { session, isLoading, isError } = usePOSSession(id ?? null)
    const overviewQuery = usePOSSessionOverview(id ?? null)
    usePOSSessionRealtime(open ? (id ?? null) : null)
    const { data: relations } = useDocumentRelations(LABEL, id ?? null)
    const { downloadPdf } = useDownloadPOSReportPDF()
    const [tab, setTab] = useState<SessionTab>("summary")
    const [domain, setDomain] = useState<DocumentDomain | null>(null)

    const displayId = session ? `SES-${session.id}` : `#${id}`
    const identity = useDrawerIdentity(LABEL, "view", session, { overrideTitle: displayId })

    const { setEntityDisplay } = useGlobalModals()
    useEffect(() => {
        if (session?.id && displayId) setEntityDisplay(LABEL, session.id, String(displayId))
    }, [session?.id, displayId, setEntityDisplay])

    const overview = overviewQuery.data
    const isClosed = session?.status === "CLOSED"
    const reportKind = isClosed ? "Z" : "X"

    const handleDownload = async () => {
        if (!session) return
        try {
            await downloadPdf(session.id, reportKind)
            toast.success("PDF descargado correctamente")
        } catch {
            toast.error("Error al descargar el PDF")
        }
    }

    const actions: DocumentActionItem[] = session ? [{
        id: "download-report",
        label: `Descargar informe ${reportKind} (PDF)`,
        icon: Download,
        onClick: handleDownload,
    }] : []

    const tabs: DocumentSheetTab[] = session ? [
        {
            value: "summary", label: "Resumen", icon: FileText,
            content: <SummaryTab session={session} overview={overview} isLoading={overviewQuery.isLoading} onGoTab={(t) => setTab(t)} />,
        },
        {
            value: "sales", label: "Ventas", icon: ShoppingCart, badge: overview?.sales.rows.length,
            content: <SalesTab overview={overview} isLoading={overviewQuery.isLoading} />,
        },
        { value: "cash", label: "Tesorería", icon: Banknote, content: <CashTab session={session} overview={overview} /> },
        {
            value: "closing", label: "Cierre", icon: ClipboardCheck, hidden: !isClosed,
            content: <ClosingTab session={session} overview={overview} isLoading={overviewQuery.isLoading} />,
        },
        {
            value: "activity", label: "Actividad", icon: Activity,
            content: <ActivityTab sessionId={session.id} />,
        },
        {
            value: "relations", label: "Relaciones", icon: Link2, badge: relations?.relations.length,
            content: (
                <DocumentRelationsTab
                    label={LABEL}
                    id={session.id}
                    sectionActions={{}}
                    rowActions={() => []}
                    domain={domain}
                    onDomainChange={setDomain}
                />
            ),
        },
    ] : []

    return (
        <DocumentDrawerShell
            open={open}
            onOpenChange={onOpenChange}
            embedded={embedded}
            title={identity.title}
            subtitle={identity.subtitle}
            icon={identity.icon ?? Monitor}
            headerActions={session ? (
                <>
                    <StatusBadge status={session.status} variant="badge" />
                    <DocumentActionsMenu actions={actions} />
                </>
            ) : undefined}
            isLoading={isLoading || (!session && !isError)}
            error={isError ? new Error("No se pudo cargar la sesión POS") : undefined}
            loadingLabel="Cargando sesión POS"
            tabs={tabs}
            tab={tab}
            onTabChange={(value) => setTab(value as SessionTab)}
        />
    )
}
