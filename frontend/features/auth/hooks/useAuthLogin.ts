import { useMutation } from '@tanstack/react-query'
import { authApi } from '../api/authApi'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { showApiError } from '@/lib/errors'

interface LoginPayload {
  username: string
  password: string
}

export function useAuthLogin() {
  const { login: authLogin } = useAuth()
  const router = useRouter()

  return useMutation({
    mutationFn: authApi.login,
    onSuccess: (data) => {
      authLogin(data.access)
      if (data.refresh) {
        localStorage.setItem('refresh_token', data.refresh)
      }
      toast.success('Inicio de sesión exitoso')
      router.push('/')
    },
    onError: (error: Error) => {
      showApiError(error, 'Error de autenticación')
    }
  })
}