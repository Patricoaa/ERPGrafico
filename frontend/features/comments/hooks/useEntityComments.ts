"use client"

import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { useEntitySubscription } from "@/features/realtime"
import { staleTime } from "@/lib/query-config"
import { getErrorMessage } from "@/lib/errors"
import { commentsApi } from "../api/commentsApi"
import type { CommentTarget } from "../types"
import { COMMENT_KEYS } from "./queryKeys"

export function useEntityComments(target: CommentTarget) {
    const queryKey = COMMENT_KEYS.target(target)
    const query = useQuery({
        queryKey,
        queryFn: ({ signal }) => commentsApi.list(target, signal),
        enabled: !!target.id,
        staleTime: staleTime.volatile,
    })

    // Hilos abiertos se refrescan cuando otro usuario comenta (entity bus, ADR-0111).
    const liveKeys = useMemo(() => [COMMENT_KEYS.target(target)], [target.label, target.id]) // eslint-disable-line react-hooks/exhaustive-deps -- target suele ser un literal inline
    useEntitySubscription(target.id ? `${target.label}.${target.id}.comments` : null, liveKeys)

    const threads = query.data ?? []
    const count = threads.reduce(
        (total, thread) => total + (thread.is_deleted ? 0 : 1) + thread.replies.length,
        0,
    )

    return {
        threads,
        count,
        loading: query.isLoading,
        error: query.error ? getErrorMessage(query.error) : null,
        refetch: query.refetch,
    }
}
