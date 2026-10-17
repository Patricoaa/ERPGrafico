import api from "@/lib/api"
import {
    documentRefSchema,
    documentRelationsSchema,
    type DocumentRef,
    type DocumentRelations,
    type DocumentRelationsFilters,
} from "../types"

/** Endpoints del modelo documental común (ADR-0080). */
export const documentsApi = {
    getRef: async (label: string, id: number): Promise<DocumentRef> => {
        const { data } = await api.get<unknown>(`/core/documents/${label}/${id}/`)
        return documentRefSchema.parse(data)
    },

    getRelations: async (label: string, id: number, filters?: DocumentRelationsFilters): Promise<DocumentRelations> => {
        const { data } = await api.get<unknown>(`/core/documents/${label}/${id}/relations/`, { params: filters })
        return documentRelationsSchema.parse(data)
    },
}
