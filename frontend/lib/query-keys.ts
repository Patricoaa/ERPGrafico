/**
 * Standard query key factory for TanStack Query.
 *
 * Generates the hierarchical key tree that every feature's `queryKeys.ts`
 * repeats by hand. Use this to eliminate boilerplate and enforce a consistent
 * key structure across the entire application.
 *
 * ### Generated structure
 *
 * ```ts
 * const MY_KEYS = createQueryKeyFactory('my-feature')
 *
 * MY_KEYS.all         // ['my-feature']
 * MY_KEYS.lists()     // ['my-feature', 'list']
 * MY_KEYS.list(f)     // ['my-feature', 'list', f]
 * MY_KEYS.details()   // ['my-feature', 'detail']
 * MY_KEYS.detail(id)  // ['my-feature', 'detail', id]
 * ```
 *
 * Extend with extra keys when the feature needs more granularity:
 *
 * ```ts
 * const MY_KEYS = {
 *     ...createQueryKeyFactory('my-feature'),
 *     summaries: () => [...createQueryKeyFactory('my-feature').all, 'summary'],
 *     summary: (id: number) => [...createQueryKeyFactory('my-feature').all, 'summary', id],
 * }
 * ```
 */
export function createQueryKeyFactory(baseKey: string) {
    const all = [baseKey] as const
    return {
        /** Base key for the feature — invalidates everything */
        all: all as readonly string[],

        /** Key prefix for any list query */
        lists: () => [...all, 'list'] as const,

        /** Key for a specific list (with optional filters) */
        list: <T extends object | undefined>(filters?: T) =>
            filters ? ([...all, 'list', filters] as const) : ([...all, 'list'] as const),

        /** Key prefix for any detail query */
        details: () => [...all, 'detail'] as const,

        /** Key for a specific entity */
        detail: (id: number | string) => [...all, 'detail', id] as const,
    }
}
