import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { setClientToken, removeClientTokens } from './client-token';
import { POS_EXTERNAL_REASON_CHALLENGE_HEADER, preparePosExternalReasonRetry } from './pos-external-reason';
import { getPosOperatorHeaders, parsePosOperatorRequired, preparePosOperatorRetry } from './pos-operator';
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
export const AUTH_FORBIDDEN_EVENT = 'auth:forbidden' as const;

/** Request flag that stops the 401 refresh from retrying the same request twice. */
type RetriableRequestConfig = InternalAxiosRequestConfig & { _retry?: boolean };

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
        // Pase de operador y contexto de documento del POS (cajas multiusuario).
        for (const [name, value] of Object.entries(getPosOperatorHeaders())) {
            config.headers.set(name, value);
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

api.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
        const originalRequest: RetriableRequestConfig | undefined = error.config;
        if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
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
                    const response = await axios.post<{ access: string }>(`${baseURL}token/refresh/`, {
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
        if (axios.isAxiosError(error)) {
            // Falta identificar al operador (caja multiusuario): no es un problema de permisos.
            const operatorPurpose = parsePosOperatorRequired(error);
            if (operatorPurpose) {
                const retryConfig = await preparePosOperatorRetry(error.config, operatorPurpose);
                return retryConfig ? api(retryConfig) : Promise.reject(error);
            }
            const posReasonHeader: unknown = error.response?.headers?.[POS_EXTERNAL_REASON_CHALLENGE_HEADER];
            if (posReasonHeader) {
                const retryConfig = await preparePosExternalReasonRetry(error.config, posReasonHeader);
                if (retryConfig) return api(retryConfig);
            }
        }
        if (error.response?.status === 403) {
            const url = originalRequest?.url ?? ''
            if (!url.includes('/auth/') && !url.includes('/token/')) {
                if (typeof window !== 'undefined') {
                    try {
                        window.dispatchEvent(new CustomEvent(AUTH_FORBIDDEN_EVENT))
                    } catch {}
                }
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
                const response = await api.get<{ status: string; data?: unknown; error?: string }>(`${cleanEndpoint}${taskId}/`);
                
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
