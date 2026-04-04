import axios from 'axios';

const rawBaseURL = process.env.NEXT_PUBLIC_API_URL || '';
const baseURL = rawBaseURL.endsWith('/') ? rawBaseURL : `${rawBaseURL}/`;

const api = axios.create({
    baseURL,
    headers: {
        'Content-Type': 'application/json',
    },
});

api.interceptors.request.use(
    (config) => {
        // Automatically strip leading slash from URL to prevent it from replacing baseURL's path
        if (config.url && config.url.startsWith('/')) {
            config.url = config.url.substring(1);
        }

        const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
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
            const refreshToken = isBrowser ? localStorage.getItem('refresh_token') : null;
            
            if (refreshToken) {
                try {
                    // Use standard baseURL for refresh
                    const response = await axios.post(`${baseURL}token/refresh/`, {
                        refresh: refreshToken
                    });
                    if (response.status === 200) {
                        if (isBrowser) {
                            localStorage.setItem('access_token', response.data.access);
                        }
                        api.defaults.headers.common['Authorization'] = 'Bearer ' + response.data.access;
                        return api(originalRequest);
                    }
                } catch (refreshError) {
                    // Handle refresh token failure (e.g., logout)
                    if (isBrowser) {
                        localStorage.removeItem('access_token');
                        localStorage.removeItem('refresh_token');
                        window.location.href = '/login';
                    }
                }
            }
        }
        return Promise.reject(error);
    }
);

export async function pollTask(taskId: string, endpoint: string = 'finances/api/report-status/', interval: number = 2000): Promise<any> {
    return new Promise((resolve, reject) => {
        const checkStatus = async () => {
            try {
                const response = await api.get(`${endpoint}${taskId}/`);
                if (response.data.status === 'SUCCESS') {
                    resolve(response.data.data);
                } else if (response.data.status === 'FAILURE') {
                    reject(new Error(response.data.error || 'Task failed'));
                } else {
                    // PENDING or other state, continue polling
                    setTimeout(checkStatus, interval);
                }
            } catch (error) {
                reject(error);
            }
        };
        setTimeout(checkStatus, interval);
    });
}

export default api;
