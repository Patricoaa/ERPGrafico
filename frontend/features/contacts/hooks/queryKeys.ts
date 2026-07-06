import { createQueryKeyFactory } from '@/lib/query-keys'

const _contacts = createQueryKeyFactory('contacts')
export const CONTACTS_KEYS = {
    ..._contacts,
    insights: (id: number) => [..._contacts.detail(id), 'insights'] as const,
}
