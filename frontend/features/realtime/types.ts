import type { QueryKey } from '@tanstack/react-query'

export type EntityOp = 'created' | 'updated' | 'deleted'

export interface EntityChangedEvent {
    event: 'entity.changed'
    app: string
    model: string
    id: number
    op: EntityOp
    actor_id: number | null
    ts: string
}

export interface SubscriptionAck {
    event: 'subscribed' | 'unsubscribed'
    topic: string
}

export interface BusError {
    event: 'error'
    code: string
    detail: string
}

export type BusMessage = EntityChangedEvent | SubscriptionAck | BusError

export interface EntitySubscriptionOptions {
    /**
     * Drop events where actor_id === current user id and the event arrived
     * within `ownActorWindowMs` of our latest local mutation (default 2000ms).
     * The local onSuccess invalidation already covers that case — this prevents
     * a redundant refetch.
     */
    ignoreOwnActor?: boolean
    ownActorWindowMs?: number
    /** Skip subscribing without disabling the surrounding component. */
    enabled?: boolean
}

export type QueryKeyList = readonly QueryKey[]
