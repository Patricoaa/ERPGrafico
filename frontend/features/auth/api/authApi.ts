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
}