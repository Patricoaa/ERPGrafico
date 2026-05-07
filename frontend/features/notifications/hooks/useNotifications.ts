import { useEffect, useState, useRef } from 'react';
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

export function useNotifications(onNotification?: (notification: NotificationPayload) => void) {
    const { user } = useAuth();
    const [socketConnected, setSocketConnected] = useState(false);
    const socketRef = useRef<WebSocket | null>(null);

    useEffect(() => {
        if (!user) return;

        const baseUrl = process.env.NEXT_PUBLIC_API_URL || '';
        const wsProtocol = baseUrl.startsWith('https') ? 'wss' : 'ws';
        const wsHost = baseUrl.replace(/^https?:\/\//, '').replace(/\/api\/?$/, '');
        const wsUrl = `${wsProtocol}://${wsHost}/ws/notifications/`;

        const connect = () => {
            console.log('[Notifications] Connecting to:', wsUrl);
            const socket = new WebSocket(wsUrl);
            socketRef.current = socket;

            socket.onopen = () => {
                console.log('[Notifications] WebSocket connected');
                setSocketConnected(true);
            };

            socket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === 'notification') {
                        handleIncomingNotification(data.notification);
                    }
                } catch (error) {
                    console.error('[Notifications] Error parsing message:', error);
                }
            };

            socket.onclose = () => {
                console.log('[Notifications] WebSocket disconnected');
                setSocketConnected(false);
                // Reconnect after 5 seconds
                setTimeout(() => {
                    if (user) connect();
                }, 5000);
            };

            socket.onerror = (error) => {
                console.error('[Notifications] WebSocket error:', error);
                socket.close();
            };
        };

        connect();

        return () => {
            if (socketRef.current) {
                socketRef.current.close();
            }
        };
    }, [user]);

    const handleIncomingNotification = (notification: NotificationPayload) => {
        if (onNotification) {
            onNotification(notification);
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
        
        // Optional: Trigger a refetch of the notifications list if you have one
        // queryClient.invalidateQueries(['notifications']);
    };

    return { socketConnected };
}
