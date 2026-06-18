"use client"

import { useCallback, useEffect, useRef } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { ENTITY_REGISTRY, getViewOptions } from "@/lib/entity-registry"
import { useViewModePreference } from "./useViewModePreference"
import { useAuth } from "@/contexts/AuthContext"

/**
 * useViewMode — Declarative view mode management driven by ENTITY_REGISTRY
 * with per-user persistence via server-side preferences.
 *
 * Priority: URL param (?view=) > saved preference > registry defaultView.
 *
 * @param entityLabel - Registry key (e.g. 'sales.saleorder')
 * @param overrideDefault - Optional override for the default view (ignores registry)
 */
export function useViewMode(entityLabel: string, overrideDefault?: string) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const { isAuthenticated } = useAuth()
  const { getSavedView, saveViewMode } = useViewModePreference()
  const hasInitialized = useRef(false)

  const policy = ENTITY_REGISTRY[entityLabel]?.viewPolicy
  const defaultView = overrideDefault ?? policy?.defaultView ?? 'list'

  const urlView = searchParams.get('view')
  const savedView = getSavedView(entityLabel)

  // Priority: URL param > saved preference > registry default
  const currentView = (urlView ?? savedView ?? defaultView) as string

  // On first load, if no URL param but we have a saved preference, write it to URL
  useEffect(() => {
    if (!hasInitialized.current && !urlView && savedView && isAuthenticated) {
      hasInitialized.current = true
      const params = new URLSearchParams(searchParams.toString())
      params.set('view', savedView)
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    }
    // Intentionally runs only on mount — writes saved preference to URL once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Write to URL without scroll jump, preserving all other params
  const handleViewChange = useCallback((view: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('view', view)
    router.push(`${pathname}?${params.toString()}`, { scroll: false })

    // Persist preference for authenticated users
    if (isAuthenticated) {
      saveViewMode(entityLabel, view)
    }
  }, [searchParams, router, pathname, entityLabel, isAuthenticated, saveViewMode])

  const viewOptions = getViewOptions(entityLabel)

  return {
    /** Current active view (read from URL, saved preference, or registry default) */
    currentView,
    /** Update the view in the URL and persist the preference */
    handleViewChange,
    /** Toolbar options array (undefined if entity has only 1 view) */
    viewOptions,
    /** The full view policy from the registry */
    policy,
    /** Whether the current view is a custom (non-list) view */
    isCustomView: currentView !== 'list',
  }
}
