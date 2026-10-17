import { useQuery } from "@tanstack/react-query"
import { staleTime } from "@/lib/query-config"
import { documentsApi } from "../api/documentsApi"
import { DOCUMENTS_KEYS } from "./queryKeys"

export function useDocumentRef(label: string | null, id: number | null) {
    return useQuery({
        queryKey: DOCUMENTS_KEYS.ref(label ?? "", id ?? 0),
        queryFn: () => documentsApi.getRef(label as string, id as number),
        enabled: !!label && !!id,
        staleTime: staleTime.standard,
        retry: false,
    })
}
