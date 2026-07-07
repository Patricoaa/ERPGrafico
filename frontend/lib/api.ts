import axios from 'axios';
import { setClientToken, removeClientTokens } from './client-token';
export { resolveMediaUrl } from './media-url';

const rawBaseURL = process.env.NEXT_PUBLIC_API_URL || '';
const baseURL = rawBaseURL.endsWith('/') ? rawBaseURL : `${rawBaseURL}/`;

const api = axios.create({
    baseURL,
    headers: {
        'Content-Type': 'application/json',
    },
    timeout: 15000,
});

/** Evento que cruza la barrera Axios (no-React) → AuthContext (React). */
export const AUTH_UNAUTHORIZED_EVENT = 'auth:unauthorized' as const;

let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string) => void; reject: (error: unknown) => void }> = [];

function processQueue(error: unknown, token: string | null = null) {
    failedQueue.forEach(({ resolve, reject }) => {
        if (error) {
            reject(error);
        } else {
            resolve(token as string);
        }
    });
    failedQueue = [];
}

api.interceptors.request.use(
    (config) => {
        // Automatically strip leading slash from URL to prevent it from replacing baseURL's path
        if (config.url && config.url.startsWith('/')) {
            config.url = config.url.substring(1);
        }

        let token = null;
        if (typeof window !== 'undefined') {
            try {
                token = localStorage.getItem('access_token');
            } catch {}
        }
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;
        if (error.response?.status === 401 && !originalRequest._retry) {
            if (isRefreshing) {
                return new Promise<string>((resolve, reject) => {
                    failedQueue.push({ resolve, reject });
                }).then((token) => {
                    originalRequest.headers.Authorization = `Bearer ${token}`;
                    return api(originalRequest);
                });
            }

            originalRequest._retry = true;
            isRefreshing = true;

            const isBrowser = typeof window !== 'undefined';
            let refreshToken: string | null = null;
            if (isBrowser) {
                try {
                    refreshToken = localStorage.getItem('refresh_token');
                } catch {}
            }

            try {
                if (refreshToken) {
                    const response = await axios.post(`${baseURL}token/refresh/`, {
                        refresh: refreshToken
                    });
                    if (response.status === 200) {
                        if (isBrowser) {
                            try {
                                setClientToken(response.data.access);
                            } catch {}
                        }
                        api.defaults.headers.common['Authorization'] = 'Bearer ' + response.data.access;
                        processQueue(null, response.data.access);
                        return api(originalRequest);
                    }
                }
            } catch (refreshError) {
                processQueue(refreshError, null);
                if (isBrowser) {
                    try {
                        removeClientTokens();
                        window.dispatchEvent(new CustomEvent(AUTH_UNAUTHORIZED_EVENT));
                    } catch {}
                }
                return Promise.reject(error);
            } finally {
                isRefreshing = false;
            }
        }
        return Promise.reject(error);
    }
);

export async function pollTask<T = unknown>(
    taskId: string, 
    endpoint: string = 'finances/api/report-status/', 
    initialInterval: number = 2000,
    maxRetries: number = 10
): Promise<T> {
    let currentInterval = initialInterval;
    let retryCount = 0;

    return new Promise((resolve, reject) => {
        const checkStatus = async () => {
            try {
                // Remove the extra slash if endpoint already ends with it
                const cleanEndpoint = endpoint.endsWith('/') ? endpoint : `${endpoint}/`;
                const response = await api.get(`${cleanEndpoint}${taskId}/`);
                
                if (response.data.status === 'SUCCESS') {
                    resolve(response.data.data as T);
                } else if (response.data.status === 'FAILURE') {
                    reject(new Error(response.data.error || 'Task failed'));
                } else {
                    // PENDING or other state, continue polling with reset interval
                    currentInterval = initialInterval; 
                    setTimeout(checkStatus, currentInterval);
                }
            } catch (error: unknown) {
                const status = axios.isAxiosError(error) ? error.response?.status : undefined;
                const isRetriable = status === 429 || (status !== undefined && status >= 500 && status < 600);
                
                if (isRetriable && retryCount < maxRetries) {
                    retryCount++;
                    // Exponential backoff: increase interval (e.g. 2s, 4s, 8s, 16s, max 30s)
                    currentInterval = Math.min(currentInterval * 2, 30000); 
                    console.warn(`Retriable error (${status}). Retrying in ${currentInterval}ms... (Attempt ${retryCount}/${maxRetries})`);
                    setTimeout(checkStatus, currentInterval);
                } else {
                    reject(error);
                }
            }
        };
        setTimeout(checkStatus, currentInterval);
    });
}

export default api;
