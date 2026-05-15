"use client"

import { useCallback } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { ENTITY_REGISTRY, getViewOptions } from "@/lib/entity-registry"

/**
 * useViewMode — Declarative view mode management driven by ENTITY_REGISTRY.
 * 
 * Replaces the ~60 lines of boilerplate (useState + useEffect + URL sync + viewOptions)
 * that every multi-view DataTable consumer previously duplicated.
 * 
 * The view state is persisted in the URL param `?view=` for bookmarkability
 * and browser history support.
 * 
 * @param entityLabel - Registry key (e.g. 'sales.saleorder')
 * @param overrideDefault - Optional override for the default view (ignores registry)
 */
export function useViewMode(entityLabel: string, overrideDefault?: string) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const policy = ENTITY_REGISTRY[entityLabel]?.viewPolicy
  const defaultView = overrideDefault ?? policy?.defaultView ?? 'list'

  // Read from URL, fallback to registry default
  const currentView = (searchParams.get('view') ?? defaultView) as string

  // Write to URL without scroll jump, preserving all other params
  const handleViewChange = useCallback((view: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('view', view)
    router.push(`${pathname}?${params.toString()}`, { scroll: false })
  }, [searchParams, router, pathname])

  // Auto-generated from registry
  const viewOptions = getViewOptions(entityLabel)

  return {
    /** Current active view (read from URL or registry default) */
    currentView,
    /** Update the view in the URL */
    handleViewChange,
    /** Toolbar options array (undefined if entity has only 1 view) */
    viewOptions,
    /** The full view policy from the registry */
    policy,
    /** Whether the current view is a custom (non-list) view */
    isCustomView: currentView !== 'list',
  }
}
