"use client"

import { useRouter } from "next/navigation"
import { RelatedDocumentsTable, type RelatedDocumentItem } from "@/components/shared"
import { useGlobalModals } from "@/components/providers/GlobalModalProvider"
import { hasEntityDrawer } from "@/lib/entity-drawers"
import { useDocumentRelations } from "../hooks/useDocumentRelations"
import { type DocumentRelations } from "../types"

interface DocumentRelationsSectionProps {
    label: string
    id: number | null | undefined
    className?: string
}

/**
 * Documentos relacionados de cualquier documento (ADR-0080, GAP-10).
 * Abre cada relacionado con `openEntity` (apila y permite volver); OV/OC abren el Order Hub (D4);
 * sin ficha registrada → navega a su URL canónica.
 */
export function DocumentRelationsSection({ label, id, className }: DocumentRelationsSectionProps) {
    const router = useRouter()
    const { openEntity } = useGlobalModals()
    const { data, isLoading, error } = useDocumentRelations(label, id ?? null)
    const urlByKey = urlIndex(data)

    const handleOpen = (item: RelatedDocumentItem) => {
        const { label: targetLabel, id: targetId, display_id } = item.target
        if (hasEntityDrawer(targetLabel)) {
            openEntity(targetLabel, targetId, undefined, undefined, { display: display_id })
            return
        }
        const url = urlByKey.get(`${targetLabel}:${targetId}`)
        if (url) router.push(url)
    }

    return (
        <RelatedDocumentsTable
            items={data?.relations}
            unresolvedCount={data?.unresolved.length ?? 0}
            isLoading={isLoading}
            error={error}
            onOpen={handleOpen}
            className={className}
        />
    )
}

function urlIndex(data: DocumentRelations | undefined): Map<string, string> {
    const index = new Map<string, string>()
    for (const relation of data?.relations ?? []) {
        if (relation.target.url) index.set(`${relation.target.label}:${relation.target.id}`, relation.target.url)
    }
    return index
}
