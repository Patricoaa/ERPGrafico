// useDraftSync Hook
// Real-time synchronization for POS drafts via short-polling
// Manages: polling for changes, heartbeat for active lock, event callbacks

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
    wizard_state: any | null
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
    pollInterval?: number       // ms, default 5000
    heartbeatInterval?: number  // ms, default 5000
    onNewDraft?: (draft: SyncDraft) => void
    onDraftDeleted?: (draftId: number) => void
    onDraftUpdated?: (draft: SyncDraft) => void
    onLockChanged?: (draft: SyncDraft) => void
    onSessionStateChange?: (status: 'OPEN' | 'CLOSED', closedByName: string | null) => void
}

// ── Browser Session Key ──────────────────────────────────────────
// Unique per browser tab — persisted in sessionStorage so it survives
// soft refreshes but not new tabs

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
    pollInterval = 5000,
    heartbeatInterval = 5000,
    onNewDraft,
    onDraftDeleted,
    onDraftUpdated,
    onLockChanged,
    onSessionStateChange,
}: UseDraftSyncOptions) {
    const { user } = useAuth()
    const [syncDrafts, setSyncDrafts] = useState<SyncDraft[]>([])
    const [isPolling, setIsPolling] = useState(false)
    const [activeLockDraftId, setActiveLockDraftId] = useState<number | null>(null)
    
    const browserSessionKey = useRef(getBrowserSessionKey())
    const prevDraftsRef = useRef<SyncDraft[]>([])
    const prevStatusRef = useRef<'OPEN' | 'CLOSED' | null>(null)
    const callbacksRef = useRef({ onNewDraft, onDraftDeleted, onDraftUpdated, onLockChanged, onSessionStateChange })
    
    // Keep callbacks ref up to date
    useEffect(() => {
        callbacksRef.current = { onNewDraft, onDraftDeleted, onDraftUpdated, onLockChanged, onSessionStateChange }
    }, [onNewDraft, onDraftDeleted, onDraftUpdated, onLockChanged, onSessionStateChange])

    // ── Diff detection ──────────────────────────────────────────

    const detectChanges = useCallback((newDrafts: SyncDraft[]) => {
        const prev = prevDraftsRef.current
        if (prev.length === 0) {
            // First sync — no notifications
            prevDraftsRef.current = newDrafts
            return
        }

        const prevMap = new Map(prev.map(d => [d.id, d]))
        const newMap = new Map(newDrafts.map(d => [d.id, d]))
        const currentUserId = user?.id

        // Detect new drafts (created by others)
        for (const d of newDrafts) {
            if (!prevMap.has(d.id)) {
                // Only notify if created by someone else
                if (d.locked_by_id !== currentUserId) {
                    callbacksRef.current.onNewDraft?.(d)
                }
            }
        }

        // Detect deleted drafts
        for (const d of prev) {
            if (!newMap.has(d.id)) {
                callbacksRef.current.onDraftDeleted?.(d.id)
            }
        }

        // Detect updates and lock changes
        for (const d of newDrafts) {
            const old = prevMap.get(d.id)
            if (!old) continue

            // Lock state changed
            if (old.is_locked !== d.is_locked || old.locked_by_id !== d.locked_by_id) {
                callbacksRef.current.onLockChanged?.(d)
            }

            // Content updated (by someone else)
            if (old.updated_at !== d.updated_at && d.locked_by_id !== currentUserId) {
                callbacksRef.current.onDraftUpdated?.(d)
            }
        }

        prevDraftsRef.current = newDrafts
    }, [user?.id])

    // ── Polling ─────────────────────────────────────────────────

    const poll = useCallback(async () => {
        if (!posSessionId) return
        try {
            const res = await api.get(`/sales/pos-drafts/sync/?pos_session_id=${posSessionId}`)
            const data: SyncResponse = res.data
            
            // Handle Session Status Sync
            if (data.session_status && prevStatusRef.current !== data.session_status) {
                // If it was already set (not first load) and changed to CLOSED
                if (prevStatusRef.current === 'OPEN' && data.session_status === 'CLOSED') {
                    callbacksRef.current.onSessionStateChange?.('CLOSED', data.closed_by_name)
                }
                prevStatusRef.current = data.session_status
            }

            setSyncDrafts(data.drafts)
            detectChanges(data.drafts)
        } catch (error) {
            // Silent fail — polling is background, don't spam errors
            console.debug('[DraftSync] Poll failed:', error)
        }
    }, [posSessionId, detectChanges])

    useEffect(() => {
        if (!enabled || !posSessionId) return

        // Initial poll
        poll()
        setIsPolling(true)

        const interval = setInterval(poll, pollInterval)

        return () => {
            clearInterval(interval)
            setIsPolling(false)
        }
    }, [enabled, posSessionId, pollInterval, poll])

    // ── Heartbeat for active lock ───────────────────────────────

    useEffect(() => {
        if (!activeLockDraftId || !posSessionId) return

        const sendHeartbeat = async () => {
            try {
                await api.post(`/sales/pos-drafts/${activeLockDraftId}/heartbeat/`, {
                    pos_session_id: posSessionId,
                    session_key: browserSessionKey.current,
                })
            } catch (error: any) {
                if (error.response?.status === 409) {
                    // Lock was lost
                    console.warn('[DraftSync] Lock lost for draft', activeLockDraftId)
                    toast.warning('El bloqueo del borrador se ha perdido. Otro usuario puede estar editándolo.')
                    setActiveLockDraftId(null)
                }
            }
        }

        const interval = setInterval(sendHeartbeat, heartbeatInterval)
        return () => clearInterval(interval)
    }, [activeLockDraftId, posSessionId, heartbeatInterval])

    // ── Release lock on page unload ─────────────────────────────

    useEffect(() => {
        const handleBeforeUnload = () => {
            if (activeLockDraftId && posSessionId) {
                // Use sendBeacon for reliable fire-and-forget on page close
                const url = `${process.env.NEXT_PUBLIC_API_URL}/sales/pos-drafts/${activeLockDraftId}/unlock/`
                const token = localStorage.getItem('access_token')
                const body = JSON.stringify({
                    pos_session_id: posSessionId,
                    session_key: browserSessionKey.current,
                })
                
                if (navigator.sendBeacon) {
                    const blob = new Blob([body], { type: 'application/json' })
                    // sendBeacon doesn't support auth headers, so we rely on the
                    // lock timeout as fallback. The explicit unlock is best-effort.
                    navigator.sendBeacon(url, blob)
                }
            }
        }

        window.addEventListener('beforeunload', handleBeforeUnload)
        return () => window.removeEventListener('beforeunload', handleBeforeUnload)
    }, [activeLockDraftId, posSessionId])

    // ── Lock API ────────────────────────────────────────────────

    const acquireLock = useCallback(async (draftId: number): Promise<{ acquired: boolean, error?: string, locked_by_name?: string }> => {
        if (!posSessionId) return { acquired: false, error: 'Sin sesión' }

        try {
            await api.post(`/sales/pos-drafts/${draftId}/lock/`, {
                pos_session_id: posSessionId,
                session_key: browserSessionKey.current,
            })
            setActiveLockDraftId(draftId)
            return { acquired: true }
        } catch (error: any) {
            if (error.response?.status === 423) {
                const data = error.response.data
                return {
                    acquired: false,
                    error: data.error,
                    locked_by_name: data.locked_by_name,
                }
            }
            return { acquired: false, error: 'Error al bloquear borrador' }
        }
    }, [posSessionId])

    const releaseLock = useCallback(async (draftId?: number) => {
        const targetId = draftId || activeLockDraftId
        if (!targetId || !posSessionId) return

        try {
            await api.post(`/sales/pos-drafts/${targetId}/unlock/`, {
                pos_session_id: posSessionId,
                session_key: browserSessionKey.current,
            })
        } catch (error) {
            console.debug('[DraftSync] Unlock failed:', error)
        }
        
        if (targetId === activeLockDraftId) {
            setActiveLockDraftId(null)
        }
    }, [activeLockDraftId, posSessionId])

    // ── Helpers ──────────────────────────────────────────────────

    const isLockedByOther = useCallback((draftId: number): boolean => {
        const draft = syncDrafts.find(d => d.id === draftId)
        if (!draft || !draft.is_locked) return false
        // Locked by someone else (different session key)
        return draft.lock_session_key !== browserSessionKey.current
    }, [syncDrafts])

    const getLockInfo = useCallback((draftId: number): { isLocked: boolean, lockedByName: string | null, isOwnLock: boolean } => {
        const draft = syncDrafts.find(d => d.id === draftId)
        if (!draft || !draft.is_locked) {
            return { isLocked: false, lockedByName: null, isOwnLock: false }
        }
        return {
            isLocked: true,
            lockedByName: draft.locked_by_name,
            isOwnLock: draft.lock_session_key === browserSessionKey.current,
        }
    }, [syncDrafts])

    // Force a sync now (useful after save/delete operations)
    const forceSync = useCallback(() => {
        poll()
    }, [poll])

    return {
        syncDrafts,
        isPolling,
        activeLockDraftId,
        browserSessionKey: browserSessionKey.current,
        acquireLock,
        releaseLock,
        isLockedByOther,
        getLockInfo,
        forceSync,
    }
}
