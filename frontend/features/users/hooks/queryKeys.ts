export const USER_KEYS = {
    all: ['users'] as const,
    lists: () => [...USER_KEYS.all, 'list'] as const,
    list: (term?: string) => [...USER_KEYS.lists(), { term }] as const,
    details: () => [...USER_KEYS.all, 'detail'] as const,
    detail: (id: string | number) => [...USER_KEYS.details(), id] as const,
}

export const GROUP_KEYS = {
    all: ['groups'] as const,
    lists: () => [...GROUP_KEYS.all, 'list'] as const,
    list: (term?: string) => [...GROUP_KEYS.lists(), { term }] as const,
    details: () => [...GROUP_KEYS.all, 'detail'] as const,
    detail: (id: string | number) => [...GROUP_KEYS.details(), id] as const,
}
