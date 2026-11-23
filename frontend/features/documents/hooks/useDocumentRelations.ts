import { useQuery } from "@tanstack/react-query"
import { staleTime } from "@/lib/query-config"
import { documentsApi } from "../api/documentsApi"
import { type DocumentRelationsFilters } from "../types"
import { DOCUMENTS_KEYS } from "./queryKeys"

/**
 * Relaciones de un documento (ADR-0080). Sin `window` pide la ventana reciente (ADR-0155): así los
 * badges de las fichas comparten la petición de `DocumentRelationsTab`. Contar con `relationsTotal`.
 */
export function useDocumentRelations(label: string | null, id: number | null, filters?: DocumentRelationsFilters) {
    const effective: DocumentRelationsFilters = { ...filters, window: filters?.window ?? "recent" }
    return useQuery({
        queryKey: DOCUMENTS_KEYS.relations(label ?? "", id ?? 0, effective),
        queryFn: () => documentsApi.getRelations(label as string, id as number, effective),
        enabled: !!label && !!id,
        staleTime: staleTime.standard,
    })
}
