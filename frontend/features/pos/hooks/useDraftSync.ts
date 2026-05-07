import { useState, useEffect, useCallback, useRef } from 'react'
import api from '@/lib/api'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'

// ── Types ────────────────────────────────────────────────────────

export interface SyncDraft {
    id: number
    name: string
    customer_name: string | null
    item_count: number
    total_gross: number
    is_locked: boolean
    locked_by_name: string | null
    locked_by_id: number | null
    lock_session_key: string
    locked_at: string | null
    created_by_full_name: string | null
    last_modified_by_full_name: string | null
    wizard_state: Record<string, unknown> | null
    updated_at: string
    created_at: string
}

interface SyncResponse {
    drafts: SyncDraft[]
    session_status: 'OPEN' | 'CLOSED'
    closed_by_name: string | null
    server_time: string
}

interface UseDraftSyncOptions {
    posSessionId: number | null
    enabled?: boolean
    pollInterval?: number       // ms, default 30000 (relaxed as we have WS)
    heartbeatInterval?: number  // ms, default 5000
    onNewDraft?: (draft: SyncDraft) => void
    onDraftDeleted?: (draftId: number) => void
    onDraftUpdated?: (draft: SyncDraft) => void
    onLockChanged?: (draft: SyncDraft) => void
    onSessionStateChange?: (status: 'OPEN' | 'CLOSED', closedByName: string | null) => void
}

function getBrowserSessionKey(): string {
    if (typeof window === 'undefined') return ''
    const KEY = 'pos_browser_session_key'
    let key = sessionStorage.getItem(KEY)
    if (!key) {
        key = crypto.randomUUID()
        sessionStorage.setItem(KEY, key)
    }
    return key
}

// ── Hook ─────────────────────────────────────────────────────────

