'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import type { BusMessage, EntityChangedEvent } from './types'

type Listener = (event: EntityChangedEvent) => void

interface RealtimeContextValue {
    /** Subscribe to a topic. Returns an unsubscribe fn. Refcounts internally — N components → 1 WS subscribe. */
    subscribe: (topic: string, listener: Listener) => () => void
    /** Records the timestamp of a local mutation so the ignoreOwnActor filter can drop the echoed event. */
    markLocalMutation: () => void
    /** Most recent local mutation timestamp (ms epoch). Read by useEntitySubscription. */
    lastLocalMutationAt: () => number
    /** Current connection state — useful for diagnostics, not required by features. */
    connected: boolean
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null)

const MAX_RETRIES = 10
const BASE_DELAY_MS = 1000
const MAX_DELAY_MS = 30_000
const RT_ENABLED = process.env.NEXT_PUBLIC_REALTIME_ENABLED !== 'false'

function getBusUrl(): string | null {
    const explicit = process.env.NEXT_PUBLIC_WS_URL
    if (explicit) return explicit.replace(/\/$/, '') + '/entity-bus/'

    const apiUrl = process.env.NEXT_PUBLIC_API_URL
    if (apiUrl) {
        const wsProtocol = apiUrl.startsWith('https') ? 'wss' : 'ws'
        const wsHost = apiUrl.replace(/^https?:\/\//, '').replace(/\/api\/?$/, '')
        return `${wsProtocol}://${wsHost}/ws/entity-bus/`
    }

    if (typeof window !== 'undefined') {
        const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
        return `${wsProtocol}://${window.location.host}/ws/entity-bus/`
    }
    return null
}

function backoff(attempt: number): number {
    return Math.min(BASE_DELAY_MS * Math.pow(2, attempt), MAX_DELAY_MS) + Math.random() * 500
}

export function RealtimeProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth()
    const [connected, setConnected] = useState(false)

    const socketRef = useRef<WebSocket | null>(null)
    const retryCountRef = useRef(0)
    const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const mountedRef = useRef(true)

    // topic → set of listeners (refcounted).
    const listenersRef = useRef<Map<string, Set<Listener>>>(new Map())
    const lastLocalMutationAtRef = useRef<number>(0)

    const sendIfOpen = useCallback((payload: object): boolean => {
        const ws = socketRef.current
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(payload))
            return true
        }
        return false
    }, [])

    const resubscribeAll = useCallback(() => {
        for (const topic of listenersRef.current.keys()) {
            sendIfOpen({ op: 'subscribe', topic })
        }
    }, [sendIfOpen])

    const handleMessage = useCallback((raw: MessageEvent) => {
        let msg: BusMessage
        try {
            msg = JSON.parse(raw.data) as BusMessage
        } catch {
            return
        }
        if (msg.event !== 'entity.changed') return

        const topicExact = `${msg.app}.${msg.model}.${msg.id}`
        const topicList = `${msg.app}.${msg.model}`
        for (const topic of [topicExact, topicList]) {
            const set = listenersRef.current.get(topic)
            if (!set) continue
            for (const listener of set) {
                try { listener(msg) } catch (err) { console.warn('[realtime] listener error', err) }
            }
        }
    }, [])

    useEffect(() => {
        mountedRef.current = true

        if (!RT_ENABLED || !user || typeof window === 'undefined') return

        const url = getBusUrl()
        if (!url) return

        const connect = () => {
            if (!mountedRef.current) return
            const token = localStorage.getItem('access_token')
            if (!token) return

            const ws = new WebSocket(`${url}?token=${encodeURIComponent(token)}`)
            socketRef.current = ws

            ws.onopen = () => {
                if (!mountedRef.current) { ws.close(); return }
                setConnected(true)
                retryCountRef.current = 0
                resubscribeAll()
            }

            ws.onmessage = handleMessage

            ws.onclose = (e) => {
                setConnected(false)
                if (!mountedRef.current) return
                if (e.code === 1000 || e.code === 4001) return
                if (retryCountRef.current < MAX_RETRIES) {
                    const delay = backoff(retryCountRef.current)
                    retryCountRef.current += 1
                    retryTimeoutRef.current = setTimeout(connect, delay)
                }
            }

            ws.onerror = () => { /* onclose will follow */ }
        }

        connect()

        return () => {
            mountedRef.current = false
            if (retryTimeoutRef.current) { clearTimeout(retryTimeoutRef.current); retryTimeoutRef.current = null }
            if (socketRef.current) {
                socketRef.current.close(1000, 'unmount')
                socketRef.current = null
            }
        }
    }, [user, handleMessage, resubscribeAll])

    const subscribe = useCallback((topic: string, listener: Listener): (() => void) => {
        let set = listenersRef.current.get(topic)
        if (!set) {
            set = new Set()
            listenersRef.current.set(topic, set)
            sendIfOpen({ op: 'subscribe', topic })
        }
        set.add(listener)

        return () => {
            const current = listenersRef.current.get(topic)
            if (!current) return
            current.delete(listener)
            if (current.size === 0) {
                listenersRef.current.delete(topic)
                sendIfOpen({ op: 'unsubscribe', topic })
            }
        }
    }, [sendIfOpen])

    const value = useMemo<RealtimeContextValue>(() => ({
        subscribe,
        markLocalMutation: () => { lastLocalMutationAtRef.current = Date.now() },
        lastLocalMutationAt: () => lastLocalMutationAtRef.current,
        connected,
    }), [subscribe, connected])

    return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>
}

export function useRealtime(): RealtimeContextValue {
    const ctx = useContext(RealtimeContext)
    if (!ctx) {
        // Returning a no-op keeps the hook safe during SSR / outside the provider
        // (e.g. unit tests that don't mount it). This is intentional — features
        // must remain functional without realtime.
        return {
            subscribe: () => () => {},
            markLocalMutation: () => {},
            lastLocalMutationAt: () => 0,
            connected: false,
        }
    }
    return ctx
}
