import api from '@/lib/api'

/* eslint-disable @typescript-eslint/no-explicit-any */
import api from '@/lib/api'

export const usersApi = {
    getUsers: (config?: Record<string, unknown>) =>
        api.get('/core/users/', config as any).then(r => r.data),
    getUser: (id: number | string) =>
        api.get(`/core/users/${id}/`).then(r => r.data),
    createUser: (payload: any) =>
        api.post('/core/users/', payload).then(r => r.data),
    updateUser: (id: number, payload: any) =>
        api.patch(`/core/users/${id}/`, payload).then(r => r.data),
    getRoles: () =>
        api.get('/core/users/roles/').then(r => r.data),
    getGroups: (config?: Record<string, unknown>) =>
        api.get('/core/groups/', config as any).then(r => r.data),
    getGroup: (id: number | string) =>
        api.get(`/core/groups/${id}/`).then(r => r.data),
    createGroup: (payload: any) =>
        api.post('/core/groups/', payload).then(r => r.data),
    updateGroup: (id: number, payload: any) =>
        api.patch(`/core/groups/${id}/`, payload).then(r => r.data),
}
