"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getUserPreferences, saveUserPreference } from "@/features/profile/api/profileApi"
import { useAuth } from "@/contexts/AuthContext"

export function useViewModePreference() {
  const { isAuthenticated } = useAuth()
  const queryClient = useQueryClient()

  const { data: preferences = {} } = useQuery({
    queryKey: ['user-preferences', 'view_mode'],
    queryFn: async () => {
      const prefs = await getUserPreferences()
      return (prefs.view_mode ?? {}) as Record<string, string>
    },
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
  })

  const mutation = useMutation({
    mutationFn: async (viewModes: Record<string, string>) => {
      await saveUserPreference('view_mode', viewModes)
    },
    onMutate: async (viewModes) => {
      await queryClient.cancelQueries({ queryKey: ['user-preferences', 'view_mode'] })
      const previous = queryClient.getQueryData(['user-preferences', 'view_mode'])
      queryClient.setQueryData(['user-preferences', 'view_mode'], viewModes)
      return { previous }
    },
    onError: (_err, _viewModes, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['user-preferences', 'view_mode'], context.previous)
      }
    },
  })

  const getSavedView = (entityLabel: string): string | undefined => {
    return preferences?.[entityLabel]
  }

  const getViewModeUrl = (entityLabel: string, baseUrl: string): string => {
    const saved = getSavedView(entityLabel)
    if (saved) {
      const separator = baseUrl.includes('?') ? '&' : '?'
      return `${baseUrl}${separator}view=${saved}`
    }
    return baseUrl
  }

  const saveViewMode = (entityLabel: string, view: string) => {
    const updated = { ...preferences, [entityLabel]: view }
    mutation.mutate(updated)
  }

  return { preferences, getSavedView, getViewModeUrl, saveViewMode }
}
