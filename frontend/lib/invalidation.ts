import type { QueryClient } from '@tanstack/react-query'

/**
 * Invalidates multiple cross-feature query keys in a single call.
 * Replaces repeated inline invalidation blocks in mutation hooks.
 */
export function invalidateCrossFeature(
    queryClient: QueryClient,
    keys: Array<readonly unknown[]>
): void {
    for (const key of keys) {
        queryClient.invalidateQueries({ queryKey: key as unknown[] })
    }
}
