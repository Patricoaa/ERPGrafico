import axios from 'axios';

const rawBaseURL = process.env.NEXT_PUBLIC_API_URL || '';
const baseURL = rawBaseURL.endsWith('/') ? rawBaseURL : `${rawBaseURL}/`;

const api = axios.create({
    baseURL,
    headers: {
        'Content-Type': 'application/json',
    },
});

/**
 * Resolves a media URL from the backend.
 * If the path is relative (starts with /media/), it prepends the backend host.
 * If the path is already absolute, it returns it as-is.
 */
export function resolveMediaUrl(path: string | null | undefined): string | null {
    if (!path) return null;
    if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
        return path;
    }

    // Derive backend host from baseURL (stripping /api/ if present)
    const backendHost = rawBaseURL.replace(/\/api\/?$/, '');
    
    // Ensure the path starts with a slash
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    
    return `${backendHost}${normalizedPath}`;
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
            } catch (e) {}
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
            originalRequest._retry = true;
            
        const isBrowser = typeof window !== 'undefined';
        let refreshToken = null;
        if (isBrowser) {
            try {
                refreshToken = localStorage.getItem('refresh_token');
            } catch (e) {}
        }
        
        if (refreshToken) {
            try {
                // Use standard baseURL for refresh
                const response = await axios.post(`${baseURL}token/refresh/`, {
                    refresh: refreshToken
                });
                if (response.status === 200) {
                    if (isBrowser) {
                        try {
                            localStorage.setItem('access_token', response.data.access);
                        } catch (e) {}
                    }
                    api.defaults.headers.common['Authorization'] = 'Bearer ' + response.data.access;
                    return api(originalRequest);
                }
            } catch (refreshError) {
                // Handle refresh token failure (e.g., logout)
                if (isBrowser) {
                    try {
                        localStorage.removeItem('access_token');
                        localStorage.removeItem('refresh_token');
                    } catch (e) {}
                    window.location.href = '/login';
                }
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
