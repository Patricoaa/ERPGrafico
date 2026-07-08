import api from '@/lib/api'

interface LoginPayload {
  username: string
  password: string
}

interface LoginResponse {
  access: string
  refresh?: string
}

export const authApi = {
  login: (payload: LoginPayload) =>
    api.post<LoginResponse>('token/', payload).then(r => r.data),
  getCurrentUser: () =>
    api.get<{ id: number; username: string; first_name: string; last_name: string; email: string; is_superuser: boolean; groups: string[]; permissions: string[]; theme: 'light' | 'dark' | 'system' }>('/core/auth/me/').then(r => r.data),
  logout: () =>
    api.post('/logout/'),
}