export function useDraftSync({
    posSessionId,
    enabled = true,
    pollInterval = 30000, // Fallback relaxed
    heartbeatInterval = 5000,
    onNewDraft,
    onDraftDeleted,
    onDraftUpdated,
    onLockChanged,
    onSessionStateChange,
}: UseDraftSyncOptions) {
    const { user } = useAuth()
    const [syncDrafts, setSyncDrafts] = useState<SyncDraft[]>([])
    const [isSocketConnected, setIsSocketConnected] = useState(false)
    const [activeLockDraftId, setActiveLockDraftId] = useState<number | null>(null)
    
    const [browserSessionKey] = useState(() => getBrowserSessionKey())
    const prevDraftsRef = useRef<SyncDraft[]>([])
    const socketRef = useRef<WebSocket | null>(null)
    const callbacksRef = useRef({ onNewDraft, onDraftDeleted, onDraftUpdated, onLockChanged, onSessionStateChange })
    
    useEffect(() => {
        callbacksRef.current = { onNewDraft, onDraftDeleted, onDraftUpdated, onLockChanged, onSessionStateChange }
    }, [onNewDraft, onDraftDeleted, onDraftUpdated, onLockChanged, onSessionStateChange])

    // ── WebSocket Logic ──────────────────────────────────────────

    useEffect(() => {
        if (!enabled || !posSessionId) return

        const baseUrl = process.env.NEXT_PUBLIC_API_URL || ''
        const wsProtocol = baseUrl.startsWith('https') ? 'wss' : 'ws'
        const wsHost = baseUrl.replace(/^https?:\/\//, '').replace(/\/api\/?$/, '')
        const wsUrl = `${wsProtocol}://${wsHost}/ws/sales/pos/${posSessionId}/`

        console.log('[DraftSync] Connecting to WebSocket:', wsUrl)
        
        const connect = () => {
            const socket = new WebSocket(wsUrl)
            socketRef.current = socket

            socket.onopen = () => {
                console.log('[DraftSync] WebSocket Connected')
                setIsSocketConnected(true)
                // Fetch initial state once connected
                initialFetch()
            }

            socket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data)
                    handleSocketEvent(data)
                } catch (e) {
                    console.error('[DraftSync] Error parsing WS message', e)
                }
            }

            socket.onclose = () => {
                console.log('[DraftSync] WebSocket Disconnected')
                setIsSocketConnected(false)
                // Attempt to reconnect after 3 seconds
                setTimeout(() => {
                    if (enabled && posSessionId) connect()
                }, 3000)
            }

            socket.onerror = (err) => {
                console.error('[DraftSync] WebSocket Error', err)
                socket.close()
            }
        }

        connect()

        return () => {
            if (socketRef.current) {
                socketRef.current.close()
            }
        }
    }, [enabled, posSessionId])

    const handleSocketEvent = useCallback((data: any) => {
        const { event, draft, draft_id } = data
        const currentUserId = user?.id

        setSyncDrafts(prev => {
            let next = [...prev]

            if (event === 'CREATED') {
                if (!next.find(d => d.id === draft.id)) {
                    next.push(draft)
                    if (draft.locked_by_id !== currentUserId) {
                        callbacksRef.current.onNewDraft?.(draft)
                    }
                }
            } else if (event === 'UPDATED') {
                const index = next.findIndex(d => d.id === draft.id)
                if (index !== -1) {
                    const old = next[index]
                    next[index] = draft

                    // Detect lock changes
                    if (old.is_locked !== draft.is_locked || old.locked_by_id !== draft.locked_by_id) {
                        callbacksRef.current.onLockChanged?.(draft)
                    }

                    // Detect content updates
                    if (old.updated_at !== draft.updated_at && draft.locked_by_id !== currentUserId) {
                        callbacksRef.current.onDraftUpdated?.(draft)
                    }
                } else {
                    // It's an update for something we didn't have? Add it.
                    next.push(draft)
                }
            } else if (event === 'DELETED') {
                next = next.filter(d => d.id !== draft_id)
                callbacksRef.current.onDraftDeleted?.(draft_id)
            }

            // Sort by updated_at desc
            return next.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
        })
    }, [user?.id])

    // ── Initial Fetch & Fallback ────────────────────────────────

    const initialFetch = useCallback(async () => {
        if (!posSessionId) return
        try {
            const res = await api.get(`/sales/pos-drafts/sync/?pos_session_id=${posSessionId}`)
            const data: SyncResponse = res.data
            setSyncDrafts(data.drafts)
            prevDraftsRef.current = data.drafts
            
            if (data.session_status === 'CLOSED') {
                callbacksRef.current.onSessionStateChange?.('CLOSED', data.closed_by_name)
            }
        } catch (error) {
            console.debug('[DraftSync] Initial fetch failed:', error)
        }
    }, [posSessionId])

    // Use a slow polling fallback ONLY if socket is disconnected for a long time
    useEffect(() => {
        if (!enabled || !posSessionId || isSocketConnected) return
        
        const interval = setInterval(initialFetch, pollInterval)
        return () => clearInterval(interval)
    }, [enabled, posSessionId, isSocketConnected, pollInterval, initialFetch])

    // ── Heartbeat (Legacy HTTP for now) ─────────────────────────

    useEffect(() => {
        if (!activeLockDraftId || !posSessionId) return

        const sendHeartbeat = async () => {
            try {
                await api.post(`/sales/pos-drafts/${activeLockDraftId}/heartbeat/`, {
                    pos_session_id: posSessionId,
                    session_key: browserSessionKey,
                })
            } catch (error) {
                const err = error as { response?: { status?: number } }
                if (err.response?.status === 409) {
                    setActiveLockDraftId(null)
                    toast.warning('El bloqueo del borrador se ha perdido.')
                }
            }
        }

        const interval = setInterval(sendHeartbeat, heartbeatInterval)
        return () => clearInterval(interval)
    }, [activeLockDraftId, posSessionId, heartbeatInterval, browserSessionKey])

    // ── Page Unload ─────────────────────────────────────────────

    useEffect(() => {
        const handleBeforeUnload = () => {
            if (activeLockDraftId && posSessionId) {
                const url = `${process.env.NEXT_PUBLIC_API_URL}/sales/pos-drafts/${activeLockDraftId}/unlock/`
                const body = JSON.stringify({
                    pos_session_id: posSessionId,
                    session_key: browserSessionKey,
                })
                if (navigator.sendBeacon) {
                    const blob = new Blob([body], { type: 'application/json' })
                    navigator.sendBeacon(url, blob)
                }
            }
        }
        window.addEventListener('beforeunload', handleBeforeUnload)
        return () => window.removeEventListener('beforeunload', handleBeforeUnload)
    }, [activeLockDraftId, posSessionId, browserSessionKey])

    // ── Lock API ────────────────────────────────────────────────

    const acquireLock = useCallback(async (draftId: number) => {
        if (!posSessionId) return { acquired: false, error: 'Sin sesión' }
        try {
            await api.post(`/sales/pos-drafts/${draftId}/lock/`, {
                pos_session_id: posSessionId,
                session_key: browserSessionKey,
            })
            setActiveLockDraftId(draftId)
            return { acquired: true }
        } catch (error: any) {
            return {
                acquired: false,
                error: error.response?.data?.error || 'Error al bloquear',
                locked_by_name: error.response?.data?.locked_by_name
            }
        }
    }, [posSessionId, browserSessionKey])

    const releaseLock = useCallback(async (draftId?: number) => {
        const targetId = draftId || activeLockDraftId
        if (!targetId || !posSessionId) return
        try {
            await api.post(`/sales/pos-drafts/${targetId}/unlock/`, {
                pos_session_id: posSessionId,
                session_key: browserSessionKey,
            })
        } catch (error) {}
        if (targetId === activeLockDraftId) setActiveLockDraftId(null)
    }, [activeLockDraftId, posSessionId, browserSessionKey])

    const getLockInfo = useCallback((draftId: number) => {
        const draft = syncDrafts.find(d => d.id === draftId)
        if (!draft || !draft.is_locked) return { isLocked: false, lockedByName: null, isOwnLock: false }
        return {
            isLocked: true,
            lockedByName: draft.locked_by_name,
            isOwnLock: draft.lock_session_key === browserSessionKey,
        }
    }, [syncDrafts, browserSessionKey])

    return {
        syncDrafts,
        isPolling: !isSocketConnected, // For UI indicator
        activeLockDraftId,
        browserSessionKey,
        acquireLock,
        releaseLock,
        getLockInfo,
        forceSync: initialFetch,
    }
}
