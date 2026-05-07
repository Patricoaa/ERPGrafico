import { useEffect, useState, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

export interface NotificationPayload {
    id: number;
    title: string;
    message: string;
    type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
    notification_type?: string;
    link: string;
    data: Record<string, any>;
    created_at: string;
    read: boolean;
}

// ── Configuration ────────────────────────────────────────────────────────────
const WS_ENABLED = process.env.NEXT_PUBLIC_WS_ENABLED !== 'false'; // enabled by default
const MAX_RETRIES = 10;
const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 30_000;

/**
 * Derives the WebSocket URL from environment variables.
 *
 * Priority:
 *   1. NEXT_PUBLIC_WS_URL  — explicit override (e.g. "wss://custom-ws.example.com/ws")
 *   2. Auto-derive from NEXT_PUBLIC_API_URL — strips "/api" suffix, swaps protocol
 *   3. Fallback to current window location (works behind reverse proxy)
 */
function getWebSocketUrl(): string | null {
    // 1. Explicit override
    const explicitWsUrl = process.env.NEXT_PUBLIC_WS_URL;
    if (explicitWsUrl) {
        return explicitWsUrl.replace(/\/$/, '') + '/notifications/';
    }

    // 2. Derive from API URL
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (apiUrl) {
        const wsProtocol = apiUrl.startsWith('https') ? 'wss' : 'ws';
        const wsHost = apiUrl.replace(/^https?:\/\//, '').replace(/\/api\/?$/, '');
        return `${wsProtocol}://${wsHost}/ws/notifications/`;
    }

    // 3. Fallback: derive from window.location (works behind nginx)
    if (typeof window !== 'undefined') {
        const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
        return `${wsProtocol}://${window.location.host}/ws/notifications/`;
    }

    return null;
}

/**
 * Exponential backoff with jitter: min(BASE * 2^attempt + jitter, MAX)
 */
function getBackoffDelay(attempt: number): number {
    const delay = Math.min(BASE_DELAY_MS * Math.pow(2, attempt), MAX_DELAY_MS);
    const jitter = Math.random() * 500;
    return delay + jitter;
}

/**
 * Real-time notification hook via WebSocket.
 *
 * Features:
 * - JWT auth via query parameter (industry standard for WS)
 * - Exponential backoff reconnection (1s → 30s cap, max 10 retries)
 * - Graceful degradation: if WS is unavailable, polling fallback in
 *   UserActions.tsx (2min interval) continues working independently
 * - Feature flag: set NEXT_PUBLIC_WS_ENABLED=false to disable entirely
 */
export function useNotifications(onNotification?: (notification: NotificationPayload) => void) {
    const { user } = useAuth();
    const [socketConnected, setSocketConnected] = useState(false);
    const socketRef = useRef<WebSocket | null>(null);
    const retryCountRef = useRef(0);
    const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const mountedRef = useRef(true);
    // Store callback in ref to avoid reconnecting when callback changes
    const onNotificationRef = useRef(onNotification);
    onNotificationRef.current = onNotification;

    const handleIncomingNotification = useCallback((notification: NotificationPayload) => {
        if (onNotificationRef.current) {
            onNotificationRef.current(notification);
        }
        
        // Show toast based on type
        const toastOptions = {
            description: notification.message,
            action: notification.link ? {
                label: 'Ver',
                onClick: () => window.location.href = notification.link
            } : undefined,
        };

        switch (notification.type) {
            case 'SUCCESS':
                toast.success(notification.title, toastOptions);
                break;
            case 'WARNING':
                toast.warning(notification.title, toastOptions);
                break;
            case 'ERROR':
                toast.error(notification.title, toastOptions);
                break;
            default:
                toast.info(notification.title, toastOptions);
                break;
        }
    }, []);

    useEffect(() => {
        mountedRef.current = true;

        // Guard: WS disabled, no user, or SSR
        if (!WS_ENABLED || !user || typeof window === 'undefined') return;

        const token = localStorage.getItem('access_token');
        if (!token) return;

        const wsUrl = getWebSocketUrl();
        if (!wsUrl) return;

        const connect = () => {
            if (!mountedRef.current) return;

            // Append JWT token as query parameter
            const urlWithAuth = `${wsUrl}?token=${encodeURIComponent(token)}`;

            const socket = new WebSocket(urlWithAuth);
            socketRef.current = socket;

            socket.onopen = () => {
                if (!mountedRef.current) {
                    socket.close();
                    return;
                }
                console.log('[Notifications] WebSocket connected');
                setSocketConnected(true);
                retryCountRef.current = 0; // Reset on successful connection
            };

            socket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === 'notification') {
                        handleIncomingNotification(data.notification);
                    }
                } catch (error) {
                    console.warn('[Notifications] Error parsing message:', error);
                }
            };

            socket.onclose = (event) => {
                setSocketConnected(false);

                if (!mountedRef.current) return;

                // Normal closure (e.g. user logged out, component unmounted)
                if (event.code === 1000) {
                    console.log('[Notifications] WebSocket closed normally');
                    return;
                }

                // Retry with exponential backoff
                if (retryCountRef.current < MAX_RETRIES) {
                    const delay = getBackoffDelay(retryCountRef.current);
                    console.warn(
                        `[Notifications] WebSocket disconnected (code: ${event.code}). ` +
                        `Retry ${retryCountRef.current + 1}/${MAX_RETRIES} in ${Math.round(delay / 1000)}s`
                    );
                    retryCountRef.current++;
                    retryTimeoutRef.current = setTimeout(connect, delay);
                } else {
                    console.warn(
                        '[Notifications] WebSocket max retries reached. ' +
                        'Falling back to polling-only mode.'
                    );
                }
            };

            socket.onerror = () => {
                // The error event provides no useful info (by spec).
                // The onclose handler will fire next and handle reconnection.
                // We intentionally don't log here to avoid double-logging.
            };
        };

        connect();

        return () => {
            mountedRef.current = false;

            // Clear pending retry
            if (retryTimeoutRef.current) {
                clearTimeout(retryTimeoutRef.current);
                retryTimeoutRef.current = null;
            }

            // Close existing socket
            if (socketRef.current) {
                socketRef.current.close(1000, 'Component unmounted');
                socketRef.current = null;
            }
        };
    }, [user, handleIncomingNotification]);

    return { socketConnected };
}
