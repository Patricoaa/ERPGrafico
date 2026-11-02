'use client'

import { useEffect } from 'react'
import { useQueryClient, type QueryKey } from '@tanstack/react-query'
import { invalidateCrossFeature } from '@/lib/invalidation'
import { useAuth } from '@/contexts/AuthContext'
import { useRealtime } from './RealtimeProvider'
import type { EntitySubscriptionOptions, RealtimeEvent } from './types'

/**
 * Subscribes to entity-bus events for `topic` and invalidates `queryKeys`
 * when matching events arrive.
 *
 * topic forms:
 *   `<app>.<model>`          — list-level events
 *   `<app>.<model>.<id>`     — detail/modal events for a single instance
 *   `<app>.<model>.<id>.comments` — comment threads of one record (ADR-0111)
 *
 * The local `invalidateQueries` in mutation `onSuccess` remains the primary
 * source of freshness for the author. This hook covers remote changes and
 * cross-tab sync (the latter via the auto-joined `entity.user.<id>` group on
 * the server, so no extra subscription is needed for it).
 */
export function useEntitySubscription(
    topic: string | null | undefined,
    queryKeys: QueryKey[],
    opts: EntitySubscriptionOptions = {},
) {
    const { ignoreOwnActor = true, ownActorWindowMs = 2000, enabled = true } = opts
    const { subscribe, lastLocalMutationAt } = useRealtime()
    const { user } = useAuth()
    const queryClient = useQueryClient()

    useEffect(() => {
        if (!enabled || !topic) return

        const handler = (event: RealtimeEvent) => {
            if (
                ignoreOwnActor &&
                user &&
                event.actor_id === user.id &&
                Date.now() - lastLocalMutationAt() < ownActorWindowMs
            ) {
                return
            }
            for (const key of queryKeys) {
                invalidateCrossFeature(queryClient, [key])
            }
        }

        return subscribe(topic, handler)
        // queryKeys is intentionally not in deps — features should pass a stable reference
        // (declared at module level or wrapped in useMemo). React Query handles fan-out.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [topic, enabled, ignoreOwnActor, ownActorWindowMs, subscribe, queryClient, user, lastLocalMutationAt])
}
