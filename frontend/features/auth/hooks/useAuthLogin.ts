import { useMutation } from '@tanstack/react-query'
import { authApi } from '../api/authApi'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { showApiError } from '@/lib/errors'
import { setClientRefreshToken } from '@/lib/client-token'

export function useAuthLogin() {
  const { login: authLogin } = useAuth()
  const router = useRouter()

  const loginMutation = useMutation({
    mutationFn: authApi.login,
    // eslint-disable-next-line mutation/must-mark-local -- login doesn't invalidate entity caches
    onSuccess: (data) => {
      authLogin(data.access)
      if (data.refresh) {
        setClientRefreshToken(data.refresh)
      }
      toast.success('Inicio de sesión exitoso')
      router.push('/')
    },
    onError: (error: Error) => {
      showApiError(error, 'Error de autenticación')
    }
  })

  return { login: loginMutation.mutateAsync, isLoggingIn: loginMutation.isPending }
}