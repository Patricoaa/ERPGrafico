import { useQuery } from "@tanstack/react-query"
import { staleTime } from "@/lib/query-config"
import { documentsApi } from "../api/documentsApi"
import { type DocumentRelationsFilters } from "../types"
import { DOCUMENTS_KEYS } from "./queryKeys"

/** Relaciones de un documento (ADR-0080). Lo consumirá RelatedDocumentsTable en M3. */
export function useDocumentRelations(label: string | null, id: number | null, filters?: DocumentRelationsFilters) {
    return useQuery({
        queryKey: DOCUMENTS_KEYS.relations(label ?? "", id ?? 0, filters),
        queryFn: () => documentsApi.getRelations(label as string, id as number, filters),
        enabled: !!label && !!id,
        staleTime: staleTime.standard,
    })
}
