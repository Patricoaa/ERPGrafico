"use client"

import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { useDebounce } from "@/hooks/useDebounce"
import { staleTime } from "@/lib/query-config"
import { commentsApi } from "../api/commentsApi"
import type { CommentTarget } from "../types"
import { COMMENT_KEYS } from "./queryKeys"

const EMPTY = { users: [], teams: [] }

export function useMentionables(query: string | null, target: CommentTarget | null) {
    const debounced = useDebounce(query ?? "", 200)
    const enabled = query !== null

    const result = useQuery({
        queryKey: COMMENT_KEYS.mentionables(debounced, target),
        queryFn: ({ signal }) => commentsApi.mentionables(debounced, target, signal),
        enabled,
        staleTime: staleTime.stable,
        placeholderData: keepPreviousData,
    })

    return {
        mentionables: (enabled && result.data) || EMPTY,
        loading: enabled && result.isFetching,
    }
}
