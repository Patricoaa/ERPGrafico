import { ContactFilters } from '../types'

export const CONTACTS_KEYS = {
    all: ['contacts'] as const,
    lists: () => [...CONTACTS_KEYS.all, 'list'] as const,
    list: (filters?: ContactFilters) => [...CONTACTS_KEYS.lists(), { filters }] as const,
    details: () => [...CONTACTS_KEYS.all, 'detail'] as const,
    detail: (id: number) => [...CONTACTS_KEYS.details(), id] as const,
    insights: (id: number) => [...CONTACTS_KEYS.detail(id), 'insights'] as const,
}
