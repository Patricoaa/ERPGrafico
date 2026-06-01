"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useTheme } from "next-themes"
import { updateThemePreference } from "../api/profileApi"
import { useAuth } from "@/contexts/AuthContext"
import { toast } from "sonner"

export function useThemeSync() {
  const { setTheme } = useTheme()
  const { user, updateUser } = useAuth()
  const queryClient = useQueryClient()

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
      // Invalidar query del perfil para refrescar datos del usuario autenticado
      queryClient.invalidateQueries({ queryKey: ['current-user'] })
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
