"use client"

import { useCallback } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { DOCUMENTS_KEYS } from "./queryKeys"

/** Refresca refs y relaciones documentales tras una acción que crea/anula documentos (ADR-0083). */
export function useInvalidateDocuments() {
    const queryClient = useQueryClient()
    return useCallback(() => queryClient.invalidateQueries({ queryKey: DOCUMENTS_KEYS.all }), [queryClient])
}
