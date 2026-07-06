"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useTheme } from "next-themes"
import { updateThemePreference } from "../api/profileApi"
import { useAuth } from "@/contexts/AuthContext"
import { useRealtime } from "@/features/realtime"
import { toast } from "sonner"
import { PROFILE_KEYS } from "./queryKeys"
import { invalidateCrossFeature } from '@/lib/invalidation'

export function useThemeSync() {
  const { setTheme } = useTheme()
  const { user, updateUser } = useAuth()
  const queryClient = useQueryClient()
  const { markLocalMutation } = useRealtime()

  const mutation = useMutation({
    mutationFn: (newTheme: 'light' | 'dark' | 'system') => updateThemePreference(newTheme),
    onMutate: async (newTheme) => {
      // 1. Optimistic Update inmediato en el cliente para latencia cero
      setTheme(newTheme)
      
      // 2. Actualizar el estado del usuario localmente en AuthContext
      const previousTheme = user?.theme
      if (user) {
        updateUser({ theme: newTheme })
      }
      
      return { previousTheme }
    },
    onError: (err, newTheme, context) => {
      // Revertir tema en caso de error de conexión/API
      if (context?.previousTheme) {
        setTheme(context.previousTheme)
        if (user) {
          updateUser({ theme: context.previousTheme })
        }
      }
      toast.error("No se pudo sincronizar la preferencia de tema con el servidor.")
    },
    onSuccess: () => {
      markLocalMutation()
      invalidateCrossFeature(queryClient, [PROFILE_KEYS.all])
    }
  })

  const changeTheme = (targetTheme: 'light' | 'dark' | 'system') => {
    // Si el usuario no está autenticado (ej. login screen), solo cambiamos localmente
    if (!user) {
      setTheme(targetTheme)
      return
    }
    
    // Si está autenticado, disparamos la mutación para persistencia robusta
    mutation.mutate(targetTheme)
  }

  return {
    changeTheme,
    isSyncing: mutation.isPending
  }
}
