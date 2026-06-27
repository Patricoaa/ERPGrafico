import api from '@/lib/api'
import { toPage, type Page } from '@/lib/pagination'
import type { AppUser, AppGroup } from '@/types/entities'

export const usersApi = {
    getUsers: async (params?: Record<string, unknown>): Promise<Page<AppUser>> => {
        const res = await api.get('/core/users/', { params })
        return toPage(res.data, (params?.page as number) ?? 1, (params?.page_size as number) ?? 50)
    },
    getUser: (id: number | string) =>
        api.get(`/core/users/${id}/`).then(r => r.data),
    createUser: (payload: Record<string, unknown>) =>
        api.post('/core/users/', payload).then(r => r.data),
    updateUser: (id: number, payload: Record<string, unknown>) =>
        api.patch(`/core/users/${id}/`, payload).then(r => r.data),
    getRoles: () =>
        api.get('/core/users/roles/').then(r => r.data),
    getGroups: (config?: { params?: Record<string, unknown> }) =>
        api.get('/core/groups/', config).then(r => r.data),
    getGroup: (id: number | string) =>
        api.get(`/core/groups/${id}/`).then(r => r.data),
    createGroup: (payload: Record<string, unknown>) =>
        api.post('/core/groups/', payload).then(r => r.data),
    updateGroup: (id: number, payload: Record<string, unknown>) =>
        api.patch(`/core/groups/${id}/`, payload).then(r => r.data),
}
